# Project TDD Patterns

Use these Python testing conventions for this project.

## Test Layout

- Test directory: `{{TEST_DIR}}`
- Test file pattern: `{{TEST_FILE_PATTERN}}`
- Source file pattern: `{{SOURCE_FILE_PATTERN}}`

## Naming

- Preferred test naming pattern: `{{NAMING_PATTERN}}`
- Keep test names clear about behavior and expected result.

## Assertions

- Preferred assertion style: `{{ASSERTION_LIB}}`
- Prefer direct, readable assertions over overly clever helpers.

## Mocking

- Preferred mocking approach: `{{MOCK_LIB}}`
- Mock only I/O and system boundaries; keep pure logic tests simple.

## General Guidance

- Use pytest-style test functions and fixtures consistently.
- Prefer small fixtures with explicit intent.
- Add regression tests before refactoring bug fixes.
