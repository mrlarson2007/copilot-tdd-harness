# Copilot TDD Harness

This repository packages an opt-in GitHub Copilot workflow for strict
test-driven development. The shipped harness is single-agent: the live workflow
agent is [`.github/agents/tdd.agent.md`](.github/agents/tdd.agent.md), with
supporting skills and install scripts for copying the harness into another
project.

## What It Includes

- A single `tdd` agent that enforces RED -> GREEN -> COMMIT -> REFACTOR
  discipline.
- Setup and evaluation scripts for tailoring and validating the harness.
- Promptfoo-based evals for scoring protocol fidelity, clarification behavior,
  and commit discipline against disposable fixture repositories.

## Repository Layout

- [`.github/`](.github/) contains the live agent, skills, and repository
  instructions. This is also the distributable package copied into target
  projects by the installer.
- [`scripts/`](scripts/) contains install and eval helper scripts.
- [`evals/`](evals/) contains promptfoo configs, assertions, fixtures, and run
  summaries.
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

```bash
./scripts/run-evals.sh
```

Run the extended drift benchmark:

```powershell
.\scripts\run-evals.ps1 -Extended
```

```bash
./scripts/run-evals.sh --extended
```

Run both modes back-to-back:

```powershell
.\scripts\run-evals.ps1 -Both
```

```bash
./scripts/run-evals.sh --both
```

Open the latest promptfoo results viewer:

```powershell
.\scripts\run-evals.ps1 -View
```

```bash
./scripts/run-evals.sh --view
```

For more detail on the eval setup, see [`evals/promptfoo/README.md`](evals/promptfoo/README.md).

## CI Pipeline (Main Branch)

This repository includes a GitHub Actions pipeline at
[`/.github/workflows/main-evals-release.yml`](.github/workflows/main-evals-release.yml).

On push to `master` or `main` (including branch merges), it will:

1. Install promptfoo tooling.
2. Run the standard eval suite.
3. Run the extended eval suite.
4. Upload eval result artifacts.
5. Create a GitHub Release with a versioned zip package when evals pass.

## Versioning And Downloadable Zip

The release job uses git tags in `vMAJOR.MINOR.PATCH` format.

- If no prior `v*` tag exists, the first release is `v0.1.0`.
- Otherwise, each successful main-branch run auto-increments the patch version.
- You can manually run the workflow and set `release_version` to force a
  specific version.

Each release includes a downloadable zip asset named:

- `copilot-tdd-harness-<version>.zip`

The zip contains:

- `.github/`
- installer and evaluation scripts in `scripts/`
- `README.md`
- `LICENSE`

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
