# Verification record

Verified on 2026-10-29. Sample warehouse records and count notes are synthetic.

## Local quality checks

- `npm run format:check`, `npm run lint`, `npm run typecheck`: passed.
- `npm run test:coverage`: 52 tests in seven suites passed, including four screen interactions.
- Selected domain/application/repository/API coverage: statements 335/340 (98.52%), branches 191/205 (93.17%), functions 109/110 (99.09%), lines 308/311 (99.03%). Thin native drivers and UI layout are outside this coverage denominator.
- Real Node SQLite fixtures test transactions, replay receipts, stale counts, changed-payload rejection, close/reopen persistence, history triggers and client receipt validation. Real loopback HTTP tests exercise request validation and status codes. A lost-acknowledgement test proves a retry does not apply stock twice.
- Expo Doctor: 21/21 passed. SwiftLint 0.65.1 strict: zero violations. `actionlint`: passed.
- Dependency audit: zero high/critical advisories; 15 low tooling advisories remain. The separate reference-server runtime lockfile had zero advisories.

## Native execution

Toolchain: Xcode 26.6, iOS 26.5, dedicated iPhone 17 Pro simulator, unsigned Release build. The Swift 6 module compiled with complete concurrency checking and Swift warnings treated as errors. Foundation Models actually generated both reviewed drafts; these were not injected test responses.

`StockroomUITests.testOfflineCountAndConflictReview` passed:

1. Start with 18 brass adapters at revision 1.
2. Parse “Counted 14 brass adapters in bin B2.” through Foundation Models; inspect the labelled draft.
3. Queue while the application connection switch is off. Inventory stays server-confirmed.
4. Apply a competing count of 16 in the persisted **local demo authority**.
5. Enable delivery and receive a revision conflict. No silent overwrite occurs.
6. Enter a recount note and explicitly create a linked replacement command against the displayed revision.
7. Deliver the replacement, observe 14 at revision 3 and one confirmed receipt; preview the CSV stock snapshot.

`StockroomUITests.testHTTPReferenceServer` passed in a separate build:

- An ignored `.env.local` set `EXPO_PUBLIC_SYNC_ORIGIN=http://127.0.0.1:8057` before the Release bundle was built. The screen explicitly displayed HTTP reference-server mode.
- The real native model produced the count draft, a person-equivalent UI action queued it, and sync delivered it over HTTP to `npm run server` on the Mac.
- The app showed one server-confirmed count. An independent `GET /v1/catalog` returned brass adapters with `onHand: 14`, `version: 2`.
- The HTTP client and demo warehouse use separate databases. The HTTP test does not use the competing-demo-count helper.

The initial HTTP verification detected a bundle still configured for demo mode. The local environment file made the Release configuration explicit; the repeated HTTP workflow passed. Release configuration must be rebuilt when changing public environment values.

## Screenshot provenance

All PNGs were captured directly with `xcrun simctl io <dedicated-simulator> screenshot`; none were composited or edited. Every capture was opened and checked.

| File                          | Evidence                                                | Transport            |
| ----------------------------- | ------------------------------------------------------- | -------------------- |
| `inventory.png`               | Initial catalog                                         | Persisted local demo |
| `on-device-count-review.png`  | Actual Foundation Models draft and reviewed delta       | Persisted local demo |
| `offline-outbox.png`          | Durable local count awaiting a receipt                  | Persisted local demo |
| `conflict-review.png`         | Local observation against a newer server revision       | Persisted local demo |
| `receipt-confirmed-stock.png` | Final quantity after reviewed replacement               | Persisted local demo |
| `receipt-ledger.png`          | Confirmed receipt and count history                     | Persisted local demo |
| `server-only-report.png`      | CSV preview containing saved quantities and revisions   | Persisted local demo |
| `http-receipt-ledger.png`     | Confirmed delivery to the running Node reference server | Real loopback HTTP   |

## Reproduce native verification

See [CONTRIBUTING.md](../CONTRIBUTING.md). The XCTest harness drives accessibility identifiers and waits for observable states. `tool/capture-simulator.py` records screenshots at test checkpoints. Use a fresh dedicated simulator and a fresh reference-server data directory for these seed-dependent scenarios. Run the demo test with no HTTP origin; rebuild with an explicit local HTTP origin for the HTTP test.

## Limits

No physical-device, Android runtime, VoiceOver, low-memory, production, real-warehouse or background-delivery verification. The system share sheet is wired but completion is unverified. The Maestro flow is supplied but unrun because Maestro is not installed. CI performs Android and iOS builds, not on-device model inference. Local demo results are not evidence of multi-device synchronization or a production warehouse service.
