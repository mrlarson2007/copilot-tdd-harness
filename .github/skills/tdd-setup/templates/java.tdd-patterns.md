# Project TDD Patterns

Use these Java testing conventions for this project.

## Test Layout

- Test directory: `{{TEST_DIR}}`
- Test file pattern: `{{TEST_FILE_PATTERN}}`
- Source file pattern: `{{SOURCE_FILE_PATTERN}}`

## Naming

- Preferred test naming pattern: `{{NAMING_PATTERN}}`
- Choose method names that describe the scenario and expected outcome.

## Assertions

- Preferred assertion library: `{{ASSERTION_LIB}}`
- Use fluent or descriptive assertions when available.

## Mocking

- Preferred mocking approach: `{{MOCK_LIB}}`
- Mock only collaborators outside the unit under test.

## General Guidance

- Keep each test method focused on one behavior.
- Prefer readable fixture setup over large shared mutable fixtures.
- Re-run the focused test suite after every GREEN and REFACTOR step.
