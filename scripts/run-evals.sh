#!/usr/bin/env bash

set -euo pipefail

extended=false
both=false
view=false
config_path=""

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
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--extended|--both|--view|--config <path>]" >&2
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

cd "$eval_dir"

if $view; then
  run_promptfoo "Opening promptfoo results viewer" view
  exit 0
fi

if [[ -n "$config_path" ]]; then
  run_promptfoo "Running promptfoo eval with custom config" eval -c "$config_path"
  exit 0
fi

if $both; then
  run_promptfoo "Running standard promptfoo benchmark" eval
  run_promptfoo "Running extended promptfoo benchmark" eval -c promptfooconfig.extended.yaml
  exit 0
fi

if $extended; then
  run_promptfoo "Running extended promptfoo benchmark" eval -c promptfooconfig.extended.yaml
  exit 0
fi

run_promptfoo "Running standard promptfoo benchmark" eval
