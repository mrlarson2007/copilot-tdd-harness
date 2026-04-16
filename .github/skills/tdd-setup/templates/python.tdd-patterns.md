---
applyTo: "**/*.{py}"
---

# TDD Patterns (Python)

- Test directory: `{{TEST_DIR}}`
- Test naming pattern: `{{NAMING_PATTERN}}`
- Assertion style/library: `{{ASSERTION_LIB}}`
- Mocking approach: `{{MOCK_LIB}}`

## Preferred Test Style
- Use arrange-act-assert structure.
- Keep one behavior per test.
- Prefer readable assertion intent over incidental details.

## Naming Guidance
- Follow `{{NAMING_PATTERN}}`.
- Use descriptive names reflecting behavior and expected outcome.

## Mocking Guidance
- Use `{{MOCK_LIB}}` for external dependencies and nondeterministic boundaries.
- Avoid over-mocking implementation details.
