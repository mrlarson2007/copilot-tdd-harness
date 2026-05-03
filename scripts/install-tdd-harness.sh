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

# Install run-tests wrapper scripts
for script in "tdd-run-tests.sh" "tdd-run-tests.ps1"; do
    install_file "${HARNESS_DIR}/scripts/${script}" "${TARGET_DIR}/scripts/${script}"
done

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
echo "Next steps: Run /tdd-setup in Copilot Chat to complete configuration."
