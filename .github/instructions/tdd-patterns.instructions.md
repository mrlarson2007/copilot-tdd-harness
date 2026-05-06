---
applyTo: "**/*.go"
description: "Go-specific TDD conventions for this repository, including test naming, commands, and test-double guidance."
---

# Go TDD Patterns

Treat this file as the project-specific source of truth for TDD work in this repository.

## Commands

- For Go changes under `samples/fizzbuzz-go`, run `go test ./...` from that directory.
- Run `go build ./...` from `samples/fizzbuzz-go` only when a build verification step is warranted.
- There is no root Go module for this repository.

Run the narrowest practical command first when validating a small change, but fall back to the configured full test command before ending substantial work.

## File Layout

- Source files are Go files under the repository using `*.go`.
- Tests are package-local files named `*_test.go`.
- Prefer adding tests next to the production code they exercise.

## Test Naming

- Name tests with the Go `Test...` prefix.
- Use the repository convention `TestWhenCondition_ShouldExpectedOutcome`.
- Keep each new TDD cycle to exactly one new test covering exactly one behavior.

Examples:

- `TestWhenModeIsUnsupported_ShouldReturnErrorMode`
- `TestWhenTestsFail_ShouldBlock`

## Assertions

- Use the Go standard library `testing` package.
- Prefer `t.Fatalf` or `t.Fatal` with explicit expected/actual output.
- Keep assertion messages concrete and behavior-focused.

## Stand-ins

- Prefer handwritten fakes or stubs behind small interfaces.
- Use standard library testing tools unless a strong reason exists to add a mock framework.
- Keep stand-ins local to the test package unless they are broadly reusable.

## Repository Notes

- This repo now contains packaged harness assets plus sample Go code under `samples/fizzbuzz-go`.
- Validate Go changes in the owning sample module rather than from the repository root.