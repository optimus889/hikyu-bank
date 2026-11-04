# Hikyu Bank V7

Independent increment from the newly supplied Version6_MingyuFan.zip. Start with `docs/V7_Setup_and_Demo_Guide.md`, then read `docs/V7_Test_Results.md` before making acceptance claims.

- `python3 implementation/prepare_v7.py --check`
- `V6_DB_PORT=55476 python3 implementation/prepare_v7.py`
- Native local application: http://127.0.0.1:8197/page/support-inbox

**17 local V7 checks Pass. Real Zapier/Google integration is not yet deployed or end-to-end verified.** Eight support UI, nine HTTP workflow and six engine regression/build tests passed in this independent environment. Relay tests use explicitly emulated Google services and one operator simulates distinct roles.

All credentials are generated into excluded `private/` files. Do not commit or share them. External transport defaults to disabled. Two private Zap designs and a deployable authenticated Google relay are provided; the owner must authorize and run them through secure platform interfaces.

The supplied V6 PDF, README.txt, links.txt and V6 pack are baseline references and may describe old paths/results. They do not override the V7 guide or prove current execution. Do not access a previous deployment based on those references. The original uploaded archive is preserved separately in the delivery. No financial transaction behavior or Flowable business BPMN is intentionally changed.
