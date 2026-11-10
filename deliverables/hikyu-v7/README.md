# Hikyu Bank V7 Delivery

The retained source directory now contains the incremental [V8 update](../hikyu-v8/README.md). This original V7 ZIP and its checksum remain unchanged; V7 test/report claims below are historical.

This is the independent V7 increment based only on the newly supplied `Version6_MingyuFan.zip`. The Word report is excluded from both this directory and the V7 ZIP at the owner's request. The English Markdown assignment report is included.

- [Runnable source and startup instructions](source/README.md)
- [Assignment report](source/docs/V7_Assignment_Report.md)
- [Setup and demo guide](source/docs/V7_Setup_and_Demo_Guide.md)
- [Actual test results](source/docs/V7_Test_Results.md)
- [Reflection](source/docs/V7_Reflection.md)
- [Changes and requirement coverage](source/docs/V7_Change_List_and_Coverage.md)
- [Fresh local evidence and screenshots](source/evidence/v7/)
- [Downloadable V7 ZIP without the Word report](Hikyu_Bank_V7.zip)
- [Delivery manifest](V7_Delivery_Manifest.json) and [SHA-256 checksum](SHA256SUMS.txt)

**17 local V7 checks passed. Real Zapier/Google end-to-end integration is not yet deployed or verified.** The actual local Saltcorn/PostgreSQL/Flowable/classifier tests used separate role accounts operated by one person. The relay tests explicitly emulate Google services and are not cloud run evidence. Fresh V6-related regressions passed: 8 UI checks, 9 workflow HTTP tests and 6 engine tests during setup.

The two new Zap designs are External Support Request Intake and Support Case Outcome Synchronization. Flowable retains business workflow ownership. External integration never changes balances or settled transactions. Secret files, runtime databases, installed dependencies and compiled targets are excluded. Generate fresh local credentials with the setup recipe, and authorize only newly created Google/Zapier resources.

The repository's existing application and earlier V6 delivery are retained. V7 is installed from its own `source/` directory; it does not replace the root application. The exact uploaded baseline is preserved inside the V7 source/ZIP for provenance. No previous deployment needs to be contacted.
