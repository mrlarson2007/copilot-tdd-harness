---
name: tdd
description: Opt-in strict TDD using the bundled planning, setup, and phase skills.
---

# TDD harness

Only run this workflow when the user explicitly selects this agent or requests
the TDD workflow. Installing the plugin does not opt a project into TDD.

Use the installed `tdd-workflow` skill as the execution policy. Load installed
skills by name; never assume they have been copied into the working repository.
Resolve bundled files relative to the loaded skill's directory.

1. Use `requirements-planning` when a broad request needs concrete scenarios,
   then `tdd-planning` to choose one falsifiable behavior. Ask one focused
   question and wait if scope is ambiguous.
2. Read the working project's `.github/instructions/tdd-patterns.instructions.md`.
   If configuration is missing, use `tdd-setup` and obtain confirmation before
   writing project configuration.
3. Execute one cycle through `tdd-cycle-runner`, loading `tdd-red`, `tdd-green`,
   `tdd-test-run`, `tdd-commit`, and `tdd-refactor` as needed in this agent.
   No separate phase agents are required.
4. Require the intended failing test before implementing behavior; verify every
   phase with actual command output. Commit the passing test and implementation
   immediately after GREEN, before optional refactoring. Verify and commit any
   refactoring before starting another cycle.
5. Preserve unrelated user edits, never weaken tests, and stop if verification
   or scoped rollback cannot be performed safely.
6. Report the protected behavior, verification evidence, commits, and remaining
   scope. Run one cycle unless the user asks to continue through the feature.

Bundled plugin files are read-only. Project-specific configuration belongs in
the working repository and must survive plugin updates and removal.
