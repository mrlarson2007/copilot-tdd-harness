---
name: tdd-setup
description: >
  Configure TDD harness for this project. Uses exemplar test and production
  code plus LLM analysis to extract project patterns, then interviews you to
  fill any gaps. Generates
  .github/instructions/tdd-patterns.instructions.md and stage-specific
  pattern assets.
user-invocable: true
---

# tdd-setup

Use this skill when the repository needs project-specific TDD configuration.

## Goals

Generate:

- `.github/instructions/tdd-patterns.instructions.md`
- `.github/skills/tdd-red/assets/project-testing-patterns.md`
- `.github/skills/tdd-green/assets/project-code-style-patterns.md`
- `.github/skills/tdd-refactor/assets/project-refactor-patterns.md`

These three phase asset files are canonical placeholders and must always exist, even before final pattern extraction.

## Pattern Extraction Step

1. Ensure canonical placeholder files exist for RED, GREEN, and REFACTOR style guides.
2. Prompt the user to select or specify exemplar test files and production code files that best represent the project's preferred style and conventions.
3. Use LLM-powered analysis to extract:
  - Test structure, naming, and assertion patterns from the exemplar test files (for RED)
  - Code style, idioms, and formatting conventions from the exemplar production files (for GREEN)
  - Refactoring and surrounding-code consistency patterns from both (for REFACTOR)
4. Summarize the extracted patterns and present them to the user for confirmation or editing.
5. After confirmation, update:
  - `.github/skills/tdd-red/assets/project-testing-patterns.md`
  - `.github/skills/tdd-green/assets/project-code-style-patterns.md`
  - `.github/skills/tdd-refactor/assets/project-refactor-patterns.md`

If the user does not provide example files, run interview-only mode.

## Interview Workflow

1. Present extracted patterns first, then ask for confirmation or corrections.
2. If a value or pattern is missing, ask:

1. What test runner do you use?
2. What build command should the agent use for validation when a build step is needed?
3. Where are your test files?
4. What naming convention do you use for test methods or test cases?
5. What assertion library do you use?
6. What mocking approach or mocking library do you use?
7. What testing patterns should RED follow (for example AAA, table-driven, Given-When-Then naming)?
8. What implementation/code-style patterns should GREEN follow (for example naming, formatting, guard clauses, error handling conventions)?
9. What refactoring style patterns should REFACTOR follow (for example surrounding-code consistency, helper extraction thresholds, readability priorities)?
10. Are there project-specific testing patterns for time, logging, HTTP, database, or other dependencies?

Do not write files until the user has confirmed the final values.

## File Generation

After confirmation:

1. Choose the closest template from `.github/skills/tdd-setup/templates/`:
   - `dotnet.tdd-patterns.md`
   - `node.tdd-patterns.md`
   - `python.tdd-patterns.md`
   - `java.tdd-patterns.md`
2. Expand the template with project-specific values, including any confirmed test or build commands in the instructions content.
3. Write the result to `.github/instructions/tdd-patterns.instructions.md`.
4. Write stage-specific pattern assets:
  - `.github/skills/tdd-red/assets/project-testing-patterns.md`
  - `.github/skills/tdd-green/assets/project-code-style-patterns.md`
  - `.github/skills/tdd-refactor/assets/project-refactor-patterns.md`
5. Do not generate `.github/tdd-config.json`.

Asset content requirements:

- RED asset focuses on test naming, test structure, assertion style, and allowed test doubles.
- GREEN asset focuses on production code style and minimal implementation conventions.
- REFACTOR asset focuses on surrounding-code review, readability heuristics, and safe extraction rules.

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
