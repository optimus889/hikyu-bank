# Hikyu Bank V8

Incremental prompt-engineering UI update to the supplied V7 Saltcorn + PostgreSQL + Flowable application. The repository keeps this active source at `deliverables/hikyu-v7/source` to preserve history. The original V7 ZIP and unrelated root banking application are retained.

Start with [V8 Setup and Demo Guide](docs/V8_Setup_and_Demo_Guide.md). Run:

```bash
python3 implementation/prepare_v8.py --check
V6_DB_PORT=55586 python3 implementation/prepare_v8.py
```

The local application defaults to http://127.0.0.1:8297/page/support-inbox. Flowable uses 8296 and the independent PostgreSQL mapping uses 55586. Fresh credentials are generated into excluded private files. No previous account/database is adopted automatically.

V8 enhances the existing draft form, honest recorded case progress and synchronization monitor. Existing financial logic, CSRF/authorization, ownership, versions, Flowable and outbox mechanisms remain. There is no V8 business migration or new UI framework.

New verification: 14 unit tests and 18 actual native browser checks Pass, plus two actual controlled engine-branch tests. Related regressions passed: 8 native support, 9 workflow HTTP and 17 emulator-contract checks. The fresh engine build passed 6 tests. These suites overlap; they are not a total count of independent scenarios. One person simulated roles. Real Zapier/Google execution remains unverified.

Documents: [Assignment Report](docs/V8_Assignment_Report.md), [Prompt Log](docs/V8_Prompt_Log.md), [Test Results](docs/V8_Test_Results.md), [Reflection](docs/V8_Reflection.md). Exact prompts and original/revised output are preserved under implementation/v8/prompts.

V7/V6 reports and evidence are historical references. They do not prove V8 runs. Follow the V8 guide; do not contact an old deployment from historical links. The full V8 package excludes old archives, private configuration, dependencies and build caches. Its provenance identifies the verified Git source commit. The changes pack is not a complete app.
