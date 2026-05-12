---
name: tdd-planning
description: >
  Plans the next concrete behavior for TDD before RED begins. Use when a task
  is broad, ambiguous, or needs to be decomposed into the smallest falsifiable
  next slice with edge cases considered first.
user-invocable: false
---

# TDD Planning Skill

Use this skill before the first RED cycle and again between cycles when the
next behavior is not already obvious.

This skill is for planning only. It should not write production code, write
tests, or execute a RED -> GREEN cycle.

## Purpose

Help the agent think like a strong software engineer using TDD:

- clarify what the user actually wants
- identify candidate behaviors from a feature request
- prefer edge cases before happy path when appropriate
- choose the smallest falsifiable next slice
- decide whether the request is concrete enough to start RED
- when creating a test plan, use Given, When, Then format to specify each behavior and its expected outcome

## Clarification Rules

Stop and ask exactly one focused question when the request is still too
ambiguous to support a meaningful failing test.

Treat the request as too ambiguous when any of the following are true:

- it names a category but not a specific behavior
- it names multiple plausible behaviors without a clear first slice
- choosing the next test would require guessing inputs, outputs, or scope

Do not self-resolve category-level ambiguity just because one option looks
smallest.

Treat category-level requests as mandatory clarification points even if one
candidate looks like the narrowest path. For example, "add another arithmetic
subcommand" requires a question; do not assume `subtract`, `multiply`, or any
other operation just to keep moving.

Do not use phrases like "assuming the new subcommand is...", "to proceed
autonomously", or "I can pick the smallest behavior" when the request is still
ambiguous. Ask the focused question instead and wait.

## Planning Rubric

When multiple candidate behaviors are available, prefer the one that best fits
this order:

1. Can be described as one externally visible behavior
2. Can be proven by one failing test
3. Protects an edge case or risky boundary first, when that makes sense
4. Requires the smallest production change that still moves the feature forward
5. Leaves room for obvious follow-up cycles without speculative design

## Required Output

Planning should produce one of these outcomes:

### Outcome A — Clarification needed

Return one focused question and wait.

### Outcome B — Ready for RED

State all of the following concisely:

- confirmed behavior
- why this is the right next slice
- the first failing test to add
- the protected existing behavior, if relevant

## Handoff Contract

When handing off to `tdd-workflow`, make sure the next step is concrete enough
that RED can start without guessing.

If you cannot name the next failing test in one sentence, planning is not done.

## Completion Boundary

When the user provides an explicit ordered list of requested behaviors, treat
that list as the planned scope.

- Prefer the next unfinished listed item over inferred cleanup or adjacent
  polish work.
- Once all listed items are green, stop planning new slices unless one listed
  item would still be incorrect or unusable without that additional behavior.