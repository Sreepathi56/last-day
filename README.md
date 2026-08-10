# Neon AI

Smart Study Companion — backend (FastAPI) + frontend (React + Vite).

Run locally:

Backend:

```powershell
cd backend
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8001
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

API proxy: frontend Vite proxies `/api` to `http://localhost:8001`.
