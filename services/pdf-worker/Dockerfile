FROM python:3.12-slim-bookworm

WORKDIR /app
RUN useradd --create-home --uid 10001 worker

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-dejavu-core \
    fonts-liberation \
    fontconfig \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --upgrade pip==26.3 \
    && python -m pip install -r requirements.txt

COPY --chown=worker:worker . .

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV HOME=/home/worker
ENV PYTHONWARNINGS="ignore::FutureWarning:fitz"

EXPOSE 8000
USER worker

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
