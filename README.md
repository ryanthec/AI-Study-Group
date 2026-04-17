# AI-Study-Group

This guide contains all necessary instructions, environment parameters, and architectural overviews required for another student or developer to successfully replicate and run the AI Study Group project locally.

## 1. Software, Packages, and Tools Used
This project utilizes a modern full-stack web architecture, integrating AI services and real-time communication protocols.

**Core Frameworks & Languages**
* **Frontend Environment:** Node.js (v18.x or higher) - [Download](https://nodejs.org/)
* **Frontend Framework:** React (built with Vite & TypeScript) - [Vite URL](https://vitejs.dev/)
* **Backend Environment:** Python (3.10+) - [Download](https://www.python.org/downloads/)
* **Backend Framework:** FastAPI - [FastAPI URL](https://fastapi.tiangolo.com/)

**Database & Infrastructure**
* **Relational Database:** PostgreSQL - [Download](https://www.postgresql.org/)
* **Vector Extension:** pgvector (for document embeddings and RAG) - [pgvector URL](https://github.com/pgvector/pgvector)
* **Containerization:** Docker & Docker Compose - [Docker URL](https://www.docker.com/)
* **Reverse Proxy / Web Server:** Caddy (Production)

**Cloud Services & External APIs**
* **Large Language Model (LLM):** Google Gemini API - Used to power the tutoring, quiz generation, and gap analysis agents.
* **Email Service:** Brevo - Used to send emails for verification
* **Trivia API:** OpenTDB- Free API call for Trivia questions

## 2. Environment Variables
To replicate this environment, configure the following environment variables.

**Backend (`backend/.env`):**
```env
DATABASE_URL= database_url

# JWT
JWT_SECRET_KEY=jwt key
JWT_ALGORITHM=jwt algorithm
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# AI
GEMINI_API_KEY=gemini-api-key

# Redis
REDIS_URL=redis://localhost:6379/0

# App
ENVIRONMENT=development
DEBUG=true

FRONTEND_URL=http://localhost:3000

BREVO_API_KEY=brevo-api-key
SMTP_SENDER=youremail@gmail.com
```

**Frontend (`frontend/.env`):**
```env
VITE_APP_NAME=AI Study Group
VITE_APP_ENV=development
VITE_APP_VERSION=1.0.0

# Backend API base URL (FastAPI)
VITE_API_URL=http://localhost:8000/api/v1

#WebSocket base URL (FastAPI WS endpoint)
VITE_WS_URL=ws://localhost:8000

# Feature flags
VITE_DEBUG=true
VITE_MOCK_API=false

# UI/Theme preferences
VITE_THEME=light
VITE_PRIMARY_COLOR=#1890ff

# File upload
VITE_MAX_UPLOAD_MB=25

# Rate limiting for client-side UI throttles
VITE_CHAT_RATE_LIMIT_PER_MINUTE=30

# Optional backend hostnames for Docker/Nginx
VITE_BACKEND_HOST=backend
VITE_BACKEND_PORT=8000
```


## 3. Installation and Setup Procedure

The easiest way to replicate and run the application is via Docker.
**Prerequisites:** Ensure Docker Desktop and Git are installed on your machine.

**Step 1: Clone the repository**

```bash
git clone https://github.com/ryanthec/AI-Study-Group.git
cd AI-Study-Group
```

**Step 2: Configure Environment Variables**

Create the .env files in both the /backend and /frontend directories using the parameters defined in the environments


**Step 3: Build and Run via Docker Compose**

Run the following command in the root directory:
```bash
docker-compose up --build
```

- The frontend will be accessible at http://localhost:5173 (or port 80 if using the production compose file).
- The backend API documentation (Swagger UI) will be accessible at http://localhost:8000/docs.
- The PostgreSQL database with the pgvector extension will be automatically initialized via the scripts in backend/db/init/.

