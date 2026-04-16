# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Phase 6 — Install Scripts ([#7](https://github.com/mrlarson2007/copilot-tdd-harness/issues/7))

### install-tdd-harness.ps1 / install-tdd-harness.sh

**Safety contract**: Never overwrites existing files. Prints `SKIP: <file> — already exists, merge manually` for conflicts.

```
Install sequence:
1. Create .github/ subdirectories if missing
2. Copy each file; SKIP if already exists
3. If tdd-config.json not yet present:
   a. Auto-detect test runner from project files
   b. Write minimal tdd-config.json with detected runner
4. Print install summary: N files installed, M files skipped
5. Print next steps: "Run /tdd-setup in Copilot Chat to complete configuration"
```

Auto-detection priority:
1. `*.sln` or `*.csproj` present → `dotnet test`
2. `package.json` with `jest` dependency → `npm test`
3. `package.json` with `vitest` dependency → `npx vitest`
4. `pyproject.toml` or `setup.py` → `pytest`
5. `pom.xml` → `mvn test`
6. `build.gradle` → `./gradlew test`
7. None detected → leave `testCommand` blank, prompt user to set it

