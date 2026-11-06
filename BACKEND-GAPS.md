# Backend gap status

All the gaps listed in the functional repair patch now have backend APIs, UI pages and automated tests (`backend/app/tests/test_rbac_finance_ops.py`). Schema changes are in Alembic revision `b7c8d9e0f1a2`.

| Feature | Status | Endpoints |
|---|---|---|
| Roles & permissions | Done. Permission table and role-permission matrix; `require_permission()` checks the database on every request. The admin role always passes. Built-in roles and permissions cannot be deleted. | `GET/POST/PATCH/DELETE /admin/permissions`, `GET/POST/PATCH/DELETE /admin/roles`, `PUT /admin/roles/{id}/permissions`, `GET /admin/permission-matrix`, `GET /users/me/permissions` |
| Immutable ledger | Done. Append-only `ledger_entries`, SHA-256 hash-chained. Blocked from changes by the ORM, plus database triggers on MySQL and SQLite. Corrections are made with reversals. Premiums, refunds, claim payouts and commission payouts post automatically. | `GET /finance/ledger`, `GET /finance/ledger/verify`, `POST /finance/ledger/adjustments`, `POST /finance/ledger/{id}/reverse` |
| Financial reporting | Done. Totals, account balances and loss ratio are derived only from ledger entries. | `GET /finance/summary?date_from&date_to` |
| Reconciliation | Done. Compares gateway or bank statements with ledger entries by reference; flags amount mismatches, missing items and duplicates; marks matched settlements as reconciled. | `POST/GET /finance/reconciliations`, `GET /finance/reconciliations/{id}` |
| Payment history | Done. Customers see their own payments; staff with `payments.view_all` see all. | `GET /payments`, `GET /payments/{id}` |
| Payment verification | Done. Signature verification is required whenever a Razorpay secret is set. Without a secret, payments are rejected outside `APP_ENV=development`. | `POST /payments/{id}/verify` |
| Settlements | Done. Settling a claim creates a settlement record and a payout ledger entry. Marking a payout failed reverses its ledger entry; retrying posts a new one. | `GET /settlements/me`, `GET /settlements`, `GET /settlements/{id}`, `POST /settlements/{id}/mark-failed`, `POST /settlements/{id}/retry` |
| Grievances | Done. Grievance records with status transitions, assignment, internal notes, attachments, notifications and customer/staff access rules. | `POST/GET /grievances`, `GET/PATCH /grievances/{id}`, `POST /grievances/{id}/comments`, `POST/GET /grievances/{id}/attachments` |
| Product administration | Done. Validated create and update; new products start inactive; activate/deactivate; retire products nobody has applied for. Inactive products are hidden and cannot be quoted. | `GET/POST /admin/insurance-products`, `PATCH/DELETE /admin/insurance-products/{id}`, `POST …/{id}/activate`, `POST …/{id}/deactivate` |
| Surveyor report history | Done. | `GET /surveyor/reports` |
| Inspection scheduling | Done. Only the assigned surveyor or claims staff can schedule; overlapping bookings for a surveyor are refused; reschedule, cancel and complete; customers are notified. | `POST/GET /inspections`, `GET /inspections/{id}`, `POST …/reschedule`, `POST …/cancel`, `POST …/complete` |
| AI assistant | Done (retrieval mode). Answers use the active product catalogue plus the caller's own policies and claims, with citations. It is read-only and cannot approve or change anything. If `AI_PROVIDER=gemini` and `AI_API_KEY` are set, Gemini phrases the answer from the same sources. | `POST /ai/assistant/chat`, `GET /ai/assistant/recommendations?shipment_id=` |

## Known limits

- The Gemini answer mode has not been tested against the live API; only retrieval mode is covered by tests.
- Custom roles grant API permissions, but the sidebar still follows a user's built-in role.
- Claim review and settlement check both the permission and the existing officer-role check in `claim_service`. Granting `claims.review` to a non-officer role is therefore not enough on its own.
- Ledger sequence numbers come from `MAX(sequence)+1` under a row lock. Under heavy concurrent writes on MySQL, a clash fails the request via the unique constraint rather than corrupting the ledger.
