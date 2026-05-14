---
name: requirements-planning
description: >
  Helps a user break down a broad or ambiguous requirement into concrete,
  testable behaviors.
user-invocable: true
---

# Requirements Planning Skill

Use this skill before development to help break down a broad or ambiguous requirement into concrete, testable behaviors.

This skill is for planning only. It should not write production code, write
tests, or execute a RED -> GREEN cycle.

## Purpose

Your audience is a software team that needs help breaking down a broad or ambiguous requirement into concrete, testable behaviors.
The goal is to help the team think like a strong software engineer, QA, and requirements analyst using BDD and TDD principles to:

- clarify what the user actually wants
- identify candidate behaviors from a feature request
- outline edge cases
- outline key scenarios
- express each planned behavior as a Given, When, Then scenario

## Interaction Model

This skill is interactive.

- The user provides the initial feature or behavior prompt.
- The skill helps the user refine that request into concrete scenarios.
- If the request is still ambiguous, ask exactly one focused clarification question and wait.
- Do not continue planning until the user answers the clarification question.

## Clarification Rules

Stop and ask exactly one focused question when any of the following are true:

- the request names a feature area but not a specific behavior
- the request has multiple plausible interpretations or stakeholder outcomes
- the next Given, When, Then scenario would require guessing inputs, outputs, actors, or scope

Do not self-resolve ambiguity just because one option looks reasonable.

## Required Output

When the request is clear enough, produce a requirements plan with these sections:

- feature summary
- stakeholders or affected users
- assumptions or open questions
- scenarios

Each scenario must:

- describe one externally visible behavior
- use explicit Given, When, Then formatting
- include happy path or edge case intent clearly enough to guide later implementation and testing

## File Output

When the plan is ready, propose writing it to a markdown file under:

- `docs/requirements/`

Default to a descriptive filename derived from the feature name, for example:

- `docs/requirements/user-authentication.md`

Before writing the file, ask the user to confirm that the default location and filename are acceptable.

If the user wants a different path or filename, use their choice.

## Workflow

1. Ask the user to describe the feature or behavior they want to build or fix.
2. Do not assume, guess, or self-resolve ambiguity. If the request is broad or ambiguous, ask exactly one focused question to clarify what the user wants.
3. If a clarification question was asked, wait for the answer before continuing.
4. Help the user understand the problem being solved and who the stakeholders are so the right behaviors are identified.
5. Identify candidate behaviors from the user's description. Look for specific actions, inputs, outputs, business rules, and edge cases that can be turned into testable scenarios.
6. Produce a concise plan in markdown using Given, When, Then format for each scenario.
7. Propose saving the plan to `docs/requirements/<feature-name>.md` and ask the user to confirm that default location and filename before writing the file.