# Hikyu Bank V8 Delivery

The existing Saltcorn application is updated incrementally at [the retained source path](../hikyu-v7/source/README.md), rather than copied over the root application. The original V7 ZIP remains unchanged.

- [Assignment report](../hikyu-v7/source/docs/V8_Assignment_Report.md)
- [Prompt log and original/revised code](../hikyu-v7/source/docs/V8_Prompt_Log.md)
- [Actual tests and limits](../hikyu-v7/source/docs/V8_Test_Results.md)
- [Setup and demo guide](../hikyu-v7/source/docs/V8_Setup_and_Demo_Guide.md)
- [100–200-word reflection](../hikyu-v7/source/docs/V8_Reflection.md)
- [Full V8 source ZIP](Hikyu_Bank_V8.zip)
- [Changes-only ZIP](Hikyu_Bank_V8_Changes.zip)
- [Delivery provenance and checksums](V8_Delivery_Manifest.json)

The package manifest identifies the source commit and confirmed baseline. The changes archive is not a complete application. No old archive, private credential, runtime database, installed dependency or build cache is added to V8 packages.

Local checks passed: 14 unit, 18 native browser and two controlled engine-branch tests. Related V7 regressions passed, with external relay behavior explicitly emulated. Real Zapier/Google execution and real multi-person handoff remain unverified. GitHub PR/merge disposition is reported separately and must not be inferred from these test results.

Current remote handoff: [GitHub status](GitHub_Status.json). The feature source was pushed; this task could not create a PR because the API request was Forbidden. No direct main push was used. [Fresh ZIP startup verification](verification/Package_Verification.json) and [post-source-commit tests](verification/source-commit-verification.json) are retained.
