---
name: tdd-commit
description: |
  Guides the creation of an atomic commit after the green phase. Enforces one-commit-per-green, clear messages, and no scope creep. Loads detailed rules from asset files.
metadata:
  title: "TDD Commit Phase Skill"
  role: "phase-skill"
  user-invocable: "false"
  contracts: "- commit_request\n  - commit_result"
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
1. Apply this skill's commit discipline and the loaded `tdd-workflow` policy
2. Create atomic commit for green state
3. Return contract output

## Completion Checks
- Only green changes committed
- Commit message is clear and descriptive
- No refactor or new behavior included
