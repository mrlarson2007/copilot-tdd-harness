---
name: tdd-setup
description: >
  Configure TDD harness for this project. Uses exemplar test and production
  code plus LLM analysis to extract project patterns, then interviews you to
  fill any gaps. Generates
  .github/instructions/tdd-patterns.instructions.md and project-local phase
  pattern files without changing installed skills.
user-invocable: true
---

# tdd-setup

Use this skill when the repository needs project-specific TDD configuration.

## Goals

Generate:

- `.github/instructions/tdd-patterns.instructions.md`
- `.github/tdd-harness/project-testing-patterns.md`
- `.github/tdd-harness/project-code-style-patterns.md`
- `.github/tdd-harness/project-refactor-patterns.md`
- `.github/tdd-harness/project-test-run-patterns.md`

All output paths are relative to the working project's root, not the plugin.
Treat the installed skill directory as read-only.
Resolve bundled `./templates/` paths relative to this SKILL.md.
Never overwrite an existing project file without explicit confirmation.
Read existing project instructions and phase patterns before proposing changes;
preserve user edits and only create missing files unless replacement is confirmed.
Do not create placeholders or any other files before the user confirms setup.

## Pattern Extraction Step

1. Read existing project configuration and identify missing phase guides.
2. Prompt the user to select or specify exemplar test files and production code files that best represent the project's preferred style and conventions.
3. Use LLM-powered analysis to extract:
  - Test structure, naming, and assertion patterns from the exemplar test files (for RED)
  - Code style, idioms, and formatting conventions from the exemplar production files (for GREEN)
  - Refactoring and surrounding-code consistency patterns from both (for REFACTOR)
4. Summarize the extracted patterns and present them to the user for confirmation or editing.
5. After confirmation, update:
  - `.github/tdd-harness/project-testing-patterns.md`
  - `.github/tdd-harness/project-code-style-patterns.md`
  - `.github/tdd-harness/project-refactor-patterns.md`
  - `.github/tdd-harness/project-test-run-patterns.md`

If the user does not provide example files, run interview-only mode.

## Interview Workflow

1. Present extracted patterns first, then ask for confirmation or corrections.
2. If a value or pattern is missing, ask:
  - What test runner do you use?
  - What build command should the agent use for validation when a build step is needed?
  - Where are your test files?
  - What naming convention do you use for test methods or test cases?
  - What assertion library do you use?
  - What mocking approach or mocking library do you use?
  - What testing patterns should RED follow (for example AAA, table-driven, Given-When-Then naming)?
  - What implementation/code-style patterns should GREEN follow (for example naming, formatting, guard clauses, error handling conventions)?
  - What refactoring style patterns should REFACTOR follow (for example surrounding-code consistency, helper extraction thresholds, readability priorities)?
  - Are there project-specific testing patterns for time, logging, HTTP, database, or other dependencies?

Do not write files until the user has confirmed the final values.

## File Generation

After confirmation:

1. Choose the closest bundled template from `./templates/`:
   - `dotnet.tdd-patterns.md`
   - `node.tdd-patterns.md`
   - `python.tdd-patterns.md`
   - `java.tdd-patterns.md`
2. Expand the template with project-specific values, including any confirmed test or build commands in the instructions content.
3. Write the result to `.github/instructions/tdd-patterns.instructions.md`.
4. Write project-local phase guides:
  - `.github/tdd-harness/project-testing-patterns.md`
  - `.github/tdd-harness/project-code-style-patterns.md`
  - `.github/tdd-harness/project-refactor-patterns.md`
  - `.github/tdd-harness/project-test-run-patterns.md`
5. Do not generate `.github/tdd-config.json`.

Asset content requirements:

- RED asset focuses on test naming, test structure, assertion style, and allowed test doubles.
- GREEN asset focuses on production code style and minimal implementation conventions.
- REFACTOR asset focuses on surrounding-code review, readability heuristics, and safe extraction rules.
- TEST-RUN guide records confirmed test/build commands, expected-result checks,
  verification scope, and safe scoped rollback.

## Template Selection Guide

- **dotnet**: `dotnet test`, `.sln`, `.csproj`
- **node**: `npm test`, `npx vitest`, `package.json`
- **python**: `pytest`, `pyproject.toml`, `requirements.txt`
- **java**: `mvn test`, `./gradlew test`, `pom.xml`, `build.gradle`

If no template is a close match, generate the instructions from scratch using the same sections as the nearest template.

## Output Requirements

When the skill completes, report:

- which values were extracted from exemplar files
- which values were provided by the user
- which files were created or updated
- which patterns were assigned to RED, GREEN, and REFACTOR assets
- any values the user may still want to refine later
