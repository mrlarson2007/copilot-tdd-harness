// Package calculator is the baseline for the calculator-cli-go benchmark fixture.
//
// The baseline intentionally exposes only a single trivial behavior (Add) so
// that scenarios can drive new behavior additions, validation handling, and
// bug-fix regressions from a known-clean starting point.
package calculator

// Add returns the sum of two integers.
func Add(a, b int) int {
	return a + b
}
