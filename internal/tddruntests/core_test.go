package tddruntests

import "testing"

func TestParseMode_WhenModeIsUnsupported_ShouldReturnErrorMode(t *testing.T) {
	_, ok := ParseMode("wat")
	if ok {
		t.Fatal("expected unsupported mode to be rejected")
	}
}

func TestResolvePhase_WhenEnvPhaseSet_ShouldUseEnvPhase(t *testing.T) {
	phase := ResolvePhase("green behavior", "red", 0)
	if phase != "RED" {
		t.Fatalf("expected RED from env phase override, got %q", phase)
	}
}

func TestBuildTerminalPayload_WhenStopHookActive_ShouldAllowWithGuardMessage(t *testing.T) {
	payload := BuildTerminalPayload("go test ./...", State{Passed: 2, Failed: 1}, true)
	if payload["decision"] != "allow" {
		t.Fatalf("expected allow decision, got %v", payload["decision"])
	}
	if payload["message"] != "stop_hook_active=true, skipping terminal enforcement to prevent recursion." {
		t.Fatalf("unexpected message: %v", payload["message"])
	}
}

func TestBuildTerminalPayload_WhenTestsFail_ShouldBlock(t *testing.T) {
	payload := BuildTerminalPayload("go test ./...", State{Passed: 4, Failed: 2}, false)
	if payload["decision"] != "block" {
		t.Fatalf("expected block decision, got %v", payload["decision"])
	}
	if payload["message"] != "2 tests failing. Run tests and make them pass before finishing." {
		t.Fatalf("unexpected message: %v", payload["message"])
	}
}

func TestResolvePhase_WhenNoSignalAndFailing_ShouldDefaultToGreen(t *testing.T) {
	phase := ResolvePhase("", "", 1)
	if phase != "GREEN" {
		t.Fatalf("expected GREEN fallback for failing state, got %q", phase)
	}
}

func TestBuildPayload_WhenModeHint_ShouldEmitUserPromptSubmitSchema(t *testing.T) {
	payload := BuildPayload(ModeHint, PayloadInput{
		Phase:           "GREEN",
		PhaseConstraint: "minimal production code only.",
	})
	if payload["event"] != "UserPromptSubmit" {
		t.Fatalf("expected UserPromptSubmit event, got %v", payload["event"])
	}
	if payload["decision"] != "continue" {
		t.Fatalf("expected continue decision, got %v", payload["decision"])
	}
}

func TestBuildPayload_WhenModeStepAndFailing_ShouldIncludeFailureRecord(t *testing.T) {
	payload := BuildPayload(ModeStep, PayloadInput{
		Phase: "GREEN",
		State: State{
			Passed:           1,
			Failed:           1,
			FirstFailureTest: "WhenX_ShouldY",
			Expected:         "1",
			Actual:           "0",
			LikelyCause:      "branch mismatch",
			Reflexion:        "REFLEXION: ...",
		},
	})
	failures := payload["failures"].([]map[string]string)
	if len(failures) != 1 {
		t.Fatalf("expected one failure item, got %d", len(failures))
	}
	if failures[0]["testName"] != "WhenX_ShouldY" {
		t.Fatalf("unexpected failure test name: %v", failures[0]["testName"])
	}
}

func TestParseTestState_WhenGoTestFailureOutput_ShouldExtractCoreFields(t *testing.T) {
	output := "--- FAIL: WhenInputIsZero_ShouldReturnErr (0.00s)\nexpected: 1\nactual: 0\nFAIL\n1 failed, 3 passed"
	state := ParseTestState(output, 1)
	if state.Passed != 3 || state.Failed != 1 {
		t.Fatalf("expected passed=3 failed=1, got passed=%d failed=%d", state.Passed, state.Failed)
	}
	if state.FirstFailureTest != "WhenInputIsZero_ShouldReturnErr" {
		t.Fatalf("unexpected first failure test: %q", state.FirstFailureTest)
	}
}

func TestResolveStopHookActive_WhenSetToYes_ShouldEnableGuard(t *testing.T) {
	if !ResolveStopHookActive("yes", "") {
		t.Fatal("expected yes to enable stop hook guard")
	}
}
