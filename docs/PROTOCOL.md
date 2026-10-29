# Count protocol

## Catalog

`GET /v1/catalog` returns validated products with a non-negative integer `onHand` and positive integer `version`. The app stores the latest received version of each product and ignores older catalog values.

## Submit a reviewed observation

`POST /v1/counts`, with `Content-Type: application/json`, accepts:

```json
{
  "id": "example-count-001",
  "productId": "brass-adapter",
  "baseVersion": 1,
  "quantity": 14,
  "note": "Counted 14 brass adapters in bin B2.",
  "origin": "manual",
  "createdAt": "2026-10-29T09:00:00.000Z",
  "supersedesId": null
}
```

The authority returns HTTP 200 with either `kind: applied` or `kind: conflict`, plus `commandId`, the product view and `recordedAt`. An applied result has quantity 14 and version 2 in this example. A conflict retains the server quantity and revision; it does not mutate stock.

The request fingerprint uses a fixed field order. Retrying an identical command ID returns the previously stored result, including a previously stored conflict. Reusing the ID with changed fields returns HTTP 409, code `IDEMPOTENCY_MISMATCH`. Missing products return 404; invalid contracts or JSON return 400; non-JSON submissions return 415. Unexpected failures return a generic 500 response without a stack trace.

## Lost acknowledgement

1. The authority commits a stock update and receipt.
2. The connection loses the response.
3. The client retains the command and schedules a retry.
4. The retry uses the same ID and payload.
5. The authority returns the stored receipt without another stock mutation.
6. The client commits its acknowledgement and history event together.

The client checks that an applied receipt's product, quantity and incremented version match the command. Conflict receipts must contain a newer server revision. A mismatched receipt cannot settle a queued observation.

## Reviewed replacement

A new recount uses a new command ID and references the original through `supersedesId`. Its baseline is the saved server revision the inspector reviewed. If another count wins before it arrives, the replacement can conflict again; the application does not bypass review.

## Limits

- Maximum request body: 16 KiB.
- Whole quantities: 0–1,000,000.
- Review/source notes: at most 400 characters.
- One active local count per product.
- Five transient delivery failures before explicit resume.
- No server-side authentication, tenancy or multi-process coordination in this reference release.
