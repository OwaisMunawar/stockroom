# Architecture decisions

## ADR 1 — An absolute observation is not an additive event

A cycle count says how many units the inspector observed, not how many units to add. Each command carries the baseline server revision. A matching revision updates the absolute quantity; a mismatch is a conflict for human review.

**Rejected:** summing concurrent observations in a CRDT counter, or last-arrival-wins replacement. Neither preserves the meaning of a physical count. CRDTs remain useful for different domains; this one needs an explicit decision.

## ADR 2 — Keep draft proposals outside the write boundary

`DraftParser` returns a catalog product, quantity, note and visible origin. Foundation Models selects a catalog index and integer quantity, never arbitrary product IDs. TypeScript verifies a unique catalog mention and an exact whole numeral in the note. Manual entry has separate explicit semantics. Every path requires review before creating a command.

**Rejected:** allowing model tool calls to mutate inventory, or trusting a generated product name or numeric explanation. A source check establishes correspondence to a note; it cannot establish that the shelf observation is true. Fractions, estimates and number words are deliberately unsupported.

The native module uses Swift 6 complete concurrency checking and warnings as errors. SDK 57's prebuilt umbrella headers contain forward-declared React protocols. Clang diagnostics from imported vendor headers are isolated at the module boundary; this does not disable Swift diagnostics in the module's own source.

## ADR 3 — Save the count before attempting delivery

A local transaction writes the reviewed command and its initial history event. Server-confirmed catalog values are stored separately. One active count per product prevents a second observation from obscuring a queued or conflicted one.

**Rejected:** optimistic stock replacement followed by rollback. A user should be able to distinguish “I observed 14” from “the server accepted 14.” There is no cancel button for uncertain delivery: a server may have committed before the acknowledgement was lost.

## ADR 4 — The receipt belongs in the stock transaction

The authority serializes transactions on one SQLite connection. It checks for an existing command ID and canonical fingerprint, then checks the product revision. The stock update and applied/conflict receipt commit atomically. Replaying the same command returns that saved outcome. Reusing an ID with different data fails.

**Rejected:** storing idempotency keys only in memory, or writing the stock and receipt in separate transactions. A crash between those writes would make a retry unsafe. This is replay-safe state mutation, not a claim of exactly-once network transport.

The single-process transaction queue is not cross-process coordination. A multi-process production service needs a database/concurrency design appropriate for its deployment.

## ADR 5 — Backoff without blocking unrelated work

`SyncEngine` shares one active run, delivers due counts in insertion order and retains original command IDs. Transient failures schedule deterministic exponential backoff with bounded jitter; five failures pause that item. A different product can still progress. Contract failures remain visible rather than being retried as connection errors.

A final catalog refresh never moves a saved product version backwards. A delayed old receipt can settle its command while a newer catalog version remains visible.

**Rejected:** unbounded retry loops, replacing command IDs on retry, or dropping an entire batch when one item fails.

## ADR 6 — Conflicts preserve both the original and the decision

The original command becomes superseded or cancelled, never deleted. A verified recount creates a new ID, links `supersedesId`, and uses the displayed server revision. That revision must be at least as recent as the conflict receipt and must match the local saved catalog when queued. The decision requires a note.

**Rejected:** silently replaying a stale observation against the latest revision. Only a person can determine whether it is still a valid physical count.

## ADR 7 — Shared logic with a hard deployment boundary

`shared/` is platform independent. The persisted demo authority and Node HTTP service use the same count contract and authority engine behind `CountTransport`; the demo is not a second, looser implementation. SQL, transport, parser, clock and ID ports are injected. Domain code owns no singleton state.

Mobile code cannot import `server/` or Node APIs. The server cannot import mobile adapters. ESLint enforces these boundaries. The composition root alone chooses platform implementations.

## ADR 8 — A small auditable reference server

The HTTP service validates JSON, bounds body size, returns typed failures and defaults to loopback. It has a minimal Docker runtime manifest rather than shipping the mobile build toolchain.

**Rejected:** presenting a sample unauthenticated single-warehouse service as a production backend. Authentication, identity, authorization, tenant isolation, operational backups and deployment hardening are future work.
