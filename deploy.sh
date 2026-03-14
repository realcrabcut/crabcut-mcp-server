#!/usr/bin/env bash
set -euo pipefail

REGISTRY="crabcutacr"
IMAGE="mcp-server"
APP_NAME="crabcut-mcp-server"
RESOURCE_GROUP="crabcut-rg"

TAG="v$(date +%Y%m%d-%H%M%S)"

echo "==> Building and pushing $REGISTRY.azurecr.io/$IMAGE:$TAG ..."
az acr build --registry "$REGISTRY" --image "$IMAGE:$TAG" .

echo "==> Deploying container app $APP_NAME with $IMAGE:$TAG ..."
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --image "$REGISTRY.azurecr.io/$IMAGE:$TAG" \
  --cpu 1 \
  --memory 2Gi \
  --min-replicas 0 \
  --max-replicas 2 \
2>/dev/null \
|| az containerapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment crabcut-mcp-env \
  --image "$REGISTRY.azurecr.io/$IMAGE:$TAG" \
  --registry-server "$REGISTRY.azurecr.io" \
  --target-port 8080 \
  --ingress external \
  --cpu 1 \
  --memory 2Gi \
  --min-replicas 0 \
  --max-replicas 2

FQDN=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)

echo "==> Deployed $IMAGE:$TAG"
echo "    MCP Endpoint: https://$FQDN/mcp"
