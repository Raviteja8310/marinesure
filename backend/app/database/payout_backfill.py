"""SQL that registers every payout reference already used.

Sources: current settlement references, earlier (failed/reversed) payout
attempts that only survive in the ledger, and agent commission payouts.
Grouped so normalised duplicates insert once; existing rows are skipped.
Shared by Alembic revision d9e0f1a2b3c4 and app.scripts.sync_schema.
"""

BACKFILL_SQL = """
INSERT INTO payout_references (reference, source_type, source_id, created_at)
SELECT u.ref, MIN(u.source_type), MIN(u.source_id), MIN(u.created_at)
FROM (
    SELECT UPPER(TRIM(payout_reference)) AS ref, 'settlement' AS source_type,
           claim_id AS source_id, created_at
    FROM settlements WHERE payout_reference IS NOT NULL AND TRIM(payout_reference) <> ''
    UNION ALL
    SELECT UPPER(TRIM(external_reference)),
           CASE WHEN entry_type = 'commission_payout' THEN 'agent_commission' ELSE 'settlement' END,
           COALESCE(reference_id, ''), posted_at
    FROM ledger_entries
    WHERE entry_type IN ('claim_payout', 'commission_payout')
      AND external_reference IS NOT NULL AND TRIM(external_reference) <> ''
    UNION ALL
    SELECT UPPER(TRIM(payout_reference)), 'agent_commission', id, created_at
    FROM agent_commissions WHERE payout_reference IS NOT NULL AND TRIM(payout_reference) <> ''
) u
WHERE NOT EXISTS (SELECT 1 FROM payout_references p WHERE p.reference = u.ref)
GROUP BY u.ref
"""
