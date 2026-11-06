"""Database setup and privilege granting script."""

from sqlalchemy import create_engine, text
from app.core.config import get_settings
from app.database.connection import Base
import app.models


def main():
    settings = get_settings()
    server_url = f"mysql+pymysql://root:root@{settings.MYSQL_HOST}:{settings.MYSQL_PORT}/"
    engine = create_engine(server_url)

    with engine.connect() as conn:
        conn.execute(
            text(
                f"CREATE DATABASE IF NOT EXISTS {settings.MYSQL_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        )
        conn.execute(
            text(
                f"CREATE USER IF NOT EXISTS '{settings.MYSQL_USER}'@'%' IDENTIFIED BY '{settings.MYSQL_PASSWORD}';"
            )
        )
        conn.execute(
            text(
                f"GRANT ALL PRIVILEGES ON {settings.MYSQL_DATABASE}.* TO '{settings.MYSQL_USER}'@'%';"
            )
        )
        conn.execute(text("FLUSH PRIVILEGES;"))
        conn.commit()
    print(f"Database {settings.MYSQL_DATABASE} and user {settings.MYSQL_USER} configured.")

    db_engine = create_engine(settings.DATABASE_URL)
    Base.metadata.create_all(bind=db_engine)
    print("All tables created successfully.")


if __name__ == "__main__":
    main()
