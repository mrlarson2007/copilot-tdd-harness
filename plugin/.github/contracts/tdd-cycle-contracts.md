# TDD Cycle Runner Contract Schema

Defines the JSON contract structure for all phase handoffs in the TDD cycle runner architecture.

## Base Fields

Every contract includes only these shared fields:

```json
{
  "contract": "<contract_name>",
  "from": "<sender>",
  "to": "<receiver>"
}
```

All other fields are contract-specific.

## Contracts
- red_request
- red_result
- green_request
- green_result
- commit_request
- commit_result
- refactor_request
- cycle_result
- cycle_complete
- escalate_cycle_failure

## Contract Schemas

### red_request
```json
{
  "contract": "red_request",
  "from": "cycle_runner",
  "to": "tdd-red",
  "scenario": "Given/When/Then slice",
  "target_files": ["path/to/test_file"]
}
```

### red_result
```json
{
  "contract": "red_result",
  "from": "tdd-red",
  "to": "cycle_runner",
  "status": "ok | failed | escalate",
  "test_files_changed": ["path/to/test_file"],
  "failing_test_names": ["TestName"],
  "failure_output": "command output proving RED",
  "nextAction": "green_request | escalate_cycle_failure",
  "notes": ["optional"]
}
```

### green_request
```json
{
  "contract": "green_request",
  "from": "cycle_runner",
  "to": "tdd-green",
  "scenario": "Given/When/Then slice",
  "failing_test_names": ["TestName"],
  "target_files": ["path/to/production_file"]
}
```

### green_result
```json
{
  "contract": "green_result",
  "from": "tdd-green",
  "to": "cycle_runner",
  "status": "ok | failed | escalate",
  "production_files_changed": ["path/to/production_file"],
  "tests_pass_output": "command output proving GREEN",
  "nextAction": "commit_request | escalate_cycle_failure",
  "notes": ["optional"]
}
```

### commit_request
```json
{
  "contract": "commit_request",
  "from": "cycle_runner",
  "to": "tdd-commit",
  "scenario": "Given/When/Then slice",
  "files_in_scope": ["path/to/file"]
}
```

### commit_result
```json
{
  "contract": "commit_result",
  "from": "tdd-commit",
  "to": "cycle_runner",
  "status": "ok | failed | escalate",
  "commit_sha": "<sha>",
  "commit_message": "<message>",
  "nextAction": "refactor_request | escalate_cycle_failure",
  "notes": ["optional"]
}
```

### refactor_request
```json
{
  "contract": "refactor_request",
  "from": "cycle_runner",
  "to": "tdd-refactor",
  "commit_sha": "<sha>",
  "commit_message": "<message>",
  "files_in_scope": ["path/to/file"]
}
```

### cycle_result
```json
{
  "contract": "cycle_result",
  "from": "tdd-refactor",
  "to": "cycle_runner",
  "status": "ok | failed | escalate",
  "files_changed": ["path/to/file"],
  "tests_pass_output": "command output after refactor",
  "nextAction": "cycle_complete | escalate_cycle_failure",
  "notes": ["optional"]
}
```

### cycle_complete
```json
{
  "contract": "cycle_complete",
  "from": "cycle_runner",
  "to": "main_orchestrator",
  "status": "ok",
  "scenario": "Given/When/Then slice",
  "summary": "one cycle completed",
  "artifacts": {
    "red_result": "<id-or-inline>",
    "green_result": "<id-or-inline>",
    "commit_result": "<id-or-inline>",
    "cycle_result": "<id-or-inline>"
  }
}
```

### escalate_cycle_failure
```json
{
  "contract": "escalate_cycle_failure",
  "from": "cycle_runner | phase_agent",
  "to": "main_orchestrator",
  "status": "escalate",
  "phase": "red | green | commit | refactor",
  "reason": "short machine-readable reason",
  "details": "human-readable explanation",
  "recommended_action": "clarify | split_scope | manual_intervention"
}
```

**Note:**
The H2/H3/etc. prefixes are used only in diagrams and design docs for clarity. All implementation, skill, and contract files use only descriptive contract names.

## Progressive Disclosure
- Only minimal runtime context required to execute the phase is passed.
- No full-session or global state is included in phase handoffs.
- Phase rules, constraints, and detailed guidance come from each phase skill and its assets, not from contract payload fields.
