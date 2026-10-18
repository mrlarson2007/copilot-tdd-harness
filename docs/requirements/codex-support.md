# Codex Support Plan

## Feature Summary

Support Codex CLI and the Codex app as TDD harness clients, using Codex CLI
for automated evaluations. Reuse the existing skills and scoring wherever
possible; isolate platform-specific instructions, lifecycle integration, and
execution.

Direct OpenAI API evaluations and Codex cloud are outside the initial scope.

## Stakeholders

- Developers using Codex CLI or the Codex app.
- Harness maintainers supporting both Copilot and Codex.
- Contributors comparing agent and model performance.

## Assumptions and Open Questions

- The existing TDD phase rules remain authoritative.
- Existing Copilot installation and evaluation behavior must remain compatible.
- Current Codex documentation has not yet been verified for this plan.
- Hook availability, blocking semantics, skill metadata, and CLI/app parity
  must be verified before implementation; they are not established capabilities.
- CLI evaluations measure model + Codex + harness, not the model in isolation.
- CLI evaluation success alone does not establish app compatibility.

## Repository Findings

- Skills currently live under `.github/skills/`.
- `evals/fixtures/scenarios/agent-runner.js` installs Copilot assets and launches
  Copilot.
- `evals/promptfoo/benchmark-provider.js` provides disposable repositories and
  summary JSON replay.
- Historical hook plans do not establish a currently shipped hook implementation.
- `evals/fixtures/scenarios/summary-deriver.js` infers RED/GREEN transitions
  from commits. Commit history alone cannot prove a failing test ran before
  production edits.

Recheck these findings against the implementation branch before making changes.

## Implementation Sequence

### 1. Verify the Codex Integration Contract

Review official documentation:

- [Skills](https://developers.openai.com/codex/skills)
- [AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Non-interactive execution](https://developers.openai.com/codex/noninteractive)
- [Configuration](https://developers.openai.com/codex/config-reference)
- [Codex app](https://developers.openai.com/codex/app)

Establish a CLI/app capability matrix covering:

- Skill discovery, explicit invocation, and supported metadata.
- Project instructions, configuration precedence, and project trust.
- Supported lifecycle hooks, payloads, and action-blocking capabilities.
- Structured execution events, model selection, sandboxing, authentication, and
  session continuation.
- App worktree behavior.

Do not assume Copilot event names or CLI/app parity. Notifications alone must
not be described as enforcement. Record verified capabilities and limitations
before choosing adapters.

### 2. Share Skills and Add Thin Codex Adapters

- Keep one authoritative set of TDD rules and phase assets.
- Package skills in Codex's documented discovery layout, adapting metadata and
  relative references as needed.
- Provide an opt-in Codex TDD entry point and project instructions without
  assuming Copilot custom agents or delegation exist.
- Make setup-generated testing conventions available to both Codex clients.
- Preserve RED -> GREEN -> COMMIT -> REFACTOR discipline and Copilot behavior.

### 3. Add Lifecycle Integration Based on Verified Capabilities

- Separate shared TDD policy from client-specific lifecycle adapters.
- Use hooks for observation or enforcement only where documented semantics
  support the intended behavior.
- Where blocking hooks are unavailable, use explicit skill checkpoints and
  disclose the limitation.
- Scope workflow state to the repository/worktree and session.
- Distinguish verified, inferred, and missing phase evidence.

### 4. Extend Installation Safely

- Extend both existing installers to support Copilot, Codex, or both.
- Retain the current Copilot default.
- Preserve existing files and project configuration; report merge conflicts
  rather than overwriting content.
- Document activation and verification separately for CLI and app.

### 5. Add Live Codex CLI Evaluations

- Introduce an agent-runtime adapter alongside the Copilot runner.
- Reuse fixtures, prompts, disposable repositories, and applicable assertions.
- Capture structured CLI events, command outcomes, test results, repository
  changes, and commits.
- Preserve raw evidence alongside the existing summary format; extend scoring
  compatibly where stronger evidence is needed.
- Do not accept an agent's claimed RED/GREEN status as proof.
- Record runtime, CLI version, selected model, configuration, duration, and
  available usage data.
- Classify authentication errors, unavailable models, timeouts, and malformed
  output separately from TDD failures.
- Run the same scenarios through Codex CLI with each supported, explicitly
  selected model.

### 6. Roll Out Incrementally

1. Validate skill discovery and activation in CLI and app.
2. Add CLI feature and clarification evaluations.
3. Add negative controls and evidence-quality assertions.
4. Add extended drift runs and repeated model comparisons.
5. Add an opt-in CI matrix with isolated workspaces, protected credentials,
   execution limits, and retained failure artifacts.

Use CLI automation for scoring and a separate app acceptance checklist for
discovery, activation, worktrees, and lifecycle behavior.

## Acceptance Scenarios

### Shared Workflow

**Given** Codex support is installed,
**When** a developer activates TDD in CLI or app,
**Then** the same phase rules and project test conventions apply.

### Safe Installation

**Given** project instructions or configuration already exist,
**When** Codex support is installed,
**Then** existing content remains intact and conflicts are reported.

### Clarification Before Changes

**Given** a task is ambiguous,
**When** the CLI evaluation runs,
**Then** Codex asks for clarification without changing project code.

### Verified TDD Cycle

**Given** a concrete behavior is requested,
**When** Codex completes the slice,
**Then** execution evidence shows a failing test, followed by a production edit,
a passing test, and a behavior commit.

### Violation Detection

**Given** production changes precede verified RED,
**When** the evaluator scores the run,
**Then** protocol fidelity fails despite passing final tests.

### Missing Evidence

**Given** required execution evidence is absent,
**When** the evaluator scores the run,
**Then** it reports insufficient evidence rather than inventing successful phases.

### Capability Gap

**Given** a client lacks blocking hooks,
**When** TDD is activated,
**Then** the integration clearly reports its enforcement limits.

### Copilot Regression Protection

**Given** Copilot remains selected,
**When** existing evaluations run,
**Then** existing installation and evaluation behavior is preserved.
