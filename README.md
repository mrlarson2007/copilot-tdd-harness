# Copilot TDD Harness

This repository packages an opt-in GitHub Copilot workflow for strict
test-driven development. Install the complete bundle through its self-hosted
Copilot CLI plugin marketplace, or use the existing manual project installers.
The plugin's [`tdd` agent](plugin/agents/tdd.agent.md) runs the bundled phase
skills in one agent; no separate phase agents are required.

## What It Includes

- A single `tdd` agent that enforces RED -> GREEN -> COMMIT -> REFACTOR
  discipline.
- Ten skills, including requirements planning, project setup, and verification.
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
- [`site/`](site/) contains the public eval report pages. They show sample data
  until you build real results. See [`site/README.md`](site/README.md).

## Quick Start

### Copilot CLI marketplace (recommended)

Use a current [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli)
with plugin support. The marketplace lifecycle is tested with CLI `1.0.103`.
Running the AI workflow also requires Copilot authentication/access, Git, and
your project's own test/build tools. Installation itself does not run setup,
change project files, or opt you into TDD.

After these changes are merged into the repository's default branch:

```bash
copilot plugin marketplace add mrlarson2007/copilot-tdd-harness
copilot plugin marketplace browse copilot-tdd-harness
copilot plugin install copilot-tdd-harness@copilot-tdd-harness
copilot plugin list
```

In your target project, start a new Copilot session:

1. Use `/skills list` to verify the ten harness skills are available.
2. Ask Copilot to run the `tdd-setup` skill. Review and confirm the proposed
   configuration before it writes anything.
3. Use `/agent` to select `tdd`, then request one cycle or ask it to continue
   through your feature. Alternatively, explicitly request the `tdd-workflow`
   skill. Installing the plugin alone does not activate the workflow.

Setup writes only to the **working project**:

- `.github/instructions/tdd-patterns.instructions.md`
- `.github/tdd-harness/project-testing-patterns.md`
- `.github/tdd-harness/project-code-style-patterns.md`
- `.github/tdd-harness/project-refactor-patterns.md`
- `.github/tdd-harness/project-test-run-patterns.md`

Installed skills, templates, and default assets are read-only. Existing project
files require explicit confirmation before replacement. Phase skills prefer
the new project-local patterns, then legacy manually installed phase assets,
then bundled defaults. Plugin updates and removal do not remove these files.

Update or uninstall:

```bash
copilot plugin marketplace update copilot-tdd-harness
copilot plugin update copilot-tdd-harness
copilot plugin uninstall copilot-tdd-harness
copilot plugin marketplace remove copilot-tdd-harness
```

The last command unregisters the marketplace; uninstall its plugin first.
These commands never clean up project-owned configuration or manual skills.
If you already installed the harness manually, back up your customizations and
choose one active installation to avoid duplicate `tdd` agents/skills. Compare
`copilot skill list --json` sources before removing any manually installed files;
the plugin does not overwrite or migrate them automatically.

### Manual project installation

From a repository checkout or the **manual-install** release zip, install into
another project:

```powershell
.\scripts\install-tdd-harness.ps1 -TargetDir <path-to-project>
```

```bash
./scripts/install-tdd-harness.sh <path-to-project>
```

Then, in the target project:

1. Run the `tdd-setup` skill to generate
   `.github/instructions/tdd-patterns.instructions.md`.
2. Switch to the `tdd` agent when you want Copilot to execute a strict TDD
   cycle.

## Running Evals

[**Latest evaluation results**](https://mrlarson2007.github.io/copilot-tdd-harness/)
— published Jev HTML scorecard and sanitized standalone Promptfoo report from
the latest successfully published **Jev Live Evaluation** run. The landing page
identifies its timestamp, commit, and Actions run; incomplete runs leave the
previous publication unchanged. See [Pages setup](evals/promptfoo/README.md#published-html-reports-github-pages).

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

Compare models, with and without the harness (`--condition harness|baseline|both`,
`--model` takes a comma-separated list, `--repeat` sets trials per test):

```bash
./scripts/run-evals.sh --condition both --model claude-sonnet-4.5,gpt-5 --repeat 3
./scripts/run-evals.sh --view  # open the native Promptfoo report for that model/condition matrix
node scripts/build-eval-report.js   # updates site/data/eval-report.js for the dashboard
```

```powershell
.\scripts\run-evals.ps1 -Condition both -Model claude-sonnet-4.5,gpt-5 -Repeat 3
```

The native Promptfoo report contains every model × condition as a provider, with
scenario-level outputs and assertion details. The static `site/` dashboard is a
separate aggregated view.

For more detail on the eval setup, see [`evals/promptfoo/README.md`](evals/promptfoo/README.md).
To publish results on the report site, see [`site/README.md`](site/README.md).

## Plugin development and validation

The root `plugin.json` deliberately uses the supported **legacy Copilot plugin
format** so both marketplace and direct development installs load the canonical
`.github/skills/` tree without generated duplicates. Its only component paths
are `.github/skills/` and `plugin/agents/`; repository workflows, instructions,
evals, and report files are not plugin components. A Git-backed installation
may cache the source repository, but only those declared components are loaded.

Build a minimal distributable into a **new** directory (Node.js 22+):

```bash
node scripts/build-copilot-plugin.js --check
node scripts/build-copilot-plugin.js /tmp/copilot-tdd-harness-plugin
copilot plugin install /tmp/copilot-tdd-harness-plugin
```

The output contains only `plugin.json`, `.github/skills/` including bundled assets
and templates, `plugin/agents/`, `README.md`, and `LICENSE`. It excludes project
configuration, workflows, evals, installers, and reports. The builder refuses
existing output directories, source-tree destinations other than `dist/`,
symlinked package files, mismatched versions, and missing bundled references.
Direct local installs are intended for development; use marketplace installs
for normal use. Reinstall a local package after rebuilding it because direct
installs are cached.

Run the existing script tests:

```bash
node --test scripts/*.test.js
```

The plugin tests run an isolated local-marketplace CLI smoke test when `copilot`
is on PATH. Set `COPILOT_PLUGIN_TEST_CLI` to an absolute executable path if needed.
They check discovery of all ten skills, a version update, uninstall, and
preservation of project patterns and existing manual skills. They also check
both manual installers when their shells are available.

The smoke test does **not** make model calls or prove an actual TDD cycle.
Before publishing, use a disposable project to confirm setup writes only after
approval and run one complete RED -> GREEN -> COMMIT -> REFACTOR cycle with the
installed `tdd` agent. Existing model-backed evals remain separate.

## CI Pipeline And Publishing

This repository includes a GitHub Actions pipeline at
[`/.github/workflows/main-evals-release.yml`](.github/workflows/main-evals-release.yml).

Pull requests and pushes to `master` or `main` validate script tests, package
integrity, and the real CLI marketplace lifecycle. After validation, pushes or
manual dispatches on the **default branch only**:

1. Read the version from `plugin.json` and require the marketplace entry to match.
2. Build the isolated plugin zip and retain the existing manual-install zip.
3. Create a GitHub Release and matching tag at the validated commit.

Publication happens when this work reaches the default branch, not merely when
the files exist on a feature branch. Live model-backed evals are not a release
gate in this workflow.

## Versioning And Downloadable Zip

The release job uses git tags in `vMAJOR.MINOR.PATCH` format.

- Bump `plugin.json` and `.github/plugin/marketplace.json` together before a release.
  The first marketplace-capable version is `0.2.0`.
- Versions are explicit, not automatically incremented: this keeps plugin,
  catalog, release tag, and zip metadata consistent.
- Optional workflow input `release_version` must match both manifests.
- An existing version tag is never overwritten; subsequent runs validate but
  skip publication. Fixes require a new version.

Each release includes a downloadable zip asset named:

- `copilot-tdd-harness-<version>.zip`
- `copilot-tdd-harness-plugin-<version>.zip`

The first is the existing manual-install package and contains:

- `.github/`
- installer and evaluation scripts in `scripts/`
- `README.md`
- `LICENSE`

The second contains only the minimal plugin described above. Extract it into
its own directory and install that directory with `copilot plugin install`
for offline/local development; it does not contain manual installer scripts.
Marketplace users do not need either zip.

### Self-hosted versus curated marketplaces

This repository hosts its **own** marketplace. It is not automatically listed
in GitHub's built-in `awesome-copilot` marketplace.

For curated inclusion, follow the current
[Awesome Copilot external-plugin review process](https://github.com/github/awesome-copilot/blob/main/CONTRIBUTING.md#adding-external-plugins):
submit its external-plugin issue form with the public repository, release tag,
full commit SHA, version, license, author, and keywords. Do not directly edit
their external-plugin catalog. Approval is controlled by its maintainers.
Its current quality gates require **Agent Plugins 1.0** and skill-spec compliance;
this legacy-format package must first be migrated/materialized into that layout
and pass their lint and install checks before submission. No curated submission
or approval is performed by this repository's release workflow.

Official format and command references:

- [Creating plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating)
- [Creating marketplaces](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace)
- [CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
