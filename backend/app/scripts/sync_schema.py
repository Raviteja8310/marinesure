"""
Bring a database created with ``Base.metadata.create_all`` in line with the
Alembic head, then record that revision.

``create_all`` creates missing tables but never alters existing ones, so
columns added to old tables by later migrations are missing. This script adds
them, installs the ledger immutability triggers, and stamps the database so
future ``alembic upgrade head`` runs work normally.

Run:  python -m app.scripts.sync_schema
"""

from sqlalchemy import bindparam, inspect, text
from sqlalchemy.engine import Engine

from app.core.logging import get_logger
from app.database.connection import Base, engine as default_engine
from app.database.payout_backfill import BACKFILL_SQL
import app.models  # noqa: F401

logger = get_logger(__name__)

HEAD_REVISION = "d9e0f1a2b3c4"
SYSTEM_ROLES = ("customer", "shipping_company", "surveyor", "agent", "insurance_officer", "senior_officer", "admin")

# (table, column, DDL type with default) for columns added to pre-existing tables.
ADDED_COLUMNS = [
    ("roles", "is_system", "BOOLEAN NOT NULL DEFAULT 0"),
]


def _ledger_triggers(conn, dialect: str) -> None:
    if dialect == "mysql":
        existing = {r[0] for r in conn.execute(text(
            "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE EVENT_OBJECT_SCHEMA = DATABASE() "
            "AND EVENT_OBJECT_TABLE = 'ledger_entries'"))}
        for name, event in (("ledger_entries_no_update", "UPDATE"), ("ledger_entries_no_delete", "DELETE")):
            if name not in existing:
                conn.execute(text(
                    f"CREATE TRIGGER {name} BEFORE {event} ON ledger_entries FOR EACH ROW "
                    "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is append-only'"))
    elif dialect == "sqlite":
        for name, event in (("ledger_entries_no_update", "UPDATE"), ("ledger_entries_no_delete", "DELETE")):
            conn.execute(text(
                f"CREATE TRIGGER IF NOT EXISTS {name} BEFORE {event} ON ledger_entries "
                "BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END"))


def sync_schema(engine: Engine = default_engine) -> list[str]:
    """Idempotently repair the schema. Returns a list of the changes made."""
    changes: list[str] = []
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, column, ddl in ADDED_COLUMNS:
            if column not in {c["name"] for c in insp.get_columns(table)}:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
                changes.append(f"added {table}.{column}")
        updated = conn.execute(
            text("UPDATE roles SET is_system = 1 WHERE role_name IN :names AND is_system = 0").bindparams(
                bindparam("names", expanding=True)),
            {"names": list(SYSTEM_ROLES)},
        ).rowcount
        if updated:
            changes.append(f"marked {updated} built-in roles")
        _ledger_triggers(conn, engine.dialect.name)

        # Register every payout reference already used (same SQL as migration d9e0f1a2b3c4).
        added = conn.execute(text(BACKFILL_SQL)).rowcount
        if added and added > 0:
            changes.append(f"registered {added} historical payout references")

        conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))
        current = [r[0] for r in conn.execute(text("SELECT version_num FROM alembic_version"))]
        if not current:
            conn.execute(text("INSERT INTO alembic_version (version_num) VALUES (:v)"), {"v": HEAD_REVISION})
            changes.append(f"stamped alembic revision {HEAD_REVISION}")
    for c in changes:
        logger.info("Schema sync: %s", c)
    return changes


def main() -> None:
    changes = sync_schema()
    print("Schema already up to date." if not changes else "Schema updated:\n  - " + "\n  - ".join(changes))


if __name__ == "__main__":
    main()
