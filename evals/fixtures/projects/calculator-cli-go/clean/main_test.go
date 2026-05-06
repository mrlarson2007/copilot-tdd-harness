package main

import (
	"os/exec"
	"strings"
	"testing"
)

func TestAddCommand_PrintsSum(t *testing.T) {
	cmd := exec.Command("go", "run", ".", "add", "4", "5")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected add command to succeed, got error %v with output %s", err, string(output))
	}

	if strings.TrimSpace(string(output)) != "9" {
		t.Fatalf("expected output 9, got %q", strings.TrimSpace(string(output)))
	}
}