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
TARGET_DIR="${1:-$(pwd)}"

installed=0
skipped=0
obsolete=0

obsolete_files=(
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

current_os() {
    local os_name
    os_name="$(uname -s | tr '[:upper:]' '[:lower:]')"
    case "$os_name" in
        mingw*|msys*|cygwin*) echo "windows" ;;
        darwin*) echo "darwin" ;;
        linux*) echo "linux" ;;
        *) echo "$os_name" ;;
    esac
}

current_arch() {
    local arch_name
    arch_name="$(uname -m)"
    case "$arch_name" in
        x86_64|amd64) echo "amd64" ;;
        arm64|aarch64) echo "arm64" ;;
        *) echo "$arch_name" ;;
    esac
}

# Install harness .github files, excluding repo-only files
while IFS= read -r -d '' src_file; do
    rel_path="${src_file#${HARNESS_DIR}/}"
    dst_file="${TARGET_DIR}/${rel_path}"
    install_file "$src_file" "$dst_file"
done < <(find "${HARNESS_DIR}/.github" -type f \
    ! -name "settings.yml" \
    ! -path "*/workflows/*" \
    ! -path "*/bin/*" \
    -print0 | sort -z)

for rel in "${obsolete_files[@]}"; do
    report_obsolete_file "$rel"
done

# Install platform CLI binary
binary_os="$(current_os)"
binary_arch="$(current_arch)"
binary_name="tdd-run-tests-${binary_os}-${binary_arch}"
if [ "$binary_os" = "windows" ]; then
    binary_name="${binary_name}.exe"
fi
binary_src="${HARNESS_DIR}/.github/bin/${binary_name}"
binary_dst="${TARGET_DIR}/.github/bin/${binary_name}"

if [ -e "$binary_src" ]; then
    install_file "$binary_src" "$binary_dst"
    chmod +x "$binary_dst" 2>/dev/null || true
else
    echo "SKIP: ${binary_dst} — no bundled CLI binary available for ${binary_os}/${binary_arch}"
    skipped=$((skipped + 1))
fi

# Write tdd-config.json only if not already present
config_file="${TARGET_DIR}/.github/tdd-config.json"
if [ ! -e "$config_file" ]; then
    test_command=""

    # Auto-detect test runner from project files
    if compgen -G "${TARGET_DIR}/*.sln" > /dev/null 2>&1 || \
       compgen -G "${TARGET_DIR}/*.csproj" > /dev/null 2>&1; then
        test_command="dotnet test"
    elif [ -f "${TARGET_DIR}/package.json" ]; then
        if grep -q '"jest"\s*:' "${TARGET_DIR}/package.json"; then
            test_command="npm test"
        elif grep -q '"vitest"\s*:' "${TARGET_DIR}/package.json"; then
            test_command="npx vitest"
        fi
    elif [ -f "${TARGET_DIR}/pyproject.toml" ] || [ -f "${TARGET_DIR}/setup.py" ]; then
        test_command="pytest"
    elif [ -f "${TARGET_DIR}/pom.xml" ]; then
        test_command="mvn test"
    elif [ -f "${TARGET_DIR}/build.gradle" ]; then
        test_command="./gradlew test"
    fi

    mkdir -p "${TARGET_DIR}/.github"
    cat > "$config_file" <<EOF
{
  "testCommand": "${test_command}"
}
EOF

    if [ -n "$test_command" ]; then
        echo "INSTALL: $config_file (detected: ${test_command})"
    else
        echo "INSTALL: $config_file (no runner detected — set testCommand manually)"
    fi
    installed=$((installed + 1))
else
    echo "SKIP: $config_file — already exists, merge manually"
    skipped=$((skipped + 1))
fi

echo ""
echo "Install complete: ${installed} files installed, ${skipped} files skipped."
if [ "$obsolete" -gt 0 ]; then
    echo "Obsolete files detected: ${obsolete}. Remove the files listed above to finish upgrading to the single-agent TDD harness."
fi
echo "Next steps: Run /tdd-setup in Copilot Chat to complete configuration, then switch to the tdd agent when you want the workflow. The CLI binary is installed under .github/bin/."
