# Imagem enxuta: a app é Python puro, sem nada pra compilar.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependências primeiro, código depois: assim o Docker reaproveita a camada
# de instalação enquanto só o código muda.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ ./app/
COPY static/ ./static/

# O banco vive no volume montado, não na imagem — senão sumiria a cada deploy.
ENV DB_PATH=/data/dados.sqlite3

EXPOSE 8080

# --forwarded-allow-ips: sem isso o uvicorn ignora o cabeçalho do proxy do Fly
# e a app acha que está em HTTP puro, o que desliga o `secure` do cookie.
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8080", \
     "--forwarded-allow-ips", "*"]
