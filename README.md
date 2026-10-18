# Copilot TDD Harness

This repository packages an opt-in GitHub Copilot workflow for strict
test-driven development. The shipped harness is single-agent: the live workflow
agent is [`.github/agents/tdd.agent.md`](.github/agents/tdd.agent.md), with
supporting skills and install scripts for copying the harness into another
project. Initial Codex CLI/app support is also available through opt-in
repository skills; it does not depend on Copilot custom agents.

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

```bash
./scripts/install-tdd-harness.sh <path-to-project>
```

Both installers default to `copilot`. Then, in the target project:

1. Run the `tdd-setup` skill to generate
   `.github/instructions/tdd-patterns.instructions.md`.
2. Switch to the `tdd` agent when you want Copilot to execute a strict TDD
   cycle.

### Codex CLI/app: Initial Milestone

Select `codex` to install only the TDD resources and Codex skills, or `both`
to retain the existing Copilot distribution as well:

```bash
./scripts/install-tdd-harness.sh <path-to-project> --agent codex
./scripts/install-tdd-harness.sh <path-to-project> --agent both
```

```powershell
.\scripts\install-tdd-harness.ps1 -TargetDir <path-to-project> -Agent codex
.\scripts\install-tdd-harness.ps1 -TargetDir <path-to-project> -Agent both
```

The target defaults to the current directory when omitted. Invalid or missing
agent values are rejected before writing files.

In Codex CLI or the app, open the installed target repository and explicitly
invoke `$tdd-setup` first. Confirm the project conventions and verification
commands it proposes. Then invoke `$tdd` with your feature or fix. The entry
skill checks for `.github/instructions/tdd-patterns.instructions.md` before
behavior edits, asks for clarification when needed, and loads the canonical
workflow/planning/phase guidance. It can run phases inline as one agent without
Copilot task/handoff tools, with explicit test verification and real commits.

The installer creates thin, named `.agents/skills/<name>/SKILL.md` wrappers for
every canonical skill (including setup and test-run), plus the `$tdd` entry.
`.github/skills/` remains authoritative; assets and setup templates stay at
their canonical `.github` paths, alongside `.github/contracts/`. Codex-only
installation does not copy Copilot agents, settings, unrelated instructions,
or workflows, and never copies this repository's project-specific patterns.
Setup generates the target project's patterns after confirmation.

Existing files are never merged or overwritten: conflicting canonical files,
assets, and wrappers produce `SKIP` messages for manual merging. Repeat installs
are safe but do not update existing wrappers automatically. `AGENTS.md` and
`.codex/config.toml` are not created or modified. Codex/both installs skip
destinations containing symlinked files or directory ancestors, including
dangling links; review those `SKIP` messages before use.

For an app installation, manually restart/reopen the app and check its skill
picker for `tdd-setup` and `tdd` if they do not appear. Install in the actual
worktree you will open: repository-local files may be absent from another
worktree unless tracked/committed or installed there separately. Do not assume
skill discovery from a different working directory.

This is an **initial support milestone**, not a claim of live integration
validation. Installer parity/resource/safety tests run with Bash and PowerShell;
Codex CLI/app discovery and end-to-end sessions have **not** been live-validated
here. Harness hook integration is not implemented or verified, and no blocking
hooks are installed: this is opt-in guidance, not enforced pre-tool or pre-commit
gating. This is a harness limitation, not a claim that Codex lacks hook support.

Discovery and wrapper metadata were checked against official
[`openai/codex` source at `8c076942`](https://github.com/openai/codex/tree/8c076942cb70fba8e5c4732c23f1faabc4aed484):
[`host_roots.rs`](https://github.com/openai/codex/blob/8c076942cb70fba8e5c4732c23f1faabc4aed484/codex-rs/ext/skills/src/host_roots.rs)
discovers repository `.agents/skills`, and
[`parser.rs`](https://github.com/openai/codex/blob/8c076942cb70fba8e5c4732c23f1faabc4aed484/codex-rs/skills/src/parser.rs)
parses `SKILL.md` frontmatter. Wrappers explicitly supply both `name` and
`description` (the pinned parser requires a description; name is optional with
a directory-name fallback).
Official documentation hosting was unavailable during verification; these
source checks do not establish app-specific UI behavior.

Run installer regressions (Node.js and Bash/`pwsh` required):

```bash
node --test scripts/install-tdd-harness.test.js
```

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
