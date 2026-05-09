package main

import (
	"fmt"
	"os"
	"strconv"
)

func main() {
	if len(os.Args) != 4 {
		fmt.Println("usage: calc <add> <left> <right>")
		os.Exit(1)
	}

	left, err := strconv.Atoi(os.Args[2])
	if err != nil {
		fmt.Println("left operand must be an integer")
		os.Exit(1)
	}

	right, err := strconv.Atoi(os.Args[3])
	if err != nil {
		fmt.Println("right operand must be an integer")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "add":
		fmt.Println(left + right)
	default:
		fmt.Printf("unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}