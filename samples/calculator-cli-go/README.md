# calculator-cli-go

Baseline fixture for the TDD agent benchmark matrix (issue #10).

## Purpose

This fixture is the first "real" CLI benchmark target. It exercises:

- argument parsing
- exit codes
- multiple subcommands
- input validation

It is deliberately small at baseline so that scenarios can drive feature
additions, validation edges, and bug-fix regressions from a known-clean
starting point.

## Baseline behavior

- `calc add <a> <b>` prints `a + b`.
- Unknown commands exit with code `2`.
- Non-integer arguments exit with code `2`.

## Running tests

```text
go test ./...
```

## Scenarios

Scenario manifests for this fixture live in
[`evals/scenarios/calculator-cli-go/`](../../evals/scenarios/calculator-cli-go/).
