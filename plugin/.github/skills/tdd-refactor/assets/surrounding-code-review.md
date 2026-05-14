# Surrounding Code Review Rule

Purpose: avoid local refactors that degrade nearby readability or coupling.

## Required Checks
- Read the surrounding block/function/module before changing any target lines.
- Preserve local naming consistency and nearby coding patterns unless the new pattern clearly improves readability.
- Avoid introducing helper abstractions that conflict with neighboring structure.
- If a local change creates duplicated complexity nearby, prefer a small shared helper with clear naming.
- Re-run full tests after refactor to confirm no behavior changes.

## Output Expectations
- Mention whether surrounding code was reviewed.
- Call out any intentional pattern changes in nearby code.
- Keep refactor scope limited to readability/maintainability improvements.
