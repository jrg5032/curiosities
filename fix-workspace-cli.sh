#!/usr/bin/env bash
# fix-workspace-cli.sh
#
# Installs the Google Workspace CLI (gws) on systems where the npm post-install
# script fails due to proxy issues (HTTP 407).
#
# The npm package @googleworkspace/cli bundles an install.js post-install script
# that downloads a platform-specific binary from GitHub Releases. Behind certain
# proxies, this download fails because install.js does not properly negotiate
# proxy authentication. This script works around the issue by downloading the
# binary directly via curl (which handles proxies correctly) and placing it in
# /usr/local/bin.
#
# Usage: bash fix-workspace-cli.sh
# Ref:   https://github.com/googleworkspace/cli

set -euo pipefail

VERSION="0.22.3"
ARCH="x86_64-unknown-linux-gnu"
BINARY_NAME="gws"
INSTALL_DIR="/usr/local/bin"
RELEASE_URL="https://github.com/googleworkspace/cli/releases/download/v${VERSION}/google-workspace-cli-${ARCH}.tar.gz"
TMP_DIR=$(mktemp -d)

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "Downloading gws v${VERSION} for ${ARCH}..."
curl -fSL -o "${TMP_DIR}/gws.tar.gz" "$RELEASE_URL"

echo "Extracting..."
tar xzf "${TMP_DIR}/gws.tar.gz" -C "$TMP_DIR"

echo "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
cp "${TMP_DIR}/google-workspace-cli-${ARCH}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "Done. Installed $(gws --version)"
