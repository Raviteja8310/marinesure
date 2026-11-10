"""
CLI entrypoint to seed realistic MarineSure demo data.
"""

from app.database.connection import SessionLocal
from app.services.seed_service import seed_demo_environment


def main():
    print("🌊 Seeding MarineSure Demo Environment...")
    db = SessionLocal()
    try:
        res = seed_demo_environment(db)
        print("✅ Demo environment successfully seeded!")
        print(f"Entities: {res['seeded_entities']}")
        print("\nDemo Login Credentials:")
        for acc in res["demo_accounts"]:
            print(f" - [{acc['role']}]: {acc['email']} / {acc['password']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
