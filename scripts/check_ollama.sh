#!/bin/bash

COMPOSE_FILE="/development/cometa/docker-compose_ai.yml"
SERVICE_NAME="ollama.ai"
CONTAINER_NAME="cometa-ai-prod-ollama.ai-1"
HEALTH_CMD="curl -sf localhost:8083"
TIMEOUT_SECONDS=5

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Checking Ollama container health..."

if timeout "$TIMEOUT_SECONDS" docker exec "$CONTAINER_NAME" $HEALTH_CMD >/dev/null 2>&1; then
    log "OK: Ollama is running"
    exit 0
else
    log "ERROR: Ollama is NOT responding. Recreating container..."

    if docker compose -f "$COMPOSE_FILE" up --force-recreate -d "$SERVICE_NAME"; then
        log "OK: Ollama container recreated successfully"
    else
        log "FATAL: Failed to recreate Ollama container"
        exit 1
    fi
fi

