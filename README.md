# Copilot TDD Harness

This repository packages an opt-in GitHub Copilot workflow for strict
test-driven development. The shipped harness is single-agent: the live workflow
agent is [`.github/agents/tdd.agent.md`](.github/agents/tdd.agent.md), with
supporting skills and install scripts for copying the harness into another
project.

## What It Includes

- A single `tdd` agent that enforces RED -> GREEN -> COMMIT -> REFACTOR
  discipline.
- Setup and scanning scripts for tailoring the harness to a target project.
- Promptfoo-based evals for scoring protocol fidelity, clarification behavior,
  and commit discipline against disposable fixture repositories.
- Packaged plugin assets under [`plugin/`](plugin/) for installation and
  release flows.

## Repository Layout

- [`.github/`](.github/) contains the live agent, skills, and repository
  instructions.
- [`scripts/`](scripts/) contains install, scan, and eval helper scripts.
- [`evals/`](evals/) contains promptfoo configs, assertions, fixtures, and run
  summaries.
- [`plugin/`](plugin/) contains the distributable `.github` package used by the
  installer.
- [`samples/`](samples/) contains small example projects used to shape and
  verify harness behavior.

## Quick Start

Install the harness into another project from this repository root:

```powershell
.\scripts\install-tdd-harness.ps1 -TargetDir <path-to-project>
```

Then, in the target project:

1. Run the `tdd-setup` skill to generate
   `.github/instructions/tdd-patterns.instructions.md`.
2. Switch to the `tdd` agent when you want Copilot to execute a strict TDD
   cycle.

## Running Evals

The eval suite uses the local promptfoo install in [`.promptfoo-tooling/`](.promptfoo-tooling/).

Run the standard benchmark:

```powershell
.\scripts\run-evals.ps1
```

Run the extended drift benchmark:

```powershell
.\scripts\run-evals.ps1 -Extended
```

Run both modes back-to-back:

```powershell
.\scripts\run-evals.ps1 -Both
```

Open the latest promptfoo results viewer:

```powershell
.\scripts\run-evals.ps1 -View
```

For more detail on the eval setup, see [`evals/promptfoo/README.md`](evals/promptfoo/README.md).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
