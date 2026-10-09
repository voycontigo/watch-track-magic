#!/usr/bin/env bash
set -e

echo "[My Series] Iniciando add-on My Series..."

CONFIG_PATH="/data/options.json"
POSTGRES_HOST="localhost"
POSTGRES_PORT=5432
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="seriespassword"
POSTGRES_DB="series_tracker"
TMDB_API_KEY=""

if [ -f "$CONFIG_PATH" ]; then
    echo "[My Series] Leyendo configuración desde $CONFIG_PATH..."
    POSTGRES_HOST=$(jq -r '.postgres_host // "localhost"' "$CONFIG_PATH")
    POSTGRES_PORT=$(jq -r '.postgres_port // 5432' "$CONFIG_PATH")
    POSTGRES_USER=$(jq -r '.postgres_user // "postgres"' "$CONFIG_PATH")
    POSTGRES_PASSWORD=$(jq -r '.postgres_password // "seriespassword"' "$CONFIG_PATH")
    POSTGRES_DB=$(jq -r '.postgres_database // "series_tracker"' "$CONFIG_PATH")
    TMDB_API_KEY=$(jq -r '.tmdb_api_key // ""' "$CONFIG_PATH")
fi

export POSTGRES_HOST
export POSTGRES_PORT
export POSTGRES_USER
export POSTGRES_PASSWORD
export POSTGRES_DB
export TMDB_API_KEY
export PORT=3000

# Si se usa localhost o 127.0.0.1, iniciar servidor PostgreSQL local interno
if [ "$POSTGRES_HOST" = "localhost" ] || [ "$POSTGRES_HOST" = "127.0.0.1" ]; then
    echo "[My Series] Configurado para usar PostgreSQL interno."
    PGDATA="/data/postgres"

    if [ ! -d "$PGDATA" ]; then
        echo "[My Series] Inicializando cluster de PostgreSQL en $PGDATA..."
        mkdir -p "$PGDATA"
        chown -R postgres:postgres "$PGDATA"
        su-exec postgres initdb -D "$PGDATA" --auth-local=trust --auth-host=trust
    fi

    echo "[My Series] Arrancando servicio PostgreSQL local en puerto $POSTGRES_PORT..."
    mkdir -p /run/postgresql
    chown -R postgres:postgres /run/postgresql
    su-exec postgres pg_ctl -D "$PGDATA" -o "-p $POSTGRES_PORT" -w start

    # Asegurar base de datos
    su-exec postgres psql -p "$POSTGRES_PORT" -tc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'" | grep -q 1 || \
        su-exec postgres psql -p "$POSTGRES_PORT" -c "CREATE DATABASE \"$POSTGRES_DB\";"
else
    echo "[My Series] Conectando a PostgreSQL externo en $POSTGRES_HOST:$POSTGRES_PORT..."
fi

echo "[My Series] Iniciando servidor My Series..."
exec node dist-server/index.js

