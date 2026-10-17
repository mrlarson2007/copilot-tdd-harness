// Generated sample data. Replace with real eval output; see site/README.md.
window.EVAL_REPORT = {
  "schemaVersion": "0.1.0-prototype",
  "isSample": true,
  "sampleNotice": "Illustrative sample data for report prototypes only. These numbers were generated, not measured.",
  "generatedAt": "2026-10-17T00:00:00Z",
  "harnessVersion": "v0.0.0-sample",
  "trialsPerCell": 10,
  "conditions": [
    {
      "id": "harness",
      "label": "With TDD harness",
      "description": "copilot --agent=tdd with the tdd-* skills installed in the workspace."
    },
    {
      "id": "baseline",
      "label": "No skills",
      "description": "Default Copilot agent, same prompt and fixture, no harness agent or skills installed."
    }
  ],
  "models": [
    {
      "id": "model-a",
      "label": "Model A",
      "tier": "frontier"
    },
    {
      "id": "model-b",
      "label": "Model B",
      "tier": "frontier"
    },
    {
      "id": "model-c",
      "label": "Model C",
      "tier": "mid"
    },
    {
      "id": "model-d",
      "label": "Model D",
      "tier": "small"
    }
  ],
  "metrics": [
    {
      "id": "test_first",
      "label": "Test first",
      "description": "No production code changed before the first failing test.",
      "source": "assertions/detects-production-before-red.js"
    },
    {
      "id": "protocol_fidelity",
      "label": "Protocol fidelity",
      "description": "Run shows RED, GREEN and COMMIT phases, adds a test and ends green.",
      "source": "assertions/protocol-fidelity.js"
    },
    {
      "id": "commit_discipline",
      "label": "Commit discipline",
      "description": "Work is committed; nothing left uncommitted at the end.",
      "source": "assertions/commit-discipline.js"
    },
    {
      "id": "commit_quality",
      "label": "Commit quality",
      "description": "Test and production code land together in one atomic commit.",
      "source": "assertions/commit-quality.js"
    },
    {
      "id": "tests_pass_end",
      "label": "Tests pass at end",
      "description": "The full test suite passes after the run.",
      "source": "summary.testsPassedAtEnd"
    },
    {
      "id": "clarification",
      "label": "Asks when ambiguous",
      "description": "Stops to ask a clarifying question before changing code on an ambiguous request.",
      "source": "assertions/clarification-stops.js"
    },
    {
      "id": "extended_discipline",
      "label": "Holds discipline (long run)",
      "description": "Discipline does not degrade across a three-cycle session.",
      "source": "assertions/extended-run-discipline.js"
    }
  ],
  "scenarios": [
    {
      "id": "go-subtract",
      "label": "Go: add subtract command",
      "fixtureId": "calculator-cli-go",
      "family": "feature"
    },
    {
      "id": "go-multiply",
      "label": "Go: add multiply command",
      "fixtureId": "calculator-cli-go",
      "family": "feature"
    },
    {
      "id": "go-clarify",
      "label": "Go: ambiguous request",
      "fixtureId": "calculator-cli-go",
      "family": "clarification"
    },
    {
      "id": "dotnet-power",
      "label": ".NET: add Power operation",
      "fixtureId": "calculator-cli-dotnet",
      "family": "feature"
    },
    {
      "id": "go-drift",
      "label": "Go: 3-cycle drift check",
      "fixtureId": "calculator-cli-go",
      "family": "extended"
    }
  ],
  "failureModes": [
    {
      "id": "production-before-red",
      "label": "Wrote production code before a failing test"
    },
    {
      "id": "missing-commit",
      "label": "Left work uncommitted"
    },
    {
      "id": "split-test-and-code-commit",
      "label": "Split test and code into separate commits"
    },
    {
      "id": "tests-failing-at-end",
      "label": "Finished with failing tests"
    },
    {
      "id": "no-clarification-asked",
      "label": "Guessed instead of asking"
    },
    {
      "id": "discipline-drift",
      "label": "Discipline drifted over a long session"
    }
  ],
  "runs": [
    {
      "model": "model-a",
      "condition": "harness",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 10,
        "protocol_fidelity": 9,
        "commit_discipline": 10,
        "commit_quality": 10,
        "tests_pass_end": 10
      },
      "failureModes": {},
      "medianDurationSec": 174,
      "medianCommits": 3
    },
    {
      "model": "model-a",
      "condition": "harness",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 10,
        "protocol_fidelity": 9,
        "commit_discipline": 9,
        "commit_quality": 9,
        "tests_pass_end": 10
      },
      "failureModes": {
        "missing-commit": 1,
        "split-test-and-code-commit": 1
      },
      "medianDurationSec": 194,
      "medianCommits": 3
    },
    {
      "model": "model-a",
      "condition": "harness",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 10
      },
      "failureModes": {},
      "medianDurationSec": 50,
      "medianCommits": 0
    },
    {
      "model": "model-a",
      "condition": "harness",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 9,
        "protocol_fidelity": 9,
        "commit_discipline": 9,
        "commit_quality": 10,
        "tests_pass_end": 10
      },
      "failureModes": {
        "production-before-red": 1,
        "missing-commit": 1
      },
      "medianDurationSec": 184,
      "medianCommits": 3
    },
    {
      "model": "model-a",
      "condition": "harness",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 10,
        "extended_discipline": 8,
        "tests_pass_end": 10
      },
      "failureModes": {
        "discipline-drift": 2
      },
      "medianDurationSec": 464,
      "medianCommits": 7
    },
    {
      "model": "model-a",
      "condition": "baseline",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 4,
        "protocol_fidelity": 3,
        "commit_discipline": 3,
        "commit_quality": 4,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 6,
        "missing-commit": 7,
        "split-test-and-code-commit": 6,
        "tests-failing-at-end": 1
      },
      "medianDurationSec": 127,
      "medianCommits": 0
    },
    {
      "model": "model-a",
      "condition": "baseline",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 3,
        "protocol_fidelity": 3,
        "commit_discipline": 3,
        "commit_quality": 4,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 7,
        "missing-commit": 7,
        "split-test-and-code-commit": 6,
        "tests-failing-at-end": 1
      },
      "medianDurationSec": 96,
      "medianCommits": 1
    },
    {
      "model": "model-a",
      "condition": "baseline",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 5
      },
      "failureModes": {
        "no-clarification-asked": 5
      },
      "medianDurationSec": 37,
      "medianCommits": 0
    },
    {
      "model": "model-a",
      "condition": "baseline",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 4,
        "protocol_fidelity": 3,
        "commit_discipline": 3,
        "commit_quality": 4,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 6,
        "missing-commit": 7,
        "split-test-and-code-commit": 6,
        "tests-failing-at-end": 1
      },
      "medianDurationSec": 117,
      "medianCommits": 1
    },
    {
      "model": "model-a",
      "condition": "baseline",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 3,
        "extended_discipline": 3,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 7,
        "tests-failing-at-end": 2,
        "discipline-drift": 7
      },
      "medianDurationSec": 339,
      "medianCommits": 0
    },
    {
      "model": "model-b",
      "condition": "harness",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 9,
        "protocol_fidelity": 8,
        "commit_discipline": 9,
        "commit_quality": 9,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 1,
        "missing-commit": 1,
        "split-test-and-code-commit": 1,
        "tests-failing-at-end": 1
      },
      "medianDurationSec": 169,
      "medianCommits": 3
    },
    {
      "model": "model-b",
      "condition": "harness",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 9,
        "protocol_fidelity": 9,
        "commit_discipline": 9,
        "commit_quality": 9,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 1,
        "missing-commit": 1,
        "split-test-and-code-commit": 1,
        "tests-failing-at-end": 1
      },
      "medianDurationSec": 135,
      "medianCommits": 3
    },
    {
      "model": "model-b",
      "condition": "harness",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 9
      },
      "failureModes": {
        "no-clarification-asked": 1
      },
      "medianDurationSec": 39,
      "medianCommits": 0
    },
    {
      "model": "model-b",
      "condition": "harness",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 10,
        "protocol_fidelity": 9,
        "commit_discipline": 8,
        "commit_quality": 9,
        "tests_pass_end": 9
      },
      "failureModes": {
        "missing-commit": 2,
        "split-test-and-code-commit": 1,
        "tests-failing-at-end": 1
      },
      "medianDurationSec": 157,
      "medianCommits": 3
    },
    {
      "model": "model-b",
      "condition": "harness",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 9,
        "extended_discipline": 7,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 1,
        "tests-failing-at-end": 1,
        "discipline-drift": 3
      },
      "medianDurationSec": 534,
      "medianCommits": 7
    },
    {
      "model": "model-b",
      "condition": "baseline",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 3,
        "protocol_fidelity": 3,
        "commit_discipline": 3,
        "commit_quality": 4,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 7,
        "missing-commit": 7,
        "split-test-and-code-commit": 6,
        "tests-failing-at-end": 2
      },
      "medianDurationSec": 126,
      "medianCommits": 0
    },
    {
      "model": "model-b",
      "condition": "baseline",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 3,
        "protocol_fidelity": 3,
        "commit_discipline": 3,
        "commit_quality": 5,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 7,
        "missing-commit": 7,
        "split-test-and-code-commit": 5,
        "tests-failing-at-end": 2
      },
      "medianDurationSec": 129,
      "medianCommits": 1
    },
    {
      "model": "model-b",
      "condition": "baseline",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 5
      },
      "failureModes": {
        "no-clarification-asked": 5
      },
      "medianDurationSec": 37,
      "medianCommits": 0
    },
    {
      "model": "model-b",
      "condition": "baseline",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 3,
        "protocol_fidelity": 2,
        "commit_discipline": 2,
        "commit_quality": 4,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 7,
        "missing-commit": 8,
        "split-test-and-code-commit": 6,
        "tests-failing-at-end": 2
      },
      "medianDurationSec": 122,
      "medianCommits": 0
    },
    {
      "model": "model-b",
      "condition": "baseline",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 4,
        "extended_discipline": 3,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 6,
        "tests-failing-at-end": 2,
        "discipline-drift": 7
      },
      "medianDurationSec": 353,
      "medianCommits": 1
    },
    {
      "model": "model-c",
      "condition": "harness",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 8,
        "protocol_fidelity": 8,
        "commit_discipline": 7,
        "commit_quality": 8,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 2,
        "missing-commit": 3,
        "split-test-and-code-commit": 2,
        "tests-failing-at-end": 1
      },
      "medianDurationSec": 173,
      "medianCommits": 3
    },
    {
      "model": "model-c",
      "condition": "harness",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 8,
        "protocol_fidelity": 8,
        "commit_discipline": 8,
        "commit_quality": 9,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 2,
        "missing-commit": 2,
        "split-test-and-code-commit": 1,
        "tests-failing-at-end": 2
      },
      "medianDurationSec": 138,
      "medianCommits": 3
    },
    {
      "model": "model-c",
      "condition": "harness",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 8
      },
      "failureModes": {
        "no-clarification-asked": 2
      },
      "medianDurationSec": 39,
      "medianCommits": 0
    },
    {
      "model": "model-c",
      "condition": "harness",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 9,
        "protocol_fidelity": 8,
        "commit_discipline": 8,
        "commit_quality": 8,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 1,
        "missing-commit": 2,
        "split-test-and-code-commit": 2,
        "tests-failing-at-end": 2
      },
      "medianDurationSec": 135,
      "medianCommits": 3
    },
    {
      "model": "model-c",
      "condition": "harness",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 8,
        "extended_discipline": 7,
        "tests_pass_end": 9
      },
      "failureModes": {
        "production-before-red": 2,
        "tests-failing-at-end": 1,
        "discipline-drift": 3
      },
      "medianDurationSec": 460,
      "medianCommits": 7
    },
    {
      "model": "model-c",
      "condition": "baseline",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 3,
        "protocol_fidelity": 2,
        "commit_discipline": 2,
        "commit_quality": 3,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 7,
        "missing-commit": 8,
        "split-test-and-code-commit": 7,
        "tests-failing-at-end": 3
      },
      "medianDurationSec": 118,
      "medianCommits": 1
    },
    {
      "model": "model-c",
      "condition": "baseline",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 2,
        "protocol_fidelity": 1,
        "commit_discipline": 1,
        "commit_quality": 3,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 8,
        "missing-commit": 9,
        "split-test-and-code-commit": 7,
        "tests-failing-at-end": 2
      },
      "medianDurationSec": 126,
      "medianCommits": 0
    },
    {
      "model": "model-c",
      "condition": "baseline",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 4
      },
      "failureModes": {
        "no-clarification-asked": 6
      },
      "medianDurationSec": 32,
      "medianCommits": 0
    },
    {
      "model": "model-c",
      "condition": "baseline",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 2,
        "protocol_fidelity": 2,
        "commit_discipline": 1,
        "commit_quality": 3,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 8,
        "missing-commit": 9,
        "split-test-and-code-commit": 7,
        "tests-failing-at-end": 3
      },
      "medianDurationSec": 133,
      "medianCommits": 1
    },
    {
      "model": "model-c",
      "condition": "baseline",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 2,
        "extended_discipline": 2,
        "tests_pass_end": 8
      },
      "failureModes": {
        "production-before-red": 8,
        "tests-failing-at-end": 2,
        "discipline-drift": 8
      },
      "medianDurationSec": 365,
      "medianCommits": 0
    },
    {
      "model": "model-d",
      "condition": "harness",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 6,
        "protocol_fidelity": 6,
        "commit_discipline": 6,
        "commit_quality": 6,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 4,
        "missing-commit": 4,
        "split-test-and-code-commit": 4,
        "tests-failing-at-end": 3
      },
      "medianDurationSec": 147,
      "medianCommits": 3
    },
    {
      "model": "model-d",
      "condition": "harness",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 6,
        "protocol_fidelity": 6,
        "commit_discipline": 6,
        "commit_quality": 6,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 4,
        "missing-commit": 4,
        "split-test-and-code-commit": 4,
        "tests-failing-at-end": 3
      },
      "medianDurationSec": 130,
      "medianCommits": 3
    },
    {
      "model": "model-d",
      "condition": "harness",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 7
      },
      "failureModes": {
        "no-clarification-asked": 3
      },
      "medianDurationSec": 39,
      "medianCommits": 0
    },
    {
      "model": "model-d",
      "condition": "harness",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 7,
        "protocol_fidelity": 6,
        "commit_discipline": 6,
        "commit_quality": 6,
        "tests_pass_end": 6
      },
      "failureModes": {
        "production-before-red": 3,
        "missing-commit": 4,
        "split-test-and-code-commit": 4,
        "tests-failing-at-end": 4
      },
      "medianDurationSec": 165,
      "medianCommits": 3
    },
    {
      "model": "model-d",
      "condition": "harness",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 6,
        "extended_discipline": 5,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 4,
        "tests-failing-at-end": 3,
        "discipline-drift": 5
      },
      "medianDurationSec": 606,
      "medianCommits": 7
    },
    {
      "model": "model-d",
      "condition": "baseline",
      "scenario": "go-subtract",
      "trials": 10,
      "passes": {
        "test_first": 1,
        "protocol_fidelity": 0,
        "commit_discipline": 1,
        "commit_quality": 3,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 9,
        "missing-commit": 9,
        "split-test-and-code-commit": 7,
        "tests-failing-at-end": 3
      },
      "medianDurationSec": 115,
      "medianCommits": 0
    },
    {
      "model": "model-d",
      "condition": "baseline",
      "scenario": "go-multiply",
      "trials": 10,
      "passes": {
        "test_first": 1,
        "protocol_fidelity": 1,
        "commit_discipline": 1,
        "commit_quality": 2,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 9,
        "missing-commit": 9,
        "split-test-and-code-commit": 8,
        "tests-failing-at-end": 3
      },
      "medianDurationSec": 136,
      "medianCommits": 1
    },
    {
      "model": "model-d",
      "condition": "baseline",
      "scenario": "go-clarify",
      "trials": 10,
      "passes": {
        "clarification": 3
      },
      "failureModes": {
        "no-clarification-asked": 7
      },
      "medianDurationSec": 29,
      "medianCommits": 0
    },
    {
      "model": "model-d",
      "condition": "baseline",
      "scenario": "dotnet-power",
      "trials": 10,
      "passes": {
        "test_first": 1,
        "protocol_fidelity": 0,
        "commit_discipline": 0,
        "commit_quality": 2,
        "tests_pass_end": 7
      },
      "failureModes": {
        "production-before-red": 9,
        "missing-commit": 10,
        "split-test-and-code-commit": 8,
        "tests-failing-at-end": 3
      },
      "medianDurationSec": 125,
      "medianCommits": 1
    },
    {
      "model": "model-d",
      "condition": "baseline",
      "scenario": "go-drift",
      "trials": 10,
      "passes": {
        "test_first": 2,
        "extended_discipline": 0,
        "tests_pass_end": 6
      },
      "failureModes": {
        "production-before-red": 8,
        "tests-failing-at-end": 4,
        "discipline-drift": 10
      },
      "medianDurationSec": 474,
      "medianCommits": 1
    }
  ]
};
