---
applyTo: "**/*.{cs,csx}"
---

# TDD Patterns (Dotnet)

- Test project location: `{{TEST_DIR}}`
- Test naming pattern: `{{NAMING_PATTERN}}`
- Assertion library: `{{ASSERTION_LIB}}`
- Mocking approach: `{{MOCK_LIB}}`

## Preferred Test Style
- Use Arrange / Act / Assert structure.
- Keep one behavior assertion focus per test.
- Prefer expressive assertions from `{{ASSERTION_LIB}}`.

## Naming Guidance
- Follow `{{NAMING_PATTERN}}` for all new tests.
- Name test classes after the target type under test.

## Mocking Guidance
- Use `{{MOCK_LIB}}` for dependency seams and external boundaries.
- Avoid mocking pure value objects and deterministic helpers.
