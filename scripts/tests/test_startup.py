"""Verify launch routing without Docker, Maven downloads or cloud credentials."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class StartupTest(unittest.TestCase):
    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.root = Path(self.workspace.name)
        (self.root / 'backend').mkdir()
        (self.root / 'scripts').mkdir()
        (self.root / 'bin').mkdir()
        for name in ['start.sh', 'compose.yaml', '.env.example']:
            shutil.copy2(ROOT / name, self.root / name)
        shutil.copy2(ROOT / 'scripts/database.sh', self.root / 'scripts/database.sh')
        stub = '''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
item = {'command': Path(sys.argv[0]).name, 'args': sys.argv[1:],
        'env': {k: v for k, v in os.environ.items() if k.startswith('HIKYU_DB_')}}
with open(os.environ['LAUNCH_LOG'], 'a') as log:
    log.write(json.dumps(item) + '\\n')
if item['command'] == 'docker' and os.environ.get('DOCKER_FAIL') == '1':
    sys.exit(7)
'''
        for name in ['bin/docker', 'backend/mvnw']:
            target = self.root / name
            target.write_text(stub)
            target.chmod(0o755)
        self.env = {key: value for key, value in os.environ.items()
                    if not key.startswith(('HIKYU_', 'SUPABASE_'))}
        self.env['PATH'] = str(self.root / 'bin') + os.pathsep + self.env['PATH']
        self.env['LAUNCH_LOG'] = str(self.root / 'calls.jsonl')

    def run_mode(self, mode, extra=None):
        result = subprocess.run(
            ['sh', str(self.root / 'start.sh'), *([] if mode is None else [mode])],
            cwd=self.root, env={**self.env, **(extra or {})},
            stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=10,
        )
        log = self.root / 'calls.jsonl'
        calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
        return result, calls

    def cloud_settings(self):
        return {'HIKYU_DB_URL': 'jdbc:postgresql://db.example.com:5432/postgres',
                'HIKYU_DB_USER': 'demo_cloud', 'HIKYU_DB_PASSWORD': 'sample-secret'}

    def test_local_ignores_inherited_cloud_credentials(self):
        result, calls = self.run_mode('local', self.cloud_settings())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call['command'] for call in calls], ['docker', 'mvnw'])
        self.assertEqual(calls[1]['env']['HIKYU_DB_USER'], 'hikyu')
        self.assertEqual(calls[1]['env']['HIKYU_DB_URL'],
                         'jdbc:postgresql://127.0.0.1:5432/hikyu_bank')
        self.assertEqual(calls[0]['env'], calls[1]['env'])

    def test_local_config_reaches_both_services(self):
        (self.root / '.env.local').write_text(
            'HIKYU_DB_PORT=5433\nHIKYU_DB_USER=custom\nHIKYU_DB_PASSWORD="literal$#!=value"\n')
        result, calls = self.run_mode('local')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[0]['env'], calls[1]['env'])
        self.assertIn(':5433/', calls[1]['env']['HIKYU_DB_URL'])
        self.assertEqual(calls[1]['env']['HIKYU_DB_PASSWORD'], 'literal$#!=value')
        self.assertEqual(calls[0]['args'][:3], ['compose', '--env-file', '.env.local'])

    def test_docker_failure_prevents_java_start(self):
        result, calls = self.run_mode('local', {'DOCKER_FAIL': '1'})
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(calls), 1)

    def test_cloud_reuses_settings_without_docker(self):
        result, calls = self.run_mode('cloud', self.cloud_settings())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call['command'] for call in calls], ['mvnw'])
        self.assertTrue(calls[0]['env']['HIKYU_DB_URL'].endswith('?sslmode=require'))
        self.assertNotIn('sample-secret', result.stdout + result.stderr)

    def test_provider_file_overrides_stale_url_and_is_literal(self):
        sentinel = self.root / 'must-not-exist'
        value = '$(touch ' + str(sentinel) + ')#=!'
        (self.root / '.env.supabase').write_text(
            'HIKYU_DB_URL=jdbc:postgresql://pool.example.com:5432/postgres?sslmode=require\n'
            'HIKYU_DB_USER=postgres.demo\nHIKYU_DB_PASSWORD=' + value + '\n')
        result, calls = self.run_mode('cloud', {'HIKYU_DB_URL': 'jdbc:postgresql://:5432/postgres'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(sentinel.exists())
        self.assertEqual(calls[0]['env']['HIKYU_DB_PASSWORD'], value)

    def test_empty_host_rejected_before_any_services(self):
        settings = self.cloud_settings()
        settings['HIKYU_DB_URL'] = 'jdbc:postgresql://:5432/postgres?sslmode=require'
        result, calls = self.run_mode('cloud', settings)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_missing_credentials_rejected(self):
        settings = self.cloud_settings()
        del settings['HIKYU_DB_PASSWORD']
        result, calls = self.run_mode('cloud', settings)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_host_settings_build_cloud_url(self):
        result, calls = self.run_mode('cloud', {
            'SUPABASE_DB_HOST': 'pool.example.com', 'SUPABASE_DB_USER': 'postgres.demo',
            'SUPABASE_DB_PASSWORD': 'literal-pass'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[0]['env']['HIKYU_DB_URL'],
                         'jdbc:postgresql://pool.example.com:5432/postgres?sslmode=require')

    def test_disabled_ssl_rejected(self):
        settings = self.cloud_settings()
        settings['HIKYU_DB_URL'] += '?sslmode=disable'
        result, calls = self.run_mode('cloud', settings)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_unknown_mode_rejected(self):
        result, calls = self.run_mode('other')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])

    def test_legacy_alias_uses_cloud(self):
        result, calls = self.run_mode('supabase', self.cloud_settings())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call['command'] for call in calls], ['mvnw'])

    def test_noninteractive_existing_url_preserves_legacy_selection(self):
        result, calls = self.run_mode(None, self.cloud_settings())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call['command'] for call in calls], ['mvnw'])


if __name__ == '__main__':
    unittest.main()
