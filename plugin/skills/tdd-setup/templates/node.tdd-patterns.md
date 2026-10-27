# Project TDD Patterns

Use these JavaScript / TypeScript testing conventions for this project.

## Test Layout

- Test directory: `{{TEST_DIR}}`
- Test file pattern: `{{TEST_FILE_PATTERN}}`
- Source file pattern: `{{SOURCE_FILE_PATTERN}}`

## Naming

- Preferred test naming pattern: `{{NAMING_PATTERN}}`
- Prefer test names that read like behavior statements.

## Assertions

- Preferred assertion style: `{{ASSERTION_LIB}}`
- Keep assertions close to the action being verified.

## Mocking

- Preferred mocking approach: `{{MOCK_LIB}}`
- Mock network, filesystem, time, and other external boundaries deliberately.

## General Guidance

- Keep each `test(...)` or `it(...)` focused on one behavior.
- Use explicit setup helpers instead of hidden global fixtures when possible.
- Preserve readable red/green/refactor steps in commit history.
