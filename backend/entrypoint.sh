#!/bin/bash
set -e

echo "Waiting for MySQL database..."
python -c "
import time
import os
from sqlalchemy import create_engine
url = os.environ.get('DATABASE_URL') or f\"mysql+pymysql://{os.environ.get('MYSQL_USER', 'root')}:{os.environ.get('MYSQL_PASSWORD', 'root')}@{os.environ.get('MYSQL_HOST', 'localhost')}:{os.environ.get('MYSQL_PORT', 3306)}/{os.environ.get('MYSQL_DATABASE', 'marine')}?charset=utf8mb4\"
engine = create_engine(url)
for i in range(30):
    try:
        conn = engine.connect()
        conn.close()
        print('Database is ready!')
        break
    except Exception as e:
        print(f'Waiting for database ({i+1}/30)...: {e}')
        time.sleep(2)
"

echo "Running Alembic migrations..."
alembic upgrade head || python -c "
from app.database.connection import engine, Base
import app.models
print('Alembic migration failed, falling back to Base.metadata.create_all...')
Base.metadata.create_all(bind=engine)
"

echo "Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
