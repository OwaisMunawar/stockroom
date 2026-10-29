# Security

Report vulnerabilities privately to **owais.munawar@gmail.com** with the affected revision and a minimal reproduction. Do not attach private warehouse records to public issues.

## Trust boundaries

Count notes and model output are untrusted. Native output is schema checked and grounded to the uniquely named catalog product and explicit numeric quantity in the note. The model cannot mutate stock. A human reviews before queueing. Source grounding does not prove a physical observation is true.

The HTTP reference service is single-warehouse and unauthenticated. It binds to loopback by default. `STOCKROOM_BIND` exists for container networking; binding a server to a reachable interface does not add authorization. Add authentication, operator scopes, tenant isolation, TLS and deployment controls before broader use.

The API validates all command fields and bounds JSON bodies to 16 KiB. SQL values are bound parameters; table namespaces are fixed application literals. Error responses omit unexpected exception details. Idempotency IDs cannot be reused for changed payloads.

## Local data

The app's SQLite database has no additional encryption or biometric gate. OS backups may include it. Event triggers protect ordinary application history but do not resist an operator who controls the database file. Exported CSV includes product names, bins, quantities and revisions; the user chooses when to open the system share sheet.

Pending observations and received server views are distinct. A queued command may already have committed remotely without local acknowledgement, so deleting it is not a safe rollback. Reconcile a receipt before making a corrective count.

## Dependencies

The application and reference server use Zod 4.6.7. SDK 57's CLI requests an older vulnerable Zod version; a scoped override installs the patched version. Expo Doctor, prebuild and native release compilation validate this configuration. The last npm audit on 29 October 2026 reported **no high or critical advisories** and **15 low-severity advisories** in the development/tooling graph. The minimal server lockfile reported zero advisories at that check. CI fails on high-severity audit results. Do not run forced SDK-major dependency updates as a substitute for a reviewed toolchain upgrade.

## Operational limits

No production authentication, rate-limiting layer, retention policy, backup/restore workflow, distributed server lease or multi-process write coordination is implemented. The local demo authority is synthetic and separate from the HTTP client database. No credentials, API keys or physical device identifiers are required for the demo.
