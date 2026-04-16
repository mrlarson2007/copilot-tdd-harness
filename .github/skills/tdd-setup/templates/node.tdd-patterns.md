---
applyTo: "**/*.{js,jsx,ts,tsx,mjs,cjs}"
---

# TDD Patterns (Node)

- Test directory: `{{TEST_DIR}}`
- Test naming pattern: `{{NAMING_PATTERN}}`
- Assertion library: `{{ASSERTION_LIB}}`
- Mocking approach: `{{MOCK_LIB}}`

## Preferred Test Style
- Keep each test focused on one behavior.
- Use clear arrange-act-assert sections.
- Use `{{ASSERTION_LIB}}` matchers consistently.

## Naming Guidance
- Follow `{{NAMING_PATTERN}}` for `describe` and `it/test` names.
- Prefer explicit scenario and expected outcome wording.

## Mocking Guidance
- Use `{{MOCK_LIB}}` for network, filesystem, clock, and other side effects.
- Prefer integration-style tests for stable in-process boundaries.
