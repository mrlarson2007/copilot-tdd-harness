#!/usr/bin/env bash

set -euo pipefail

mode="${1:-status}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"

os_name="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch_name="$(uname -m)"
case "$arch_name" in
  x86_64|amd64) arch_name="amd64" ;;
  arm64|aarch64) arch_name="arm64" ;;
esac

binary_dir="${repo_root}/.github/bin"
binary_path="${binary_dir}/tdd-run-tests-${os_name}-${arch_name}"

if [ ! -x "$binary_path" ] && command -v go >/dev/null 2>&1; then
  mkdir -p "$binary_dir"
  (cd "$repo_root" && GOOS="$os_name" GOARCH="$arch_name" go build -o "$binary_path" ./cmd/tdd-run-tests)
fi

if [ -x "$binary_path" ]; then
  exec "$binary_path" "$mode"
fi

if command -v go >/dev/null 2>&1; then
  cd "$repo_root"
  exec go run ./cmd/tdd-run-tests "$mode"
fi

cat <<EOF
{
  "event": "Error",
  "decision": "continue",
  "message": "Unable to execute tdd-run-tests CLI: no binary found and Go is not installed."
}
EOF
