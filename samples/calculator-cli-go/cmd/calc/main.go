// Command calc is the CLI entry point for the calculator-cli-go fixture.
//
// The baseline supports only the "add" subcommand. Scenarios drive the
// addition of further commands, argument validation, and exit-code behavior.
package main

import (
	"fmt"
	"os"
	"strconv"

	calculator "samples/calculator-cli-go"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: calc <command> [args...]")
		os.Exit(2)
	}

	switch os.Args[1] {
	case "add":
		if len(os.Args) != 4 {
			fmt.Fprintln(os.Stderr, "usage: calc add <a> <b>")
			os.Exit(2)
		}
		a, errA := strconv.Atoi(os.Args[2])
		b, errB := strconv.Atoi(os.Args[3])
		if errA != nil || errB != nil {
			fmt.Fprintln(os.Stderr, "add: arguments must be integers")
			os.Exit(2)
		}
		fmt.Println(calculator.Add(a, b))
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n", os.Args[1])
		os.Exit(2)
	}
}
