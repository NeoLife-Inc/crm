#!/usr/bin/env bash
# CRMA2.8: Sandbox reality check for ARM64 tools box.
# Checks whether the eve Docker image supports ARM64 and advises configuration.
# Run on the tools box: bash apps/agent/scripts/check-sandbox.sh
set -euo pipefail

echo "=== CRMA2.8 Sandbox Reality Check ==="
echo ""

# 1. Check platform
ARCH=$(uname -m)
echo "Platform: ${ARCH}"
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
	echo "Not ARM64 — upstream defaultBackend() auto-selection is fine."
	echo "No override needed."
	exit 0
fi
echo "ARM64 detected — checking sandbox backends..."
echo ""

# 2. Check Docker availability
if command -v docker &>/dev/null; then
	echo "Docker: available"
else
	echo "Docker: NOT installed"
	echo "Recommendation: set NEOLIFE_SANDBOX_BACKEND=bash in /opt/crm/.env"
	exit 0
fi

# 3. Check eve Docker image manifest for ARM64
EVE_IMAGE="ghcr.io/vercel/eve:latest"
echo "Checking manifest: ${EVE_IMAGE}"
MANIFEST=$(docker manifest inspect "$EVE_IMAGE" 2>&1 || true)

if echo "$MANIFEST" | grep -qi "arm64\|aarch64"; then
	echo "  ARM64 support: YES"
	echo "Recommendation: set NEOLIFE_SANDBOX_BACKEND=docker in /opt/crm/.env"
else
	echo "  ARM64 support: NO (or manifest unavailable)"
	echo "Recommendation: set NEOLIFE_SANDBOX_BACKEND=bash in /opt/crm/.env"
fi
echo ""

# 4. Report current env setting
echo "Current NEOLIFE_SANDBOX_BACKEND: ${NEOLIFE_SANDBOX_BACKEND:-<unset>}"
echo ""
echo "=== Check complete ==="
