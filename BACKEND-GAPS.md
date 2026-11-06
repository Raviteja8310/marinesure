# Remaining backend work before MarineSure can be called complete

The frontend patch only exposes currently supported APIs and clearly labels missing functionality. These are the next backend tasks.

| Feature | Required backend work |
|---|---|
| Payment history | Persist payment records and expose customer-scoped `GET /payments`; include gateway order/payment IDs, amount, currency, status, timestamps and receipt reference. |
| Settlements | Add settlement and payout transaction models; expose customer-scoped and staff-scoped list/detail endpoints; record approval, payout, failure, refund and reconciliation states. |
| Grievances | Add grievance model, document attachments, status transitions, assignment and customer/staff authorization. |
| AI assistant | Add authenticated chat/recommendation endpoint with role-scoped retrieval; cite policy/product source material; never let LLM authorize policy or claim decisions. |
| Product administration | Add admin-only create/update/activate/deactivate endpoints and validation for rates, limits, exclusions and deductibles. |
| Roles & permissions | Add permission definitions and role-permission mapping; enforce permissions in backend dependencies, not just frontend navigation. |
| Surveyor report history | Add `GET /surveyor/reports` scoped to the authenticated surveyor, with claim and shipment references. |
| Inspection scheduling | Add inspection appointment model and create/reschedule/cancel/list APIs, with surveyor assignment checks. |
| Financial reporting | Build an immutable financial ledger and reconcile payment gateway events; derive reports from ledger entries, not mutable dashboard counters. |
| Payment verification | Ensure Razorpay signature verification is mandatory outside explicitly isolated local development; never issue policy until a verified successful payment is recorded. |

## Security note

The new incident/telemetry checks authorize customers and shipping companies only when they are the shipment's recorded customer or shipping company. Admin and insurance staff can access records for operational duties. If surveyors must access telemetry for assigned claims, add a specific claim-assignment authorization path rather than granting all surveyors global shipment access.
