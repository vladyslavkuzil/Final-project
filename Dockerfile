FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app/backend

# Install uv
RUN pip install --no-cache-dir uv

# Copy dependency files first (for Docker caching)
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies using uv
RUN uv sync --frozen --no-dev

# Copy application code
COPY backend/src ./src

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]