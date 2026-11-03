# Hikyu Bank V6 delivery

This branch delivers the files requested in the current task. The ZIP combines the V5 source supplied for this task with new Saltcorn LCNC application code, Flowable workflows, a real local supervised classifier, tests, configuration exports, documentation and actual evidence.

## Download

1. Sign in to GitHub with an account authorized to access this repository.
2. Open `Hikyu_V6.zip` or `V6_Report.docx` in this folder.
3. Select **Download raw file**. For the ZIP, wait until the complete file has downloaded before extracting it.
4. The complete ZIP is **6,012,908 bytes** and uses ordinary stored ZIP entries with no encryption, no ZIP64 and no multi-volume dependency. It passed both integrity checks and actual extraction.
5. `SHA256SUMS.txt` and `Delivery_Files.json` record the exact byte counts and hashes.

For a local Git download:

```sh
git clone --branch hikyu-v6-delivery --single-branch https://github.com/optimus889/hikyu-bank.git
cd hikyu-bank/deliverables/hikyu-v6
```

Use your normal secure GitHub authentication; do not put passwords or tokens into commands or reports.

## Contents and scope

- `Hikyu_V6.zip`: combined source, LCNC/workflow/model implementation, native platform export, safe evidence, setup guide and English documents.
- `V6_Report.docx`: English Word report with six actual platform screenshots, executed test results, official sources and declared limitations.
- `SHA256SUMS.txt`: file-integrity checksums.
- `Delivery_Files.json`: byte counts and checksums.

The delivered implementation is a tested local demonstrator. The user authorized switching from Bubble to another editable LCNC platform; Saltcorn 1.6.2 is used with Flowable 7.1.0. Human-task acceptance used one operator with separate role accounts, not real different-person participation. Full V5 authentication/feature equivalence and public hosting are not claimed. The report lists the remaining gaps.

Private environment files, generated account passwords/PINs/tokens, database files, dependency caches and old compiled outputs are excluded. This delivery branch adds artifacts only; it does not deploy an application or publish a cloud environment version.
