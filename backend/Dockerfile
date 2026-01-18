# ========== Builder stage ==========
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# System deps for building wheels (psycopg2-binary often works, but compile support is safer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ========== Runtime stage ==========
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV UVICORN_WORKERS=1
ENV PORT=8000

# Install runtime system dependencies only (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 10001 appuser

WORKDIR /app

# Create required dirs
RUN mkdir -p /app/uploads /app/logs

# Copy built deps from builder
COPY --from=builder /wheels /wheels
RUN pip install --no-index --find-links=/wheels /wheels/* && rm -rf /wheels

# Copy application code
# Assumes your backend code lives under ./app and you have an entrypoint at app/main.py (app variable)
COPY app /app/app

# Optional: include Alembic if used
# COPY alembic.ini /app/alembic.ini
# COPY alembic /app/alembic

# Set environment defaults
ENV ENVIRONMENT=production
ENV HOST=0.0.0.0

# Change ownership to non-root
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Healthcheck (expects /health endpoint)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1

# Command: uvicorn with multiple workers
# Adjust --workers via env if needed (gunicorn+uvicorn workers optional)
CMD ["bash", "-lc", "uvicorn app.main:app --host ${HOST} --port ${PORT} --workers ${UVICORN_WORKERS}"]