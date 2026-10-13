FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PORT=8002
ENV DATA_DIR=/app/data

RUN useradd -m -u 1001 vae && \
    mkdir -p /app/data && \
    chown -R vae:vae /app

COPY scripts/ /app/scripts/

USER vae
EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1

ENTRYPOINT ["python3", "scripts/server.py"]
