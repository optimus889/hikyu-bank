#!/usr/bin/env python3
"""Prepare an independent V7 installation. No credentials from the source archive are used."""
import pathlib,subprocess,sys,os,signal,json
root=pathlib.Path(__file__).resolve().parent.parent
args=sys.argv[1:]
if args and args!=['--check'] and args!=['--start-only']:raise SystemExit('Usage: prepare_v7.py [--check | --start-only]')
subprocess.run([sys.executable,str(root/'implementation/prepare_v6.py'),*args],check=True)
if args==['--check']:
 for f in ['implementation/v7/relay/Code.gs','implementation/v7/zapier/index.js','implementation/v7/setup-v7.cjs']:
  if not (root/f).is_file():raise SystemExit('Missing V7 source '+f)
 print('V7 source is present. This check does not verify live Zapier connectivity.')
else:
 subprocess.run(['node',str(root/'implementation/v7/setup-v7.cjs')],check=True)
 print('V7 ready at http://127.0.0.1:8197/page/support-inbox. External relay stays disabled until configured.')
