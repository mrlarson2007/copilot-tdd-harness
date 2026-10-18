#!/usr/bin/env bash
# install-tdd-harness.sh — deploy the TDD harness into any project
#
# Usage: ./scripts/install-tdd-harness.sh [TARGET_DIR] [--agent copilot|codex|both]
#   TARGET_DIR  Directory of the project to install into (default: current directory)
#   --agent     Assistant integration to install (default: copilot)
#
# Safety contract: never overwrites existing files.
# Prints "SKIP: <file> — already exists, merge manually" for conflicts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PACKAGE_DIR="${HARNESS_DIR}/.github"
TARGET_DIR="$(pwd)"
agent="copilot"
target_set=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        --agent)
            if [ "$#" -lt 2 ]; then
                echo "ERROR: --agent requires copilot, codex, or both" >&2
                exit 1
            fi
            agent="$2"
            shift 2
            ;;
        -*)
            echo "ERROR: unknown option: $1" >&2
            exit 1
            ;;
        *)
            if [ "$target_set" = true ]; then
                echo "ERROR: unexpected argument: $1" >&2
                exit 1
            fi
            TARGET_DIR="$1"
            target_set=true
            shift
            ;;
    esac
done
case "$agent" in
    copilot|codex|both) ;;
    *) echo "ERROR: invalid agent: $agent" >&2; exit 1 ;;
esac

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
    if [ "$agent" != copilot ]; then
        local ancestor="$dst"
        while [ "$ancestor" != "." ] && [ "$ancestor" != "/" ]; do
            if [ -L "$ancestor" ]; then
                echo "SKIP: $dst — symbolic link in destination, merge manually"
                skipped=$((skipped + 1))
                return
            fi
            ancestor="$(dirname "$ancestor")"
        done
    fi
    if [ -e "$dst" ]; then
        echo "SKIP: $dst — already exists, merge manually"
        skipped=$((skipped + 1))
    else
        mkdir -p "$(dirname "$dst")"
        if [ "$src" = "-" ]; then
            printf '%s\n' "$3" > "$dst"
        else
            cp "$src" "$dst"
        fi
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
resource_roots=("${PACKAGE_DIR}")
if [ "$agent" = codex ]; then
    resource_roots=("${PACKAGE_DIR}/skills" "${PACKAGE_DIR}/contracts")
fi
while IFS= read -r -d '' src_file; do
    rel_path="${src_file#${PACKAGE_DIR}/}"
    dst_file="${TARGET_DIR}/.github/${rel_path}"
    install_file "$src_file" "$dst_file"
done < <(find "${resource_roots[@]}" -type f \
    ! -path "${PACKAGE_DIR}/instructions/tdd-patterns.instructions.md" \
    -print0)

if [ "$agent" != copilot ]; then
    for skill_file in "${PACKAGE_DIR}"/skills/*/SKILL.md; do
        name="$(basename "$(dirname "$skill_file")")"
        wrapper="---
name: ${name}
description: Load canonical ${name} guidance for the opt-in TDD harness.
---

Read and follow .github/skills/${name}/SKILL.md from the repository root.
Resolve its asset, template, and contract paths from the repository root, not this wrapper.
The canonical .github/skills guidance is authoritative; do not duplicate phase policy here."
        install_file - "${TARGET_DIR}/.agents/skills/${name}/SKILL.md" "$wrapper"
    done
    entry="$(cat <<'EOF'
---
name: tdd
description: Explicit opt-in to the canonical TDD workflow for a feature or fix.
---

Activate only when the user explicitly invokes $tdd or requests this workflow.
Read paths below from the repository root; .github/skills remains authoritative.
First check .github/instructions/tdd-patterns.instructions.md. If absent,
stop and request $tdd-setup before any behavior edits; follow
.github/skills/tdd-setup/SKILL.md and obtain its required user confirmation.
Otherwise load the project instructions before planning or editing.

Load .github/skills/tdd-workflow/SKILL.md and
.github/skills/tdd-planning/SKILL.md. Ask for clarification when scope,
expected behavior, commands, or authorization is ambiguous; do not guess.
Use .github/skills/tdd-cycle-runner/SKILL.md to orchestrate one chosen slice.
Run as a single agent inline. No Copilot task or handoff tools are required:
interpret agent/handoff references as logical phase boundaries, not tool calls.
Use .github/contracts/tdd-cycle-contracts.md as local phase records.

Progressively load the relevant canonical phase guidance and its assets:
- .github/skills/tdd-red/SKILL.md
- .github/skills/tdd-green/SKILL.md
- .github/skills/tdd-test-run/SKILL.md
- .github/skills/tdd-commit/SKILL.md
- .github/skills/tdd-refactor/SKILL.md

Follow the canonical phase policy, not a second copy here. Execute verification
commands with an explicit expected result and inspect actual output after edits;
never claim unrun checks. Stop on unexpected results and apply only the scoped
rollback specified by canonical verification guidance. Make a real atomic
commit immediately after GREEN; assess refactoring, verify and commit it before
the next RED. If commands or commits are blocked, stop and report the blocker.
Report completed slices, tests, commits, and remaining work; clarify whether to
continue after a cycle when the user's requested scope is unclear.
No blocking hooks are installed; this is opt-in guidance, not enforcement.
EOF
)"
    install_file - "${TARGET_DIR}/.agents/skills/tdd/SKILL.md" "$entry"
fi

for rel in "${obsolete_files[@]}"; do
    report_obsolete_file "$rel"
done

echo ""
echo "Install complete: ${installed} files installed, ${skipped} files skipped."
if [ "$obsolete" -gt 0 ]; then
    echo "Obsolete files detected: ${obsolete}. Remove the files listed above to finish upgrading to the single-agent TDD harness."
fi
if [ "$agent" != codex ]; then
    echo "Next steps: Run /tdd-setup in Copilot Chat to generate the project-specific TDD instructions, then switch to the tdd agent when you want the workflow."
fi
if [ "$agent" != copilot ]; then
    echo 'Next steps (Codex CLI/app): Run $tdd-setup, then explicitly invoke $tdd. Restart/reopen the app and check its skill picker if needed.'
fi
