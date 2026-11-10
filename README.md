# MarineSure

**Marine Insurance Policy, Shipment Protection and Claims Management System**

MarineSure is a centralized marine cargo insurance management platform that digitizes policy applications, real-time shipment tracking, premium calculation, damage inspection, and end-to-end claim settlement.

## Tech Stack
- **Frontend:** React 18, Tailwind CSS, Vite, Chart.js
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic
- **Database:** MySQL 8.4
- **Cache/Queue:** Redis 7, Celery
- **Security:** Argon2, JWT Tokens (HS256)
- **AI Integration:** LangChain, LLM APIs (Policy Recommendations & AI Assistant)
- **Documents:** ReportLab PDF Generation
- **Payments:** Razorpay Test Mode

## Project Structure
```
marinesure/
├── backend/          # FastAPI REST API
│   ├── app/
│   │   ├── core/     # Config, security, permissions, logging
│   │   ├── database/ # SQLAlchemy connection & base
│   │   ├── models/   # Relational models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── api/v1/   # API endpoints
│   │   ├── services/ # Business logic services
│   │   └── ai/       # AI service & assistant
│   └── alembic/      # Schema migrations
├── frontend/         # React SPA
│   └── src/          # Layouts, pages, components, services
├── storage/          # Local private document storage
└── docker-compose.yml
```

## Getting Started

### Local Development (Direct)
1. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # on Windows
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Docker Compose
```bash
docker-compose up -d
```
- Frontend: http://localhost:5173
- Backend Docs: http://localhost:8000/docs
