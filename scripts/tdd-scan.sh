#!/usr/bin/env bash

set -euo pipefail

scan_root="${1:-.}"
cd "$scan_root"

json_string() {
  local value="${1//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

json_or_null() {
  if [ -n "${1:-}" ]; then
    json_string "$1"
  else
    printf 'null'
  fi
}

trim_path() {
  local value="$1"
  value="${value#./}"
  printf '%s' "$value"
}

collect_test_files() {
  find . -type f \( \
    -name '*Tests.cs' -o \
    -name '*Test.cs' -o \
    -name '*.test.js' -o \
    -name '*.test.jsx' -o \
    -name '*.test.ts' -o \
    -name '*.test.tsx' -o \
    -name '*.spec.js' -o \
    -name '*.spec.jsx' -o \
    -name '*.spec.ts' -o \
    -name '*.spec.tsx' -o \
    -name 'test_*.py' -o \
    -name '*_test.py' -o \
    -name '*Test.java' -o \
    -name '*Tests.java' \
  \) | sort
}

has_path() {
  find . "$@" -print -quit 2>/dev/null | grep -q .
}

search_in_files() {
  local pattern="$1"
  shift
  local file
  for file in "$@"; do
    [ -f "$file" ] || continue
    if grep -Eq "$pattern" "$file"; then
      return 0
    fi
  done
  return 1
}

test_runner=""
if has_path -maxdepth 2 -type f \( -name '*.sln' -o -name '*.csproj' \); then
  test_runner="dotnet test"
elif [ -f package.json ] && grep -Eq '"vitest"' package.json; then
  test_runner="npx vitest"
elif [ -f package.json ] && grep -Eq '"jest"' package.json; then
  test_runner="npm test"
elif has_path -maxdepth 2 -type f \( -name 'pyproject.toml' -o -name 'requirements.txt' -o -name 'setup.py' \); then
  test_runner="pytest"
elif [ -f pom.xml ]; then
  test_runner="mvn test"
elif has_path -maxdepth 2 -type f \( -name 'build.gradle' -o -name 'build.gradle.kts' \); then
  test_runner="./gradlew test"
fi

mapfile -t test_files < <(collect_test_files)
existing_test_count="${#test_files[@]}"

test_working_dir="."
test_dir=""
if [ "$existing_test_count" -gt 0 ]; then
  test_dir="$(dirname "${test_files[0]}")"
  test_dir="$(trim_path "$test_dir")"
  case "$test_dir" in
    */) ;;
    *) test_dir="${test_dir}/" ;;
  esac
else
  for candidate in tests test __tests__ spec src/test; do
    if [ -d "$candidate" ]; then
      test_dir="${candidate}/"
      break
    fi
  done
fi

naming_pattern=""
sample_files=("${test_files[@]:0:20}")
if [ "${#sample_files[@]}" -gt 0 ]; then
  if search_in_files 'When[A-Za-z0-9_]+_Should[A-Za-z0-9_]+' "${sample_files[@]}"; then
    naming_pattern="WhenCondition_ShouldExpectedOutcome"
  elif search_in_files 'def test_[A-Za-z0-9_]+' "${sample_files[@]}"; then
    naming_pattern="test_function_name"
  elif search_in_files '\b(it|test)\s*\(' "${sample_files[@]}"; then
    naming_pattern="test(\"behavior description\")"
  elif search_in_files '@Test|void [A-Za-z0-9_]+Test\s*\(' "${sample_files[@]}"; then
    naming_pattern="shouldExpectedOutcomeWhenCondition"
  fi
fi

assertion_lib=""
scan_sources=()
while IFS= read -r file; do
  scan_sources+=("$file")
done < <(find . -type f \( \
  -name '*.cs' -o -name '*.csproj' -o \
  -name 'package.json' -o -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o \
  -name 'pyproject.toml' -o -name 'requirements.txt' -o -name '*.py' -o \
  -name 'pom.xml' -o -name 'build.gradle' -o -name 'build.gradle.kts' -o -name '*.java' \
  \) | sort)

if search_in_files 'Shouldly' "${scan_sources[@]}"; then
  assertion_lib="Shouldly"
elif search_in_files 'FluentAssertions' "${scan_sources[@]}"; then
  assertion_lib="FluentAssertions"
elif search_in_files '@testing-library|expect\(' "${scan_sources[@]}"; then
  if [ "$test_runner" = "npx vitest" ]; then
    assertion_lib="Vitest"
  elif [ "$test_runner" = "npm test" ]; then
    assertion_lib="Jest"
  fi
elif search_in_files 'pytest' "${scan_sources[@]}"; then
  assertion_lib="pytest"
elif search_in_files 'assertj|AssertJ|assertThat\(' "${scan_sources[@]}"; then
  assertion_lib="AssertJ"
elif search_in_files 'hamcrest|MatcherAssert' "${scan_sources[@]}"; then
  assertion_lib="Hamcrest"
elif search_in_files 'Assertions\.' "${scan_sources[@]}"; then
  assertion_lib="JUnit"
fi

mock_lib=""
if search_in_files '\bMoq\b' "${scan_sources[@]}"; then
  mock_lib="Moq"
elif search_in_files 'NSubstitute' "${scan_sources[@]}"; then
  mock_lib="NSubstitute"
elif search_in_files 'sinon' "${scan_sources[@]}"; then
  mock_lib="Sinon"
elif search_in_files 'unittest\.mock|from mock import|pytest-mock' "${scan_sources[@]}"; then
  mock_lib="unittest.mock"
elif search_in_files 'Mockito|mockito' "${scan_sources[@]}"; then
  mock_lib="Mockito"
elif search_in_files 'jest\.fn|vi\.fn|vi\.mock|jest\.mock' "${scan_sources[@]}"; then
  mock_lib="Built-in test doubles"
fi

detected=()
[ -n "$test_runner" ] && detected+=("testRunner")
[ -n "$test_dir" ] && detected+=("testDir")
[ -n "$naming_pattern" ] && detected+=("namingPattern")
[ -n "$assertion_lib" ] && detected+=("assertionLib")
[ -n "$mock_lib" ] && detected+=("mockLib")

printf '{\n'
printf '  "testRunner": %s,\n' "$(json_or_null "$test_runner")"
printf '  "testWorkingDir": %s,\n' "$(json_or_null "$test_working_dir")"
printf '  "testDir": %s,\n' "$(json_or_null "$test_dir")"
printf '  "namingPattern": %s,\n' "$(json_or_null "$naming_pattern")"
printf '  "assertionLib": %s,\n' "$(json_or_null "$assertion_lib")"
printf '  "mockLib": %s,\n' "$(json_or_null "$mock_lib")"
printf '  "existingTestCount": %s,\n' "$existing_test_count"
printf '  "detected": ['
for i in "${!detected[@]}"; do
  [ "$i" -gt 0 ] && printf ', '
  json_string "${detected[$i]}"
done
printf ']\n'
printf '}\n'
