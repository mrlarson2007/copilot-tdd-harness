package fizzbuzz

import "strconv"

func FizzBuzz(n int) string {
	if n%3 == 0 {
		return "Fizz"
	}

	if n%5 == 0 {
		return "Buzz"
	}

	return strconv.Itoa(n)
}
