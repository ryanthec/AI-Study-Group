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



## 4. Key Folders and Files

### Backend (`/backend`)
The backend is built with Python and FastAPI, following a layered architecture (routers, services, data access) to ensure separation of concerns. All primary application code is located within the `app/` directory.

* **`app/api/v1/`**: Contains the FastAPI route handlers (controllers). It exposes the RESTful endpoints and WebSocket routes.
    * `auth.py` & `users.py`: Manage user registration, login, and profile operations.
    * `study_groups.py` & `invitations.py`: Handle the creation and management of groups and member invites.
    * `voice_chat.py` & `chat.py`: Manage the WebSocket endpoints for real-time signaling and text messaging.
    * `documents.py` & `quizzes.py`: Endpoints for uploading context documents and triggering AI quiz generation.
 

* **`app/agents/`**: Contains the core logic for the Large Language Model (LLM) integrations. Files like `teaching_agent.py`, `quiz_agent.py`, `summarising_agent.py`, and `gap_analysis_agent.py` dictate the specialized prompts and behaviors for how the Gemini model interacts with users.
  
* **`app/services/`**: The business logic layer. These files are called by the API routers to perform complex operations, keeping the route handlers clean.
    * `rag_service.py` & `document_service.py`: Handle Retrieval-Augmented Generation logic, parsing uploaded files, and querying vector embeddings.
    * `email_service.py`: Manages outbound SMTP communications (e.g., group invites).
      
* **`app/models/`**: SQLAlchemy Object-Relational Mapping (ORM) models. These represent the actual PostgreSQL database tables (e.g., `user.py`, `study_group.py`, `document_embedding.py`).

* **`app/schemas/`**: Pydantic models. These define the data structures for incoming request validation and outgoing API response serialization (e.g., ensuring a login request contains exactly an email and password).

* **`app/core/`**: Core application configurations and utilities.
    * `websocket_manager.py`: Manages active WebSocket connections across different study rooms.
    * `security.py`: Handles password hashing and JWT (JSON Web Token) generation/validation.
    * `database.py`: Manages the SQLAlchemy database engine and session lifecycle.

* **`app/main.py`**: The main entry point of the FastAPI application, where routers are included and CORS middleware is configured.

* **`app/dependencies.py`**: Reusable FastAPI dependencies, such as extracting the current active user from a token or yielding a database session.

* **`db/init/`**: Contains database initialization scripts. `00_enable_vector.sql` is a crucial script that runs when the database container starts, ensuring the `pgvector` extension is enabled for semantic search capabilities.


### Frontend (`/frontend`)
The frontend is built with React, Vite, and TypeScript, following a feature-based and modular folder structure. All primary source code is located within the `src/` directory.

* **`src/components/`**: The core building blocks of the UI, organized by domain:
    * `auth/`: Contains authentication-related UI components like `LoginForm.tsx` and `RegisterForm.tsx`.
    * `chat/` & `email/`: Specialized components for the chat interface (`ChatBox.tsx`) and group invitations (`InviteMemberModal.tsx`).
    * `common/`: Reusable, generic UI elements like `LoadingSpinner.tsx` and `ErrorBoundary.tsx`.
    * `layout/`: Structural page components such as `Navbar.tsx`, `Layout.tsx`, and `ThemeToggleButton.tsx`.
    * `studyGroup/`: The most complex component directory, housing the interactive tabs for the study rooms (e.g., `ChatTab.tsx`, `QuizTab.tsx`, `DocumentsTab.tsx`, `FlashcardGameTab.tsx`). It also contains the WebRTC interface components like `VoiceSidebarSection.tsx`.

* **`src/pages/`**: Top-level route components that represent full views in the application. They assemble various components together.
    * `auth/`: Views for logging in, registering, and verifying emails.
    * `dashboard/`: The main user landing areas, including `DashboardPage.tsx`.
    * `groups/`: Views for browsing, creating, editing, and joining specific study groups (e.g., `GroupDetailPage.tsx`, `BrowseGroupsPage.tsx`).

* **`src/services/`**: API wrapper classes and functions responsible for all HTTP and WebSocket communication with the backend. Files like `studyGroup.service.ts`, `quiz.service.ts`, and `document.service.ts` abstract the `axios` or `fetch` calls away from the UI components.

* **`src/hooks/`**: Custom React hooks for encapsulating complex frontend logic. 
    * `useWebRTC.ts`: Manages peer connections, audio streams, and ICE candidate exchanges for the voice rooms.
    * `useAuth.ts` & `useLocalStorage.ts`: Manage user sessions and local browser storage.

* **`src/context/` & `src/store/`**: Global state management. `VoiceChatContext.tsx` handles the overarching state of the audio rooms, while `AuthContext.tsx` maintains the user's authentication status across the app.

* **`src/types/`**: TypeScript definition files (e.g., `studyGroup.types.ts`, `api.types.ts`). These ensure end-to-end type safety by mirroring the data schemas expected from the FastAPI backend.

* **`src/styles/`**: Global stylesheets, including `globals.css` and `theme.css` for managing the application's visual theme.


## 5. Major Functions & Architectural Key Points

When extending, debugging, or deploying this codebase, incoming developers should be closely familiar with the following architectural decisions and technical nuances:

### 5.1. AI Agent Architecture & RAG Pipeline
The application utilizes specialized AI agents (e.g., `teaching_agent.py`, `quiz_agent.py`, `gap_analysis_agent.py`, `summarising_agent.py`) to handle different study contexts. 
* **RAG (Retrieval-Augmented Generation):** When a user asks a question, `rag_service.py` processes the query, converts it into a vector embedding using the embedding service, and performs a similarity search against the PostgreSQL database. The retrieved document chunks are then injected into the Gemini prompt to ground the AI's response in the group's uploaded materials.
* **Vector Computations:** RAG heavily relies on the `pgvector` extension. Ensure that the database container has sufficient memory allocated, as vector search operations (especially with larger study groups and numerous documents) can be computationally intensive.

### 5.2. AI Agent API Tiering & Fallback Logic
The AI integration includes specific handling for rate limits and testing environments. 
* **Tier Preference:** The AI model fallback logic in the agent services is strictly configured to favor the paid Gemini API tier over the free tier. This ensures stability and avoids the restrictive rate limits of the free tier during load testing or intensive group study sessions. 
* **Maintenance Note:** If deploying locally for lightweight testing, you can modify the cascading fallback logic, but ensure that any production or presentation environments utilize a provided API key with billing enabled to prevent unexpected service interruptions.

### 5.3. WebRTC Voice Communication Nuances
The voice chat feature is a peer-to-peer mesh network established via WebRTC, with the FastAPI backend acting purely as a signaling server to exchange session descriptions (SDP) and ICE candidates.
* **Signaling Flow:** The `useWebRTC.ts` hook manages the browser-side connections, capturing the user's audio stream and sending signaling messages through the WebSocket established by `voice_chat.py`.
* **Connection Health Checks:** The system uses a ping-pong mechanism to verify that peer connections remain open. When modifying the connection health checks in the React frontend, it is critical to note that `pingIntervalRef` is strictly typed as a `number` to maintain compatibility with the React frontend lifecycle. Do not overwrite this with a standard Node.js `Timeout` object, as it will cause type collisions and component unmount errors in the browser environment.

### 5.4. WebSocket State Management & Scalability
Real-time text chat and WebRTC signaling are heavily dependent on persistent WebSocket connections.
* **In-Memory Manager:** Currently, the backend utilizes an in-memory `websocket_manager.py` to track which users are connected to which study group "rooms". It routes messages only to active connections within the specific group ID.
* **Future Scaling:** Because the state is stored in the memory of the FastAPI process, this current architecture limits the application to a single backend instance. If the application needs to be scaled horizontally across multiple Docker containers, this manager must be refactored to use a Redis-backed Pub/Sub model to synchronize WebSocket states across all instances.

### 5.5. Database Schema & Text Processing
* **Document Processing:** Uploaded files (PDFs, TXTs) are parsed, chunked, and embedded asynchronously to prevent blocking the main API thread.
* **Data Integrity:** Ensure that the data returned from any text cleaning or scraping pipelines maps correctly to the database schemas. For instance, text data should map directly to primary `Text` fields rather than intermediate schemas (like `Clean_Text`) before being embedded, keeping the JSON structure and database models simplified and unified.
