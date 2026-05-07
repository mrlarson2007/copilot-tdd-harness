---
applyTo: "**/*.go"
description: "Go TDD conventions for the calculator-cli-go fixture."
---

# Go TDD Patterns

## Commands

- Run tests with: `go test ./...`
- Build with: `go build ./...`

## File Naming

- Test files: `*_test.go` (e.g., `main_test.go`)
- Production files: `*.go` (e.g., `main.go`)

## Test Naming

- Use the `TestSubject_WhenCondition_ShouldExpectedOutcome` pattern.
- Prefix all test functions with `Test`.
- One test per TDD cycle covering exactly one behavior.

## Assertions

- Use the standard library `testing` package.
- Prefer `t.Errorf` or `t.Fatalf` with explicit expected and actual values.
