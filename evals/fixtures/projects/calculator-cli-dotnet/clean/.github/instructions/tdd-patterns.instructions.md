---
applyTo: "**/*.cs"
description: "C# TDD conventions for the calculator-cli-dotnet fixture."
---

# C# TDD Patterns

## Commands

- Run tests with: `dotnet test CalculatorCliDotnet.slnx`

## File Naming

- Test files: `*Tests.cs` in the `CalculatorTui.Tests/` project
- Production files: `*.cs` in the `CalculatorTui/` project

## Test Naming

- Use the `WhenCondition_ShouldExpectedOutcome` pattern.
- One test per TDD cycle covering exactly one behavior.

## Assertions

- Use the xUnit `Assert` class.
