package tddruntests

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type Config struct {
	TestCommand    string
	TestWorkingDir string
}

func LoadConfig(repoRoot string) Config {
	config := Config{
		TestCommand:    strings.TrimSpace(os.Getenv("TDD_TEST_COMMAND")),
		TestWorkingDir: strings.TrimSpace(os.Getenv("TDD_TEST_WORKING_DIR")),
	}

	if config.TestCommand == "" || config.TestWorkingDir == "" {
		raw, err := os.ReadFile(filepath.Join(repoRoot, ".github", "tdd-config.json"))
		if err == nil {
			var parsed struct {
				TestCommand    string `json:"testCommand"`
				TestWorkingDir string `json:"testWorkingDir"`
			}
			if json.Unmarshal(raw, &parsed) == nil {
				if config.TestCommand == "" {
					config.TestCommand = strings.TrimSpace(parsed.TestCommand)
				}
				if config.TestWorkingDir == "" {
					config.TestWorkingDir = strings.TrimSpace(parsed.TestWorkingDir)
				}
			}
		}
	}

	if config.TestCommand == "" {
		config.TestCommand = detectTestCommand(repoRoot)
	}
	if config.TestWorkingDir == "" {
		config.TestWorkingDir = "."
	}
	return config
}

func detectTestCommand(repoRoot string) string {
	fileExists := func(path string) bool {
		_, err := os.Stat(filepath.Join(repoRoot, path))
		return err == nil
	}
	if findBySuffixWithinDepth(repoRoot, []string{".sln", ".csproj"}, 2) {
		return "dotnet test"
	}

	if fileExists("package.json") {
		raw, err := os.ReadFile(filepath.Join(repoRoot, "package.json"))
		if err == nil {
			content := string(raw)
			if strings.Contains(content, `"vitest"`) {
				return "npx vitest run"
			}
			if strings.Contains(content, `"jest"`) {
				return "npm test -- --runInBand"
			}
		}
	}

	if findByNameWithinDepth(repoRoot, map[string]struct{}{"pyproject.toml": {}, "requirements.txt": {}, "setup.py": {}}, 2) {
		return "pytest"
	}
	if fileExists("pom.xml") {
		return "mvn test"
	}
	if findByNameWithinDepth(repoRoot, map[string]struct{}{"build.gradle": {}, "build.gradle.kts": {}}, 2) {
		return "./gradlew test"
	}
	return ""
}

func findByNameWithinDepth(repoRoot string, names map[string]struct{}, maxDepth int) bool {
	found := false
	_ = filepath.WalkDir(repoRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil || found {
			return nil
		}
		rel, relErr := filepath.Rel(repoRoot, path)
		if relErr != nil || rel == "." {
			return nil
		}
		depth := strings.Count(rel, string(filepath.Separator))
		if d.IsDir() {
			if depth > maxDepth {
				return filepath.SkipDir
			}
			return nil
		}
		if depth <= maxDepth {
			if _, ok := names[d.Name()]; ok {
				found = true
			}
		}
		return nil
	})
	return found
}

func findBySuffixWithinDepth(repoRoot string, suffixes []string, maxDepth int) bool {
	found := false
	_ = filepath.WalkDir(repoRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil || found {
			return nil
		}
		rel, relErr := filepath.Rel(repoRoot, path)
		if relErr != nil || rel == "." {
			return nil
		}
		depth := strings.Count(rel, string(filepath.Separator))
		if d.IsDir() {
			if depth > maxDepth {
				return filepath.SkipDir
			}
			return nil
		}
		if depth <= maxDepth {
			for _, suffix := range suffixes {
				if strings.HasSuffix(d.Name(), suffix) {
					found = true
					break
				}
			}
		}
		return nil
	})
	return found
}

func RunTestCommand(testWorkingDir string, testCommand string) (string, int) {
	if strings.TrimSpace(testCommand) == "" {
		return "", 0
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", testCommand)
	} else {
		cmd = exec.Command("sh", "-c", testCommand)
	}
	cmd.Dir = testWorkingDir
	out, err := cmd.CombinedOutput()
	if err == nil {
		return string(out), 0
	}
	if exitErr, ok := err.(*exec.ExitError); ok {
		return string(out), exitErr.ExitCode()
	}
	return string(out), 1
}

func LatestGitMessage() string {
	cmd := exec.Command("git", "log", "-1", "--pretty=%s")
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
