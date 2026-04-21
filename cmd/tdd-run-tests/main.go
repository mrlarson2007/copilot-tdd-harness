package main

import (
	"encoding/json"
	"flag"
	"os"
	"strings"

	"github.com/mrlarson2007/copilot-tdd-harness/internal/tddruntests"
)

func main() {
	modeValue := parseModeArg()
	mode, ok := tddruntests.ParseMode(modeValue)
	if !ok {
		writeJSON(map[string]any{
			"event":    "Error",
			"decision": "continue",
			"message":  "Unsupported mode: " + strings.TrimSpace(modeValue) + ". Supported modes are hint, step, terminal, state, status.",
		})
		return
	}

	repoRoot, err := os.Getwd()
	if err != nil {
		repoRoot = "."
	}

	config := tddruntests.LoadConfig(repoRoot)
	testOutput, testExitCode := tddruntests.RunTestCommand(config.TestWorkingDir, config.TestCommand)
	state := tddruntests.ParseTestState(testOutput, testExitCode)
	gitMessage := tddruntests.LatestGitMessage()
	phase := tddruntests.ResolvePhase(gitMessage, os.Getenv("TDD_PHASE"), state.Failed)
	stopHookActive := tddruntests.ResolveStopHookActive(os.Getenv("STOP_HOOK_ACTIVE"), os.Getenv("stop_hook_active"))
	phaseConstraint := phaseConstraint(phase)

	nextAction := "All tests are passing. Continue with COMMIT or REFACTOR discipline."
	if state.Failed > 0 {
		nextAction = "Continue GREEN phase: make the failing test pass with the minimal production change."
	}

	payload := tddruntests.BuildPayload(mode, tddruntests.PayloadInput{
		Phase:           phase,
		PhaseConstraint: phaseConstraint,
		State:           state,
		StopHookActive:  stopHookActive,
		LastCommitted:   gitMessage,
		RecommendedNext: nextAction,
		TestCommand:     config.TestCommand,
		TestWorkingDir:  config.TestWorkingDir,
	})
	writeJSON(payload)
}

func parseModeArg() string {
	if len(os.Args) > 1 && !strings.HasPrefix(os.Args[1], "-") {
		return os.Args[1]
	}
	fs := flag.NewFlagSet("tdd-run-tests", flag.ContinueOnError)
	mode := fs.String("mode", "status", "mode to run")
	_ = fs.Parse(os.Args[1:])
	return *mode
}

func phaseConstraint(phase string) string {
	switch phase {
	case "RED":
		return "write exactly one failing test and avoid production changes."
	case "GREEN":
		return "write only the minimal production code needed to make the failing test pass."
	case "REFACTOR":
		return "refactor only while all tests remain green and behavior stays unchanged."
	case "COMMIT":
		return "commit test and production changes together for one completed behavior."
	default:
		return "follow the current phase rule strictly and keep changes minimal."
	}
}

func writeJSON(payload map[string]any) {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	_ = encoder.Encode(payload)
}
