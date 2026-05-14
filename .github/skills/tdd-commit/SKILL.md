---
title: TDD Commit Phase Skill
description: |
  Guides the creation of an atomic commit after the green phase. Enforces one-commit-per-green, clear messages, and no scope creep. Loads detailed rules from asset files.
role: phase-skill
user-invocable: false
contracts:
  - commit_request
  - commit_result
---

# TDD Commit Phase Skill

## Purpose
- Create an atomic commit for the green state
- Enforce one-commit-per-green discipline
- Require clear, descriptive commit messages
- No refactor or new behavior in this phase

## Inputs
- Green status
- Commit scope and message template
- Skill and asset references

## Outputs
- Commit sha
- Files committed
- Commit message

## Steps
1. Load asset files for commit discipline, message quality, and anti-patterns
2. Create atomic commit for green state
3. Return contract output

## Completion Checks
- Only green changes committed
- Commit message is clear and descriptive
- No refactor or new behavior included
