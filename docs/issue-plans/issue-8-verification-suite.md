# Detailed Issue Plan

This file contains the detailed implementation content for this single GitHub issue, extracted from the master plan.

## Verification Steps ([#8](https://github.com/mrlarson2007/copilot-tdd-harness/issues/8))

After installation, verify the harness is working:

1. **Constitution active**: Open any source file, ask Copilot to "add a method." Confirm it asks for a test first.
2. **tdd-setup invocable**: Type `/tdd-setup` in Copilot Chat. Confirm the skill runs and asks questions.
3. **tdd-start invocable**: Type `/tdd-start` in Copilot Chat. Confirm it prompts for a behavior description.
4. **tdd-status invocable**: Type `/tdd-status` in Copilot Chat. Confirm it reports test state.
5. **tdd-red agent**: Open Copilot Chat, switch to `tdd-red` agent. Ask it to write a test. Confirm it writes ONE failing test and stops.
6. **tdd-green agent**: Confirm tdd-green refuses to hand off while tests are failing.
7. **PostToolUse hook**: Edit a source file. Confirm test results appear in the next Copilot response as `REFLEXION:` formatted feedback.
8. **Stop hook**: In tdd-green agent, leave a test failing and try to end the session. Confirm the hook blocks with a clear message.
9. **Reflexion format**: Confirm failed test feedback includes `REFLEXION: [TestName] failed. Expected [Y], got [Z]. Likely cause: [inferred]. Hypothesis: [fix approach].`
10. **ReAct block**: Confirm each agent response starts with the `PHASE: / BEHAVIOR: / TEST: / REASON:` block before any file action.
11. **Self-critique checklist**: Confirm each agent response ends with the phase-appropriate checklist before handoff.
12. **Lost in the Middle**: Confirm each agent body has the `FINAL REMINDER:` block at the bottom.
13. **PreCompact hook**: In a long session, trigger compaction. Confirm TDD state (phase, test name) survives in the compacted context.
14. **Install safety**: Run the install script twice. Confirm no files are overwritten on the second run.
15. **Conflict-free install**: Install into a project with an existing `copilot-instructions.md`. Confirm that file is untouched.

