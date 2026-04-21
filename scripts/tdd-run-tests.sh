#!/usr/bin/env bash

set -euo pipefail

mode="${1:-status}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
cd "${repo_root}"

json_escape() {
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

json_string() {
  printf '"%s"' "$(json_escape "${1:-}")"
}

json_number() {
  local value="${1:-0}"
  if [[ "$value" =~ ^[0-9]+$ ]]; then
    printf '%s' "$value"
  else
    printf '0'
  fi
}

json_bool() {
  if [ "${1:-false}" = "true" ]; then
    printf 'true'
  else
    printf 'false'
  fi
}

to_lower() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]'
}

first_number() {
  local pattern="$1"
  local text="$2"
  local match
  match="$(printf '%s' "$text" | grep -Eo "$pattern" | head -n 1 || true)"
  if [ -n "$match" ]; then
    printf '%s' "$match" | grep -Eo '[0-9]+' | head -n 1
  fi
}

config_test_command=""
config_test_working_dir=""
if [ -f ".github/tdd-config.json" ] && command -v python3 >/dev/null 2>&1; then
  config_values="$(python3 - <<'PY'
import json
from pathlib import Path
path = Path(".github/tdd-config.json")
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception:
    data = {}
print(data.get("testCommand", ""))
print(data.get("testWorkingDir", ""))
PY
)" || true
  config_test_command="$(printf '%s' "$config_values" | sed -n '1p')"
  config_test_working_dir="$(printf '%s' "$config_values" | sed -n '2p')"
fi

test_command="${TDD_TEST_COMMAND:-$config_test_command}"
test_working_dir="${TDD_TEST_WORKING_DIR:-$config_test_working_dir}"

if [ -z "$test_command" ]; then
  if find . -maxdepth 2 -type f \( -name '*.sln' -o -name '*.csproj' \) -print -quit 2>/dev/null | grep -q .; then
    test_command="dotnet test"
  elif [ -f package.json ] && grep -q '"vitest"' package.json; then
    test_command="npx vitest run"
  elif [ -f package.json ] && grep -q '"jest"' package.json; then
    test_command="npm test -- --runInBand"
  elif find . -maxdepth 2 -type f \( -name 'pyproject.toml' -o -name 'requirements.txt' -o -name 'setup.py' \) -print -quit 2>/dev/null | grep -q .; then
    test_command="pytest"
  elif [ -f pom.xml ]; then
    test_command="mvn test"
  elif find . -maxdepth 2 -type f \( -name 'build.gradle' -o -name 'build.gradle.kts' \) -print -quit 2>/dev/null | grep -q .; then
    test_command="./gradlew test"
  fi
fi

if [ -z "$test_working_dir" ]; then
  test_working_dir="."
fi

passed=0
failed=0
test_output=""
test_exit_code=0

if [ -n "$test_command" ]; then
  set +e
  test_output="$(cd "$test_working_dir" && eval "$test_command" 2>&1)"
  test_exit_code=$?
  set -e

  passed="$(first_number '[0-9]+[[:space:]]+(passed|passing)' "$test_output")"
  failed="$(first_number '[0-9]+[[:space:]]+(failed|failing)' "$test_output")"

  if [ -z "${passed:-}" ]; then
    passed="$(first_number 'passed:[[:space:]]*[0-9]+' "$test_output")"
  fi
  if [ -z "${failed:-}" ]; then
    failed="$(first_number 'failed:[[:space:]]*[0-9]+' "$test_output")"
  fi
  if [ -z "${failed:-}" ]; then
    failed="$(first_number 'Failures:[[:space:]]*[0-9]+' "$test_output")"
  fi

  passed="${passed:-0}"
  failed="${failed:-0}"

  if [ "$test_exit_code" -ne 0 ] && [ "$failed" -eq 0 ]; then
    failed=1
  fi
fi

git_message="$(git log -1 --pretty=%s 2>/dev/null || true)"
phase="${TDD_PHASE:-}"
if [ -z "$phase" ]; then
  case "$(to_lower "$git_message")" in
    *red*) phase="RED" ;;
    *green*) phase="GREEN" ;;
    *refactor*) phase="REFACTOR" ;;
    *commit*) phase="COMMIT" ;;
    *) if [ "$failed" -gt 0 ]; then phase="GREEN"; else phase="REFACTOR"; fi ;;
  esac
fi

first_failure_test=""
if [ "$failed" -gt 0 ]; then
  first_failure_test="$(printf '%s' "$test_output" | sed -n -E 's/^--- FAIL: ([^[:space:]:()]+).*/\1/p' | head -n 1)"
  if [ -z "$first_failure_test" ]; then
    first_failure_test="$(printf '%s' "$test_output" | sed -n -E 's/^[[:space:]]*✕[[:space:]]+(.+)$/\1/p' | head -n 1)"
  fi
  if [ -z "$first_failure_test" ]; then
    first_failure_test="$(printf '%s' "$test_output" | sed -n -E 's/^[[:space:]]*[0-9]+\)[[:space:]]+(.+)$/\1/p' | head -n 1)"
  fi
fi
if [ "$failed" -gt 0 ] && [ -z "$first_failure_test" ]; then
  first_failure_test="UnknownTest"
fi

expected=""
actual=""
if [ "$failed" -gt 0 ]; then
  expected="$(printf '%s' "$test_output" | sed -n -E 's/.*[Ee]xpected[:[:space:]]+(.+)/\1/p' | head -n 1)"
  actual="$(printf '%s' "$test_output" | sed -n -E 's/.*([Rr]eceived|[Aa]ctual)[:[:space:]]+(.+)/\2/p' | head -n 1)"
  if [ -z "$expected" ]; then expected="expected behavior"; fi
  if [ -z "$actual" ]; then actual="actual behavior differs"; fi
fi

likely_cause="the implementation for this behavior is incomplete"
hypothesis="update the production code minimally to satisfy the failing assertion, then rerun tests"
if [ "$failed" -gt 0 ]; then
  test_output_lower="$(to_lower "$test_output")"
  if [[ "$test_output_lower" == *"expected"* ]] && ([[ "$test_output_lower" == *"actual"* ]] || [[ "$test_output_lower" == *"received"* ]]); then
    likely_cause="assertion mismatch indicates current behavior differs from test expectation"
    hypothesis="adjust the implementation branch used by the failing test, then rerun tests"
  elif [[ "$test_output_lower" == *"command not found"* ]] || [[ "$test_output_lower" == *"is not recognized as"* ]]; then
    likely_cause="configured test command is unavailable in the current environment"
    hypothesis="fix testCommand/testWorkingDir configuration and rerun tests"
  elif [[ "$test_output_lower" == *"module not found"* ]] || [[ "$test_output_lower" == *"cannot find module"* ]] || [[ "$test_output_lower" == *"importerror"* ]]; then
    likely_cause="missing dependency or unresolved import in test execution path"
    hypothesis="install or restore required dependencies and rerun tests"
  fi
fi
if [ "$failed" -gt 0 ]; then
  reflexion="REFLEXION: ${first_failure_test} failed. Expected ${expected}, got ${actual}. Likely cause: ${likely_cause}. Hypothesis: ${hypothesis}."
else
  reflexion="REFLEXION: All tests passed. Continue with strict phase discipline."
fi

phase_constraint="follow the current phase rule strictly and keep changes minimal."
case "$phase" in
  RED) phase_constraint="write exactly one failing test and avoid production changes." ;;
  GREEN) phase_constraint="write only the minimal production code needed to make the failing test pass." ;;
  REFACTOR) phase_constraint="refactor only while all tests remain green and behavior stays unchanged." ;;
  COMMIT) phase_constraint="commit test and production changes together for one completed behavior." ;;
esac

stop_hook_active_raw="${STOP_HOOK_ACTIVE:-${stop_hook_active:-false}}"
stop_hook_active="$(to_lower "$stop_hook_active_raw")"
if [ "$stop_hook_active" = "1" ] || [ "$stop_hook_active" = "yes" ]; then
  stop_hook_active="true"
fi
if [ "$stop_hook_active" != "true" ]; then
  stop_hook_active="false"
fi

emit_hint() {
  printf '{\n'
  printf '  "event": "UserPromptSubmit",\n'
  printf '  "additionalContext": %s,\n' "$(json_string "HINT: Current phase is ${phase}. The single constraint: ${phase_constraint}")"
  printf '  "decision": "continue"\n'
  printf '}\n'
}

emit_step() {
  printf '{\n'
  printf '  "event": "PostToolUse",\n'
  printf '  "phase": %s,\n' "$(json_string "$phase")"
  printf '  "passed": %s,\n' "$(json_number "$passed")"
  printf '  "failed": %s,\n' "$(json_number "$failed")"
  printf '  "failures": [\n'
  if [ "$failed" -gt 0 ]; then
    printf '    {\n'
    printf '      "testName": %s,\n' "$(json_string "$first_failure_test")"
    printf '      "expected": %s,\n' "$(json_string "$expected")"
    printf '      "actual": %s,\n' "$(json_string "$actual")"
    printf '      "cause": %s\n' "$(json_string "$likely_cause")"
    printf '    }\n'
  fi
  printf '  ],\n'
  printf '  "reflexion": %s\n' "$(json_string "$reflexion")"
  printf '}\n'
}

emit_terminal() {
  if [ "$stop_hook_active" = "true" ]; then
    printf '{\n'
    printf '  "event": "Stop",\n'
    printf '  "passed": %s,\n' "$(json_number "$passed")"
    printf '  "failed": %s,\n' "$(json_number "$failed")"
    printf '  "decision": "allow",\n'
    printf '  "stop_hook_active": true,\n'
    printf '  "message": %s\n' "$(json_string "stop_hook_active=true, skipping terminal enforcement to prevent recursion.")"
    printf '}\n'
    return
  fi

  if [ "$failed" -gt 0 ]; then
    decision="block"
    if [ "$failed" -eq 1 ]; then
      message="1 test failing. Run tests and make them pass before finishing."
    else
      message="${failed} tests failing. Run tests and make them pass before finishing."
    fi
  else
    decision="allow"
    if [ -n "$test_command" ]; then
      message="All ${passed} tests pass. GREEN phase complete."
    else
      message="No test command configured; terminal hook allows progress."
    fi
  fi

  printf '{\n'
  printf '  "event": "Stop",\n'
  printf '  "passed": %s,\n' "$(json_number "$passed")"
  printf '  "failed": %s,\n' "$(json_number "$failed")"
  printf '  "decision": %s,\n' "$(json_string "$decision")"
  printf '  "stop_hook_active": %s,\n' "$(json_bool "$stop_hook_active")"
  printf '  "message": %s\n' "$(json_string "$message")"
  printf '}\n'
}

emit_state() {
  local state_test="$first_failure_test"
  local state_reflexion="$likely_cause"
  if [ "$failed" -eq 0 ]; then
    state_test="None"
    state_reflexion="all tests passing"
  fi
  printf '{\n'
  printf '  "event": "PreCompact",\n'
  printf '  "additionalContext": %s\n' "$(json_string "TDD STATE: phase=${phase} | test=${state_test} | lastReflexion=${state_reflexion} | passed=${passed} | failed=${failed}")"
  printf '}\n'
}

emit_status() {
  if [ "$failed" -gt 0 ]; then
    next_action="Continue GREEN phase: make the failing test pass with the minimal production change."
  else
    next_action="All tests are passing. Continue with COMMIT or REFACTOR discipline."
  fi

  printf '{\n'
  printf '  "event": "Status",\n'
  printf '  "phase": %s,\n' "$(json_string "$phase")"
  printf '  "passed": %s,\n' "$(json_number "$passed")"
  printf '  "failed": %s,\n' "$(json_number "$failed")"
  printf '  "failingTests": ['
  if [ "$failed" -gt 0 ]; then
    printf '%s' "$(json_string "$first_failure_test")"
  fi
  printf '],\n'
  printf '  "lastCommittedBehavior": %s,\n' "$(json_string "$git_message")"
  printf '  "recommendedNextAction": %s,\n' "$(json_string "$next_action")"
  printf '  "testCommand": %s,\n' "$(json_string "$test_command")"
  printf '  "testWorkingDir": %s,\n' "$(json_string "$test_working_dir")"
  printf '  "testExitCode": %s\n' "$(json_number "$test_exit_code")"
  printf '}\n'
}

case "$mode" in
  hint) emit_hint ;;
  step) emit_step ;;
  terminal) emit_terminal ;;
  state) emit_state ;;
  status) emit_status ;;
  *)
    printf '{\n'
    printf '  "event": "Error",\n'
    printf '  "decision": "continue",\n'
    printf '  "message": %s\n' "$(json_string "Unsupported mode: ${mode}. Supported modes are hint, step, terminal, state, status.")"
    printf '}\n'
    ;;
esac
