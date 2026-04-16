---
applyTo: "**"
---

# TDD Constitution

These rules apply to ALL code changes in this project.

1. Never write production code without a failing test first (RED phase).
2. Write the minimal production code to make the failing test pass (GREEN phase).
3. Never refactor production code while tests are failing.
4. Commit test and production code together — never separately.
5. One behavior per TDD cycle. Do not implement multiple behaviors in one cycle.
6. Tests are permanent — never delete or modify tests to make them pass.

## FINAL REMINDER

If you are about to write production code, ask yourself: "Is there a failing test for this?" If no, write the test first.
