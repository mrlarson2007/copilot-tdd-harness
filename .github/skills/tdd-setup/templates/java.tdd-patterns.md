---
applyTo: "**/*.{java,kt}"
---

# TDD Patterns (Java)

- Test directory: `{{TEST_DIR}}`
- Test naming pattern: `{{NAMING_PATTERN}}`
- Assertion library: `{{ASSERTION_LIB}}`
- Mocking approach: `{{MOCK_LIB}}`

## Preferred Test Style
- Use clear arrange / act / assert blocks.
- One behavior per test.
- Use `{{ASSERTION_LIB}}` assertions consistently.

## Naming Guidance
- Follow `{{NAMING_PATTERN}}` for test methods.
- Keep class names aligned with unit under test.

## Mocking Guidance
- Use `{{MOCK_LIB}}` for external systems and side-effecting collaborators.
- Favor real collaborators for stable in-memory behavior.
