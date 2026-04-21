// Package evalrun produces a deterministic run-summary JSON document from a
// completed TDD agent run, by analyzing the git history of a workspace
// against a known baseline ref.
//
// The package is intentionally small and dependency-free. It is not a live
// agent runner: it post-processes a workspace where the agent (or a human)
// has already done the work. This lets the same artifact-derived schema
// drive both manual and automated runs.
package evalrun

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

// SchemaVersion is the run-summary schema version produced by this package.
const SchemaVersion = "1.0.0"

// Opts controls a single Summarize invocation.
type Opts struct {
	// WorkspaceDir is the path to the git working tree containing the run.
	WorkspaceDir string
	// BaselineRef is the git ref (sha, tag, branch) at which the run started.
	// Commits in BaselineRef..HEAD are considered "the run".
	BaselineRef string

	// Scenario context, copied verbatim into the summary.
	FixtureID      string
	BaselineID     string
	ScenarioID     string
	ScenarioFamily string
	RunMode        string
	Prompt         string

	// ClarificationAsked is reported by the orchestrator (true iff the agent
	// asked a clarifying question before producing code).
	ClarificationAsked bool
	// ClarificationExpected is taken from the scenario manifest. When true
	// and ClarificationAsked is false, the "missing-clarification" failure
	// mode is recorded.
	ClarificationExpected bool

	// TestFilePatterns are filename glob patterns (matched on basename) that
	// classify a file as a test file. Default: ["*_test.go"].
	TestFilePatterns []string

	// NewTestPatterns are regular-expression-free substring markers used to
	// count newly added test cases inside test files. Default: ["func Test"].
	// A line counts when it appears as an added line in a unified diff and
	// contains one of these markers.
	NewTestPatterns []string

	// TestsPassedAtEnd is the verified test outcome at HEAD, reported by the
	// orchestrator after running the configured test command.
	TestsPassedAtEnd bool
	// TestRunCount is the number of test executions observed during the run,
	// reported by the orchestrator.
	TestRunCount int
	// FirstFailingTestName is optionally reported by the orchestrator.
	FirstFailingTestName string

	// Notes is optional free-form notes that pass through to the summary.
	Notes string
}

// PhaseTransition mirrors the schema entry.
type PhaseTransition struct {
	Phase          string `json:"phase"`
	Source         string `json:"source"`
	Ref            string `json:"ref,omitempty"`
	AtTestRunIndex *int   `json:"atTestRunIndex,omitempty"`
}

// RunSummary mirrors evals/schema/run-summary.schema.json (v1.0.0).
type RunSummary struct {
	SchemaVersion                            string            `json:"schemaVersion"`
	FixtureID                                string            `json:"fixtureId"`
	BaselineID                               string            `json:"baselineId,omitempty"`
	ScenarioID                               string            `json:"scenarioId"`
	ScenarioFamily                           string            `json:"scenarioFamily"`
	RunMode                                  string            `json:"runMode"`
	Prompt                                   string            `json:"prompt"`
	PhaseTransitions                         []PhaseTransition `json:"phaseTransitions"`
	ClarificationAsked                       bool              `json:"clarificationAsked"`
	NewTestsAdded                            int               `json:"newTestsAdded"`
	ProductionFilesChanged                   int               `json:"productionFilesChanged"`
	ProductionChangedBeforeFirstFailingTest  bool              `json:"productionChangedBeforeFirstFailingTest"`
	TestsPassedAtEnd                         bool              `json:"testsPassedAtEnd"`
	TestRunCount                             int               `json:"testRunCount"`
	FirstFailingTestName                     string            `json:"firstFailingTestName,omitempty"`
	CommitCount                              int               `json:"commitCount"`
	TestAndCodeCommittedTogether             bool              `json:"testAndCodeCommittedTogether"`
	CoverageDelta                            *float64          `json:"coverageDelta"`
	FailureModes                             []string          `json:"failureModes"`
	Notes                                    string            `json:"notes,omitempty"`
}

// Summarize analyzes the workspace's git history and produces a run-summary.
func Summarize(opts Opts) (RunSummary, error) {
	if opts.WorkspaceDir == "" {
		return RunSummary{}, fmt.Errorf("WorkspaceDir is required")
	}
	if opts.BaselineRef == "" {
		return RunSummary{}, fmt.Errorf("BaselineRef is required")
	}
	if len(opts.TestFilePatterns) == 0 {
		opts.TestFilePatterns = []string{"*_test.go"}
	}
	if len(opts.NewTestPatterns) == 0 {
		opts.NewTestPatterns = []string{"func Test"}
	}

	commits, err := listCommits(opts.WorkspaceDir, opts.BaselineRef)
	if err != nil {
		return RunSummary{}, fmt.Errorf("list commits: %w", err)
	}

	commitInfos := make([]commitInfo, 0, len(commits))
	for _, sha := range commits {
		info, err := describeCommit(opts.WorkspaceDir, sha, opts.TestFilePatterns)
		if err != nil {
			return RunSummary{}, fmt.Errorf("describe commit %s: %w", sha, err)
		}
		commitInfos = append(commitInfos, info)
	}

	prodFiles, testFiles, err := changedFilesSinceBaseline(opts.WorkspaceDir, opts.BaselineRef, opts.TestFilePatterns)
	if err != nil {
		return RunSummary{}, fmt.Errorf("changed files: %w", err)
	}

	newTests, err := countAddedTests(opts.WorkspaceDir, opts.BaselineRef, testFiles, opts.NewTestPatterns)
	if err != nil {
		return RunSummary{}, fmt.Errorf("count added tests: %w", err)
	}

	prodBeforeRed := computeProductionBeforeRed(commitInfos)
	togetherCommits := computeTestAndCodeTogether(commitInfos)
	transitions := computePhaseTransitions(commitInfos)

	failureModes := []string{}
	if prodBeforeRed {
		failureModes = append(failureModes, "production-before-red")
	}
	if !anyTestModified(commitInfos) && newTests == 0 {
		failureModes = append(failureModes, "no-failing-test-observed")
	}
	if !opts.TestsPassedAtEnd {
		failureModes = append(failureModes, "tests-failing-at-end")
	}
	if !togetherCommits {
		failureModes = append(failureModes, "test-and-code-split-commit")
	}
	if len(commitInfos) == 0 {
		failureModes = append(failureModes, "no-commit-produced")
	}
	if opts.ClarificationExpected && !opts.ClarificationAsked {
		failureModes = append(failureModes, "missing-clarification")
	}

	testRunCount := opts.TestRunCount
	if testRunCount == 0 {
		// Conservative default when the orchestrator did not report a count.
		testRunCount = len(commitInfos)
	}

	return RunSummary{
		SchemaVersion:                           SchemaVersion,
		FixtureID:                               opts.FixtureID,
		BaselineID:                              opts.BaselineID,
		ScenarioID:                              opts.ScenarioID,
		ScenarioFamily:                          opts.ScenarioFamily,
		RunMode:                                 opts.RunMode,
		Prompt:                                  opts.Prompt,
		PhaseTransitions:                        transitions,
		ClarificationAsked:                      opts.ClarificationAsked,
		NewTestsAdded:                           newTests,
		ProductionFilesChanged:                  len(prodFiles),
		ProductionChangedBeforeFirstFailingTest: prodBeforeRed,
		TestsPassedAtEnd:                        opts.TestsPassedAtEnd,
		TestRunCount:                            testRunCount,
		FirstFailingTestName:                    opts.FirstFailingTestName,
		CommitCount:                             len(commitInfos),
		TestAndCodeCommittedTogether:            togetherCommits,
		CoverageDelta:                           nil,
		FailureModes:                            failureModes,
		Notes:                                   opts.Notes,
	}, nil
}

// MarshalJSON returns the canonical JSON encoding of a run-summary.
func MarshalJSON(s RunSummary) ([]byte, error) {
	return json.MarshalIndent(s, "", "  ")
}

type commitInfo struct {
	SHA            string
	Message        string
	ChangedFiles   []string
	TestFiles      []string
	ProdFiles      []string
}

func listCommits(workspace, baseline string) ([]string, error) {
	out, err := runGit(workspace, "log", "--reverse", "--pretty=%H", baseline+"..HEAD")
	if err != nil {
		return nil, err
	}
	out = strings.TrimSpace(out)
	if out == "" {
		return nil, nil
	}
	return strings.Split(out, "\n"), nil
}

func describeCommit(workspace, sha string, testPatterns []string) (commitInfo, error) {
	msg, err := runGit(workspace, "log", "-1", "--pretty=%s", sha)
	if err != nil {
		return commitInfo{}, err
	}
	files, err := runGit(workspace, "show", "--name-only", "--pretty=", sha)
	if err != nil {
		return commitInfo{}, err
	}
	info := commitInfo{
		SHA:     sha,
		Message: strings.TrimSpace(msg),
	}
	for _, line := range strings.Split(strings.TrimSpace(files), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		info.ChangedFiles = append(info.ChangedFiles, line)
		if isTestFile(line, testPatterns) {
			info.TestFiles = append(info.TestFiles, line)
		} else {
			info.ProdFiles = append(info.ProdFiles, line)
		}
	}
	return info, nil
}

func changedFilesSinceBaseline(workspace, baseline string, testPatterns []string) (prodFiles, testFiles []string, err error) {
	out, err := runGit(workspace, "diff", "--name-only", baseline+"..HEAD")
	if err != nil {
		return nil, nil, err
	}
	prodSet := map[string]struct{}{}
	testSet := map[string]struct{}{}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if isTestFile(line, testPatterns) {
			testSet[line] = struct{}{}
		} else {
			prodSet[line] = struct{}{}
		}
	}
	prodFiles = sortedKeys(prodSet)
	testFiles = sortedKeys(testSet)
	return prodFiles, testFiles, nil
}

func countAddedTests(workspace, baseline string, testFiles []string, markers []string) (int, error) {
	if len(testFiles) == 0 {
		return 0, nil
	}
	args := []string{"diff", "--unified=0", baseline + "..HEAD", "--"}
	args = append(args, testFiles...)
	out, err := runGit(workspace, args...)
	if err != nil {
		return 0, err
	}
	count := 0
	for _, line := range strings.Split(out, "\n") {
		if !strings.HasPrefix(line, "+") || strings.HasPrefix(line, "+++") {
			continue
		}
		body := line[1:]
		for _, marker := range markers {
			if strings.Contains(body, marker) {
				count++
				break
			}
		}
	}
	return count, nil
}

func computeProductionBeforeRed(commits []commitInfo) bool {
	// Walk commits chronologically (listCommits already used --reverse).
	// If any commit modifies production files before the first commit that
	// modifies a test file, flag it.
	for _, c := range commits {
		if len(c.TestFiles) > 0 {
			return false
		}
		if len(c.ProdFiles) > 0 {
			return true
		}
	}
	return false
}

func computeTestAndCodeTogether(commits []commitInfo) bool {
	if len(commits) == 0 {
		return true // vacuously true
	}
	for _, c := range commits {
		if len(c.ProdFiles) > 0 && len(c.TestFiles) == 0 {
			return false
		}
	}
	return true
}

func computePhaseTransitions(commits []commitInfo) []PhaseTransition {
	transitions := []PhaseTransition{}
	for _, c := range commits {
		phase := phaseFromMessage(c.Message)
		if phase == "" {
			continue
		}
		transitions = append(transitions, PhaseTransition{
			Phase:  phase,
			Source: "commit",
			Ref:    c.SHA,
		})
	}
	return transitions
}

func phaseFromMessage(msg string) string {
	lower := strings.ToLower(msg)
	switch {
	case strings.Contains(lower, "red"):
		return "RED"
	case strings.Contains(lower, "green"):
		return "GREEN"
	case strings.Contains(lower, "refactor"):
		return "REFACTOR"
	case strings.Contains(lower, "commit"):
		return "COMMIT"
	default:
		return ""
	}
}

func anyTestModified(commits []commitInfo) bool {
	for _, c := range commits {
		if len(c.TestFiles) > 0 {
			return true
		}
	}
	return false
}

func isTestFile(path string, patterns []string) bool {
	base := filepath.Base(path)
	for _, p := range patterns {
		if ok, _ := filepath.Match(p, base); ok {
			return true
		}
	}
	return false
}

func sortedKeys(m map[string]struct{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func runGit(workspace string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = workspace
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("git %s: %w (%s)", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}
