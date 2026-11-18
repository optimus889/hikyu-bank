Hikyu Bank Version 6 - LCNC + AI-powered iBPM workflow

Documentation (design + reflection): Version6_YourName_Documentation.pdf
Links: links.txt

Folders
  implementation/   Saltcorn extensions, Flowable BPMN workflow, local AI classifier,
                    tests, setup scripts, and the Maven Wrapper in workflow/
  deliverables/     Saltcorn_V6_Application_Pack.json (native LCNC configuration export)
  evidence/         Recorded test outputs and screenshots
  research/         Snapshots of official documentation used for platform selection

The historical Version 5 working snapshot is available under
implementation/v5-working/ inside ../Hikyu_Bank_V7.zip.

Requirements: Node.js, Python 3, Docker, JDK 17+.
Run:
  python3 implementation/prepare_v6.py --check
  python3 implementation/prepare_v6.py
  docker compose -p hikyu-v6 -f implementation/compose.v6.yaml up -d --wait
  python3 implementation/start-services.py
Then open http://localhost:8097/auth/login (generated demo accounts; no secrets are included).
