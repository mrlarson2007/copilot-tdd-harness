#!/usr/bin/env bash
# install-tdd-harness.sh — deploy the TDD harness into any project
#
# Usage: ./scripts/install-tdd-harness.sh [TARGET_DIR]
#   TARGET_DIR  Directory of the project to install into (default: current directory)
#
# Safety contract: never overwrites existing files.
# Prints "SKIP: <file> — already exists, merge manually" for conflicts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PACKAGE_DIR="${HARNESS_DIR}/.github"
TARGET_DIR="${1:-$(pwd)}"

installed=0
skipped=0
obsolete=0

obsolete_files=(
    ".github/tdd-config.json"
    ".github/agents/tdd-red.agent.md"
    ".github/agents/tdd-green.agent.md"
    ".github/agents/tdd-commit.agent.md"
    ".github/agents/tdd-refactor.agent.md"
    ".github/prompts/tdd-start.prompt.md"
    ".github/prompts/tdd-status.prompt.md"
    ".github/hooks/tdd-enforcement.json"
    "scripts/tdd-run-tests"
    "scripts/tdd-run-tests.sh"
    "scripts/tdd-run-tests.ps1"
)

install_file() {
    local src="$1"
    local dst="$2"
    if [ -e "$dst" ]; then
        echo "SKIP: $dst — already exists, merge manually"
        skipped=$((skipped + 1))
    else
        mkdir -p "$(dirname "$dst")"
        cp "$src" "$dst"
        echo "INSTALL: $dst"
        installed=$((installed + 1))
    fi
}

report_obsolete_file() {
    local rel="$1"
    local dst="${TARGET_DIR}/${rel}"
    if [ -e "$dst" ]; then
        echo "REMOVE: $dst — obsolete in the single-agent TDD harness"
        obsolete=$((obsolete + 1))
    fi
}

# Install packaged .github files, excluding project-specific setup files
while IFS= read -r -d '' src_file; do
    rel_path="${src_file#${PACKAGE_DIR}/}"
    dst_file="${TARGET_DIR}/.github/${rel_path}"
    install_file "$src_file" "$dst_file"
done < <(find "${PACKAGE_DIR}" -type f \
    ! -path "${PACKAGE_DIR}/instructions/tdd-patterns.instructions.md" \
    -print0)

for rel in "${obsolete_files[@]}"; do
    report_obsolete_file "$rel"
done

echo ""
echo "Install complete: ${installed} files installed, ${skipped} files skipped."
if [ "$obsolete" -gt 0 ]; then
    echo "Obsolete files detected: ${obsolete}. Remove the files listed above to finish upgrading to the single-agent TDD harness."
fi
echo "Next steps: Run /tdd-setup in Copilot Chat to generate the project-specific TDD instructions, then switch to the tdd agent when you want the workflow."
