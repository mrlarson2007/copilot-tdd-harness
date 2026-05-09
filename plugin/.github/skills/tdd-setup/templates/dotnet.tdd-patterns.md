# Project TDD Patterns

Use these .NET testing conventions for this project.

## Test Layout

- Test directory: `{{TEST_DIR}}`
- Test file pattern: `{{TEST_FILE_PATTERN}}`
- Source file pattern: `{{SOURCE_FILE_PATTERN}}`

## Naming

- Preferred test naming pattern: `{{NAMING_PATTERN}}`
- Keep test names behavior-focused and explicit about the expected outcome.

## Assertions

- Preferred assertion library: `{{ASSERTION_LIB}}`
- Prefer readable, intention-revealing assertions over generic boolean checks.

## Mocking

- Preferred mocking approach: `{{MOCK_LIB}}`
- Mock only external collaborators. Keep domain logic tested without unnecessary mocks.

## General Guidance

- Follow Arrange / Act / Assert structure.
- Keep one behavior per test.
- Add edge-case tests before broad refactors.
