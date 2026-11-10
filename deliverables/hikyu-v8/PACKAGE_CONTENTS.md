# Package Contents and Provenance

The full application ZIP exports the active source subtree from commit `ecbbc93b97030024503de337c2c29d64d049bb07`, followed by an added `PROVENANCE.json` listing each included file hash. Historical evidence/reports, old archives, baseline research, private configuration, dependencies, databases and generated build files are omitted. The application retains all required source, lockfiles, schema/configuration generators and the Maven wrapper.

The changes-only ZIP exports exactly the repository-relative added/modified files between baseline `f1271f24330cf8aad0fe5f8dc43834ea49d3800a` and that source commit, plus CHANGES.json, DELETIONS.json and instructions. There are no deletions. It is not a complete application. Its changed-path set and each target file's bytes were checked against Git.

The source commit passed tests after integrating the latest origin/main. A full ZIP was then freshly extracted and completely prepared under a different root, with new database, ports and credentials. Three actual native browser pages and the favicon passed, no unhandled JS error occurred, and all included source hashes remained identical after setup. These artifacts do not claim a real Zapier/Google run.

The following delivery commit adds packages/provenance outside the application subtree, so its HEAD SHA may differ from the archived source SHA while the active application files remain exactly the same. Consult GitHub_Status.json for the actual PR/merge disposition.
