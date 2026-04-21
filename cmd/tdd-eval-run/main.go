// Command tdd-eval-run produces a deterministic run-summary JSON document
// for a TDD agent benchmark run by analyzing the git history of a workspace
// against a known baseline ref. The output conforms to v1 of
// evals/schema/run-summary.schema.json.
//
// Example:
//
//	tdd-eval-run summarize \
//	  --workspace ./samples/calculator-cli-go \
//	  --baseline baseline \
//	  --fixture-id calculator-cli-go \
//	  --scenario-id feature-add-subtract-command \
//	  --scenario-family feature \
//	  --run-mode micro-cycle \
//	  --tests-passed-at-end \
//	  > run-summary.json
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/mrlarson2007/copilot-tdd-harness/internal/evalrun"
)

func main() {
	if len(os.Args) < 2 || os.Args[1] != "summarize" {
		fmt.Fprintln(os.Stderr, "usage: tdd-eval-run summarize [flags]")
		os.Exit(2)
	}

	fs := flag.NewFlagSet("summarize", flag.ExitOnError)
	workspace := fs.String("workspace", "", "path to git workspace where the run took place")
	baseline := fs.String("baseline", "", "git ref (sha/tag/branch) marking the start of the run")
	fixtureID := fs.String("fixture-id", "", "fixture identifier (matches a directory under samples/)")
	baselineID := fs.String("baseline-id", "", "scenario-declared baseline identifier (optional)")
	scenarioID := fs.String("scenario-id", "", "scenario identifier")
	scenarioFamily := fs.String("scenario-family", "", "scenario family: feature|validation|bug-fix|refactor-only|ambiguous|longitudinal")
	runMode := fs.String("run-mode", "micro-cycle", "run mode: micro-cycle|longitudinal")
	prompt := fs.String("prompt", "", "user prompt used for the run (verbatim)")
	clarificationAsked := fs.Bool("clarification-asked", false, "whether the agent asked a clarifying question")
	clarificationExpected := fs.Bool("clarification-expected", false, "whether the scenario expected a clarifying question")
	testsPassedAtEnd := fs.Bool("tests-passed-at-end", false, "verified test outcome at HEAD")
	testRunCount := fs.Int("test-run-count", 0, "number of test executions observed during the run")
	firstFailingTestName := fs.String("first-failing-test", "", "name of the first failing test observed")
	notes := fs.String("notes", "", "free-form notes (optional)")
	_ = fs.Parse(os.Args[2:])

	if *workspace == "" || *baseline == "" || *fixtureID == "" || *scenarioID == "" || *scenarioFamily == "" {
		fmt.Fprintln(os.Stderr, "summarize: --workspace, --baseline, --fixture-id, --scenario-id, --scenario-family are required")
		os.Exit(2)
	}

	summary, err := evalrun.Summarize(evalrun.Opts{
		WorkspaceDir:          *workspace,
		BaselineRef:           *baseline,
		FixtureID:             *fixtureID,
		BaselineID:            *baselineID,
		ScenarioID:            *scenarioID,
		ScenarioFamily:        *scenarioFamily,
		RunMode:               *runMode,
		Prompt:                *prompt,
		ClarificationAsked:    *clarificationAsked,
		ClarificationExpected: *clarificationExpected,
		TestsPassedAtEnd:      *testsPassedAtEnd,
		TestRunCount:          *testRunCount,
		FirstFailingTestName:  *firstFailingTestName,
		Notes:                 *notes,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "summarize: %v\n", err)
		os.Exit(1)
	}

	out, err := evalrun.MarshalJSON(summary)
	if err != nil {
		fmt.Fprintf(os.Stderr, "marshal: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(out))
}
