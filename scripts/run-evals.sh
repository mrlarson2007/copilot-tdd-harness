#!/usr/bin/env bash

set -euo pipefail

extended=false
both=false
view=false
config_path=""
models=""
conditions="harness"
repeat=""

usage() {
  cat >&2 <<USAGE
Usage: $0 [--extended|--both|--view|--config <path>]
          [--model <id[,id...]>] [--condition <harness|baseline|both>] [--repeat <n>]

  --model       Copilot model id(s) passed to 'copilot --model'. Comma-separate to
                run several models. Defaults to the Copilot CLI default model.
  --condition   'harness' (default) runs with the TDD agent and skills installed,
                'baseline' runs the default agent with no skills, 'both' runs each.
  --repeat      Number of times promptfoo runs each test case.

Every run also writes evals/promptfoo/results/runs/<stamp>-<config>-<condition>-<model>.json,
which scripts/build-eval-report.js turns into site/data/eval-report.js.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --extended|-e)
      extended=true
      shift
      ;;
    --both|-b)
      both=true
      shift
      ;;
    --view|-v)
      view=true
      shift
      ;;
    --config|-c)
      config_path="${2:-}"
      if [[ -z "$config_path" ]]; then
        echo "Missing value for --config/-c" >&2
        exit 1
      fi
      shift 2
      ;;
    --model|-m)
      models="${2:-}"
      if [[ -z "$models" ]]; then
        echo "Missing value for --model/-m" >&2
        exit 1
      fi
      shift 2
      ;;
    --condition)
      case "${2:-}" in
        harness|baseline) conditions="$2" ;;
        both) conditions="harness baseline" ;;
        *)
          echo "--condition must be harness, baseline, or both" >&2
          exit 1
          ;;
      esac
      shift 2
      ;;
    --repeat|-r)
      repeat="${2:-}"
      if [[ ! "$repeat" =~ ^[1-9][0-9]*$ ]]; then
        echo "--repeat must be a positive integer" >&2
        exit 1
      fi
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if { $extended && $both; } || \
   { [[ -n "$config_path" ]] && { $extended || $both; }; } || \
   { $view && { $extended || $both || [[ -n "$config_path" ]]; }; }; then
  echo "Choose only one mode: default, --extended, --both, --view, or --config <path>." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
eval_dir="$repo_root/evals/promptfoo"
tooling_dir="$repo_root/.promptfoo-tooling"

if [[ ! -f "$tooling_dir/package.json" ]]; then
  echo "Missing .promptfoo-tooling/package.json. Install promptfoo tooling before running evals." >&2
  exit 1
fi

run_promptfoo() {
  local label="$1"
  shift
  echo "==> $label"
  npx --prefix "$tooling_dir" promptfoo "$@"
}

config_output_paths() {
  awk '
    /^[[:space:]]*outputPath:[[:space:]]*$/ { in_output = 1; next }
    in_output && /^[[:space:]]*-[[:space:]]+/ {
      sub(/^[[:space:]]*-[[:space:]]+/, "")
      gsub(/^["\047]|["\047]$/, "")
      print
      next
    }
    in_output && /^[^[:space:]#]/ { exit }
  ' "$1"
}

sanitize() {
  echo "$1" | tr -c 'a-zA-Z0-9._-' '-' | sed 's/-*$//'
}

cd "$eval_dir"

if $view; then
  run_promptfoo "Opening promptfoo results viewer" view
  exit 0
fi

configs=("promptfooconfig.yaml")
if [[ -n "$config_path" ]]; then
  configs=("$config_path")
elif $both; then
  configs=("promptfooconfig.yaml" "promptfooconfig.extended.yaml")
elif $extended; then
  configs=("promptfooconfig.extended.yaml")
fi

IFS=',' read -r -a model_list <<< "${models:-}"
if [[ ${#model_list[@]} -eq 0 ]]; then
  model_list=("")
fi

mkdir -p results/runs
final_status=0

for config in "${configs[@]}"; do
  for condition in $conditions; do
    for model in "${model_list[@]}"; do
      model="$(echo "$model" | xargs)"
      stamp="$(date -u +%Y%m%dT%H%M%SZ)"
      config_name="$(basename "$config" .yaml)"
      run_file="results/runs/${stamp}-$(sanitize "$config_name")-${condition}-$(sanitize "${model:-default}").json"

      outputs=()
      while IFS= read -r output; do
        [[ -n "$output" ]] && outputs+=("$output")
      done < <(config_output_paths "$config")
      outputs+=("$run_file")

      args=(eval -c "$config")
      [[ -n "$repeat" ]] && args+=(--repeat "$repeat")
      args+=(-o "${outputs[@]}")

      set +e
      EVAL_CONDITION="$condition" EVAL_MODEL="$model" \
        run_promptfoo "Running $config_name (condition=$condition, model=${model:-default})" "${args[@]}"
      status=$?
      set -e

      echo "    results: evals/promptfoo/$run_file (exit $status)"
      if [[ $status -ne 0 && $final_status -eq 0 ]]; then
        final_status=$status
      fi
    done
  done
done

exit "$final_status"
