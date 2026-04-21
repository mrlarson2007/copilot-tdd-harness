package tddruntests

import (
	"regexp"
	"strconv"
	"strings"
)

type Mode string

const (
	ModeHint     Mode = "hint"
	ModeStep     Mode = "step"
	ModeTerminal Mode = "terminal"
	ModeState    Mode = "state"
	ModeStatus   Mode = "status"
)

type State struct {
	Passed           int
	Failed           int
	FirstFailureTest string
	Expected         string
	Actual           string
	LikelyCause      string
	Reflexion        string
	TestExitCode     int
}

type PayloadInput struct {
	Phase               string
	PhaseConstraint     string
	State               State
	StopHookActive      bool
	LastCommitted       string
	RecommendedNext     string
	TestCommand         string
	TestWorkingDir      string
	StateReflexionLabel string
}

var (
	passedPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(\d+)\s+passed`),
		regexp.MustCompile(`(?i)(\d+)\s+passing`),
		regexp.MustCompile(`(?i)passed:\s*(\d+)`),
	}
	failedPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(\d+)\s+failed`),
		regexp.MustCompile(`(?i)(\d+)\s+failing`),
		regexp.MustCompile(`(?i)failed:\s*(\d+)`),
		regexp.MustCompile(`(?i)Failures:\s*(\d+)`),
	}
	firstFailurePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?m)^--- FAIL: ([^\s:()]+).*`),
		regexp.MustCompile(`(?m)^\s*✕\s+(.+)$`),
		regexp.MustCompile(`(?m)^\s*\d+\)\s+(.+)$`),
	}
	expectedPattern = regexp.MustCompile(`(?im)expected[:\s]+(.+)$`)
	actualPattern   = regexp.MustCompile(`(?im)(received|actual)[:\s]+(.+)$`)
)

func ParseMode(value string) (Mode, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(ModeHint):
		return ModeHint, true
	case string(ModeStep):
		return ModeStep, true
	case string(ModeTerminal):
		return ModeTerminal, true
	case string(ModeState):
		return ModeState, true
	case string(ModeStatus), "":
		return ModeStatus, true
	default:
		return "", false
	}
}

func ResolvePhase(gitMessage string, envPhase string, failedCount int) string {
	if strings.TrimSpace(envPhase) != "" {
		return strings.ToUpper(strings.TrimSpace(envPhase))
	}

	lower := strings.ToLower(gitMessage)
	switch {
	case strings.Contains(lower, "red"):
		return "RED"
	case strings.Contains(lower, "green"):
		return "GREEN"
	case strings.Contains(lower, "refactor"):
		return "REFACTOR"
	case strings.Contains(lower, "commit"):
		return "COMMIT"
	case failedCount > 0:
		return "GREEN"
	default:
		return "REFACTOR"
	}
}

func BuildTerminalPayload(testCommand string, state State, stopHookActive bool) map[string]any {
	if stopHookActive {
		return map[string]any{
			"event":            "Stop",
			"passed":           state.Passed,
			"failed":           state.Failed,
			"decision":         "allow",
			"stop_hook_active": true,
			"message":          "stop_hook_active=true, skipping terminal enforcement to prevent recursion.",
		}
	}

	decision := "allow"
	message := "No test command configured; terminal hook allows progress."
	if state.Failed > 0 {
		decision = "block"
		if state.Failed == 1 {
			message = "1 test failing. Run tests and make them pass before finishing."
		} else {
			message = strconv.Itoa(state.Failed) + " tests failing. Run tests and make them pass before finishing."
		}
	} else if strings.TrimSpace(testCommand) != "" {
		message = "All " + strconv.Itoa(state.Passed) + " tests pass. GREEN phase complete."
	}

	return map[string]any{
		"event":            "Stop",
		"passed":           state.Passed,
		"failed":           state.Failed,
		"decision":         decision,
		"stop_hook_active": stopHookActive,
		"message":          message,
	}
}

func ParseTestState(testOutput string, testExitCode int) State {
	state := State{
		Passed:       0,
		Failed:       0,
		TestExitCode: testExitCode,
	}

	for _, pattern := range passedPatterns {
		if num, ok := firstNumber(pattern, testOutput); ok {
			state.Passed = num
			break
		}
	}
	for _, pattern := range failedPatterns {
		if num, ok := firstNumber(pattern, testOutput); ok {
			state.Failed = num
			break
		}
	}
	if testExitCode != 0 && state.Failed == 0 {
		state.Failed = 1
	}

	if state.Failed > 0 {
		for _, pattern := range firstFailurePatterns {
			if match := pattern.FindStringSubmatch(testOutput); len(match) > 1 {
				state.FirstFailureTest = strings.TrimSpace(match[1])
				break
			}
		}
		if state.FirstFailureTest == "" {
			state.FirstFailureTest = "UnknownTest"
		}
		if match := expectedPattern.FindStringSubmatch(testOutput); len(match) > 1 {
			state.Expected = strings.TrimSpace(match[1])
		}
		if match := actualPattern.FindStringSubmatch(testOutput); len(match) > 2 {
			state.Actual = strings.TrimSpace(match[2])
		}
		if state.Expected == "" {
			state.Expected = "expected behavior"
		}
		if state.Actual == "" {
			state.Actual = "actual behavior differs"
		}
	}

	state.LikelyCause = "the implementation for this behavior is incomplete"
	hypothesis := "update the production code minimally to satisfy the failing assertion, then rerun tests"
	if state.Failed > 0 {
		testOutputLower := strings.ToLower(testOutput)
		if strings.Contains(testOutputLower, "expected") && (strings.Contains(testOutputLower, "actual") || strings.Contains(testOutputLower, "received")) {
			state.LikelyCause = "assertion mismatch indicates current behavior differs from test expectation"
			hypothesis = "adjust the implementation branch used by the failing test, then rerun tests"
		} else if strings.Contains(testOutputLower, "command not found") || strings.Contains(testOutputLower, "is not recognized as") {
			state.LikelyCause = "configured test command is unavailable in the current environment"
			hypothesis = "fix testCommand/testWorkingDir configuration and rerun tests"
		} else if strings.Contains(testOutputLower, "module not found") || strings.Contains(testOutputLower, "cannot find module") || strings.Contains(testOutputLower, "importerror") {
			state.LikelyCause = "missing dependency or unresolved import in test execution path"
			hypothesis = "install or restore required dependencies and rerun tests"
		}
		state.Reflexion = "REFLEXION: " + state.FirstFailureTest + " failed. Expected " + state.Expected + ", got " + state.Actual + ". Likely cause: " + state.LikelyCause + ". Hypothesis: " + hypothesis + "."
	} else {
		state.Reflexion = "REFLEXION: All tests passed. Continue with strict phase discipline."
	}

	return state
}

func firstNumber(pattern *regexp.Regexp, text string) (int, bool) {
	match := pattern.FindStringSubmatch(text)
	if len(match) < 2 {
		return 0, false
	}
	n, err := strconv.Atoi(match[1])
	if err != nil {
		return 0, false
	}
	return n, true
}

func ResolveStopHookActive(stopHookActive string, legacyStopHookActive string) bool {
	raw := strings.TrimSpace(stopHookActive)
	if raw == "" {
		raw = strings.TrimSpace(legacyStopHookActive)
	}
	switch strings.ToLower(raw) {
	case "true", "1", "yes":
		return true
	default:
		return false
	}
}

func BuildPayload(mode Mode, input PayloadInput) map[string]any {
	switch mode {
	case ModeHint:
		return map[string]any{
			"event":             "UserPromptSubmit",
			"additionalContext": "HINT: Current phase is " + input.Phase + ". The single constraint: " + input.PhaseConstraint,
			"decision":          "continue",
		}
	case ModeStep:
		failures := []map[string]string{}
		if input.State.Failed > 0 {
			failures = append(failures, map[string]string{
				"testName": input.State.FirstFailureTest,
				"expected": input.State.Expected,
				"actual":   input.State.Actual,
				"cause":    input.State.LikelyCause,
			})
		}
		return map[string]any{
			"event":     "PostToolUse",
			"phase":     input.Phase,
			"passed":    input.State.Passed,
			"failed":    input.State.Failed,
			"failures":  failures,
			"reflexion": input.State.Reflexion,
		}
	case ModeTerminal:
		return BuildTerminalPayload(input.TestCommand, input.State, input.StopHookActive)
	case ModeState:
		stateTest := input.State.FirstFailureTest
		stateReflexion := input.State.LikelyCause
		if input.State.Failed == 0 {
			stateTest = "None"
			stateReflexion = "all tests passing"
		}
		return map[string]any{
			"event":             "PreCompact",
			"additionalContext": "TDD STATE: phase=" + input.Phase + " | test=" + stateTest + " | lastReflexion=" + stateReflexion + " | passed=" + strconv.Itoa(input.State.Passed) + " | failed=" + strconv.Itoa(input.State.Failed),
		}
	case ModeStatus:
		failingTests := []string{}
		if input.State.Failed > 0 {
			failingTests = append(failingTests, input.State.FirstFailureTest)
		}
		return map[string]any{
			"event":                 "Status",
			"phase":                 input.Phase,
			"passed":                input.State.Passed,
			"failed":                input.State.Failed,
			"failingTests":          failingTests,
			"lastCommittedBehavior": input.LastCommitted,
			"recommendedNextAction": input.RecommendedNext,
			"testCommand":           input.TestCommand,
			"testWorkingDir":        input.TestWorkingDir,
			"testExitCode":          input.State.TestExitCode,
		}
	default:
		return map[string]any{
			"event":    "Error",
			"decision": "continue",
			"message":  "Unsupported mode: " + string(mode) + ". Supported modes are hint, step, terminal, state, status.",
		}
	}
}
