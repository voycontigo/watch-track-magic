#!/usr/bin/env bash
set -e

echo "[My Series] Iniciando add-on My Series..."

CONFIG_PATH="/data/options.json"
POSTGRES_HOST="homeassistant"
POSTGRES_PORT=5432
POSTGRES_USER="postgres"
POSTGRES_PASSWORD=""
POSTGRES_DB="series_tracker"
TMDB_API_KEY=""

if [ -f "$CONFIG_PATH" ]; then
    echo "[My Series] Leyendo configuración desde $CONFIG_PATH..."
    POSTGRES_HOST=$(jq -r '.postgres_host // "homeassistant"' "$CONFIG_PATH")
    POSTGRES_PORT=$(jq -r '.postgres_port // 5432' "$CONFIG_PATH")
    POSTGRES_USER=$(jq -r '.postgres_user // "postgres"' "$CONFIG_PATH")
    POSTGRES_PASSWORD=$(jq -r '.postgres_password // ""' "$CONFIG_PATH")
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

echo "[My Series] Conectando a PostgreSQL en $POSTGRES_HOST:$POSTGRES_PORT (base de datos: $POSTGRES_DB)..."

echo "[My Series] Iniciando servidor My Series..."
exec node dist-server/index.js
