# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 2 — tdd-workflow Skill ([#3](https://github.com/mrlarson2007/copilot-tdd-harness/issues/3))

Loaded on-demand when the model needs TDD guidance. References TDD-Framework.md.

### SKILL.md Frontmatter

```yaml
---
name: tdd-workflow
description: >
  Enforces a strict Red-Green-Refactor-Commit TDD workflow. Use when making
  any code changes or adding behavior. Guides the RED→GREEN→COMMIT→REFACTOR
  cycle with one-test-per-cycle discipline, edge-case-first ordering, and
  minimal green implementations.
user-invocable: false
---
```

The skill body references [TDD-Framework.md](../../TDD-Framework.md) and distills the key rules into model-readable format with examples from the canonical reference.

