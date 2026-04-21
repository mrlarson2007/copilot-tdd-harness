package evalrun

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// gitRepo is a tiny test helper for building synthetic git histories.
type gitRepo struct {
	t   *testing.T
	dir string
}

func newGitRepo(t *testing.T) *gitRepo {
	t.Helper()
	dir := t.TempDir()
	r := &gitRepo{t: t, dir: dir}
	r.run("git", "init", "-q", "-b", "main")
	r.run("git", "config", "user.email", "tdd@example.com")
	r.run("git", "config", "user.name", "TDD Test")
	r.run("git", "config", "commit.gpgsign", "false")
	return r
}

func (r *gitRepo) run(name string, args ...string) string {
	r.t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = r.dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		r.t.Fatalf("%s %s: %v (%s)", name, strings.Join(args, " "), err, string(out))
	}
	return string(out)
}

func (r *gitRepo) write(rel, body string) {
	r.t.Helper()
	full := filepath.Join(r.dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		r.t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
		r.t.Fatalf("write: %v", err)
	}
}

func (r *gitRepo) commit(msg string, paths ...string) {
	r.t.Helper()
	args := append([]string{"add", "--"}, paths...)
	r.run("git", args...)
	r.run("git", "commit", "-q", "-m", msg)
}

func (r *gitRepo) tag(name string) {
	r.t.Helper()
	r.run("git", "tag", name)
}

func TestSummarize_CleanRedGreenCommitFlow_NoFailureModes(t *testing.T) {
	repo := newGitRepo(t)
	repo.write("calc.go", "package calc\n")
	repo.write("README.md", "baseline\n")
	repo.commit("chore: baseline", "calc.go", "README.md")
	repo.tag("baseline")

	repo.write("calc_test.go", "package calc\n\nfunc TestSubtract(t *testing.T) {}\n")
	repo.write("calc.go", "package calc\n\nfunc Subtract(a, b int) int { return a - b }\n")
	repo.commit("RED-GREEN: subtract", "calc_test.go", "calc.go")

	got, err := Summarize(Opts{
		WorkspaceDir:     repo.dir,
		BaselineRef:      "baseline",
		FixtureID:        "calc",
		ScenarioID:       "feature-subtract",
		ScenarioFamily:   "feature",
		RunMode:          "micro-cycle",
		Prompt:           "Add subtract.",
		TestsPassedAtEnd: true,
		TestRunCount:     2,
	})
	if err != nil {
		t.Fatalf("Summarize: %v", err)
	}

	if got.CommitCount != 1 {
		t.Errorf("CommitCount = %d, want 1", got.CommitCount)
	}
	if got.NewTestsAdded != 1 {
		t.Errorf("NewTestsAdded = %d, want 1", got.NewTestsAdded)
	}
	if got.ProductionFilesChanged != 1 {
		t.Errorf("ProductionFilesChanged = %d, want 1", got.ProductionFilesChanged)
	}
	if got.ProductionChangedBeforeFirstFailingTest {
		t.Errorf("ProductionChangedBeforeFirstFailingTest = true, want false")
	}
	if !got.TestAndCodeCommittedTogether {
		t.Errorf("TestAndCodeCommittedTogether = false, want true")
	}
	if len(got.FailureModes) != 0 {
		t.Errorf("FailureModes = %v, want empty", got.FailureModes)
	}
	if len(got.PhaseTransitions) != 1 || got.PhaseTransitions[0].Phase != "RED" {
		t.Errorf("PhaseTransitions = %+v, want one RED entry (first match wins)", got.PhaseTransitions)
	}
}

func TestSummarize_ProductionBeforeRed_FlagsViolation(t *testing.T) {
	repo := newGitRepo(t)
	repo.write("calc.go", "package calc\n")
	repo.commit("chore: baseline", "calc.go")
	repo.tag("baseline")

	// Production-only commit before any test.
	repo.write("calc.go", "package calc\n\nfunc Subtract(a, b int) int { return a - b }\n")
	repo.commit("feat: subtract", "calc.go")

	// Test added afterwards.
	repo.write("calc_test.go", "package calc\n\nfunc TestSubtract(t *testing.T) {}\n")
	repo.commit("test: subtract", "calc_test.go")

	got, err := Summarize(Opts{
		WorkspaceDir:     repo.dir,
		BaselineRef:      "baseline",
		FixtureID:        "calc",
		ScenarioID:       "feature-subtract",
		ScenarioFamily:   "feature",
		RunMode:          "micro-cycle",
		Prompt:           "Add subtract.",
		TestsPassedAtEnd: true,
	})
	if err != nil {
		t.Fatalf("Summarize: %v", err)
	}

	if !got.ProductionChangedBeforeFirstFailingTest {
		t.Errorf("ProductionChangedBeforeFirstFailingTest = false, want true")
	}
	if got.TestAndCodeCommittedTogether {
		t.Errorf("TestAndCodeCommittedTogether = true, want false")
	}
	if !contains(got.FailureModes, "production-before-red") {
		t.Errorf("FailureModes missing production-before-red: %v", got.FailureModes)
	}
	if !contains(got.FailureModes, "test-and-code-split-commit") {
		t.Errorf("FailureModes missing test-and-code-split-commit: %v", got.FailureModes)
	}
}

func TestSummarize_NoCommits_VacuouslyTogetherButFlagged(t *testing.T) {
	repo := newGitRepo(t)
	repo.write("calc.go", "package calc\n")
	repo.commit("chore: baseline", "calc.go")
	repo.tag("baseline")

	got, err := Summarize(Opts{
		WorkspaceDir:     repo.dir,
		BaselineRef:      "baseline",
		FixtureID:        "calc",
		ScenarioID:       "feature-subtract",
		ScenarioFamily:   "feature",
		RunMode:          "micro-cycle",
		TestsPassedAtEnd: true,
	})
	if err != nil {
		t.Fatalf("Summarize: %v", err)
	}

	if got.CommitCount != 0 {
		t.Errorf("CommitCount = %d, want 0", got.CommitCount)
	}
	if !got.TestAndCodeCommittedTogether {
		t.Errorf("TestAndCodeCommittedTogether = false, want vacuously true")
	}
	if !contains(got.FailureModes, "no-commit-produced") {
		t.Errorf("FailureModes missing no-commit-produced: %v", got.FailureModes)
	}
	if !contains(got.FailureModes, "no-failing-test-observed") {
		t.Errorf("FailureModes missing no-failing-test-observed: %v", got.FailureModes)
	}
}

func TestSummarize_TestsFailingAtEnd_RecordsFailureMode(t *testing.T) {
	repo := newGitRepo(t)
	repo.write("calc.go", "package calc\n")
	repo.commit("chore: baseline", "calc.go")
	repo.tag("baseline")

	repo.write("calc_test.go", "package calc\n\nfunc TestSubtract(t *testing.T) {}\n")
	repo.write("calc.go", "package calc\n\nfunc Subtract(a, b int) int { return 0 }\n")
	repo.commit("RED-GREEN: subtract", "calc_test.go", "calc.go")

	got, err := Summarize(Opts{
		WorkspaceDir:     repo.dir,
		BaselineRef:      "baseline",
		FixtureID:        "calc",
		ScenarioID:       "feature-subtract",
		ScenarioFamily:   "feature",
		RunMode:          "micro-cycle",
		TestsPassedAtEnd: false,
	})
	if err != nil {
		t.Fatalf("Summarize: %v", err)
	}

	if !contains(got.FailureModes, "tests-failing-at-end") {
		t.Errorf("FailureModes missing tests-failing-at-end: %v", got.FailureModes)
	}
}

func TestSummarize_MissingClarification_FlaggedWhenExpected(t *testing.T) {
	repo := newGitRepo(t)
	repo.write("calc.go", "package calc\n")
	repo.commit("chore: baseline", "calc.go")
	repo.tag("baseline")

	repo.write("calc_test.go", "package calc\n\nfunc TestMultiply(t *testing.T) {}\n")
	repo.write("calc.go", "package calc\n\nfunc Multiply(a, b int) int { return a * b }\n")
	repo.commit("RED-GREEN: multiply", "calc_test.go", "calc.go")

	got, err := Summarize(Opts{
		WorkspaceDir:          repo.dir,
		BaselineRef:           "baseline",
		FixtureID:             "calc",
		ScenarioID:            "ambiguous-multiply",
		ScenarioFamily:        "ambiguous",
		RunMode:               "micro-cycle",
		ClarificationExpected: true,
		ClarificationAsked:    false,
		TestsPassedAtEnd:      true,
	})
	if err != nil {
		t.Fatalf("Summarize: %v", err)
	}

	if !contains(got.FailureModes, "missing-clarification") {
		t.Errorf("FailureModes missing missing-clarification: %v", got.FailureModes)
	}
}

func contains(haystack []string, needle string) bool {
	for _, h := range haystack {
		if h == needle {
			return true
		}
	}
	return false
}
