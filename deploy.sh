#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Only committed code on main is deployed
# ---------------------------------------------------------------------------
# The image is built from this directory (`az acr build .`), so anything
# uncommitted would ship without ever being reviewed, tested by CI, or recorded
# in history. ALLOW_DIRTY_DEPLOY=1 overrides this for an emergency.
# (Same rule as crabcut-backend/scripts/deploy-azure.mjs.)
if [[ "${ALLOW_DIRTY_DEPLOY:-}" != "1" ]]; then
  if ! _dirty="$(git status --porcelain 2>/dev/null)" || ! _branch="$(git branch --show-current 2>/dev/null)"; then
    echo "Could not read git state; refusing to deploy. Set ALLOW_DIRTY_DEPLOY=1 to override." >&2
    exit 1
  fi
  if [[ -n "$_dirty" ]]; then
    echo "Refusing to deploy: there are uncommitted changes." >&2
    echo "$_dirty" >&2
    exit 1
  fi
  if [[ "$_branch" != "main" ]]; then
    echo "Refusing to deploy from branch \"$_branch\"; deploy from main." >&2
    exit 1
  fi
fi

REGISTRY="crabcutacr"
IMAGE="mcp-server"
APP_NAME="crabcut-mcp-server"
RESOURCE_GROUP="crabcut-rg"

if [[ "${ENABLE_MCP_SERVER_DEPLOY:-}" != "true" ]]; then
  echo "MCP server deploy is disabled. Set ENABLE_MCP_SERVER_DEPLOY=true to deploy $APP_NAME."
  exit 1
fi

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
  --environment crabcut-env \
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
