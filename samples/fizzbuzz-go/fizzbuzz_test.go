package fizzbuzz

import "testing"

func TestWhenInputIsOne_ShouldReturnOne(t *testing.T) {
	got := FizzBuzz(1)
	want := "1"

if got != want {
t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestWhenInputDivisibleByThree_ShouldReturnFizz(t *testing.T) {
	got := FizzBuzz(3)
	want := "Fizz"

	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestWhenInputDivisibleByFive_ShouldReturnBuzz(t *testing.T) {
	got := FizzBuzz(5)
	want := "Buzz"

	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestWhenInputDivisibleByThreeAndFive_ShouldReturnFizzBuzz(t *testing.T) {
	got := FizzBuzz(15)
	want := "FizzBuzz"

	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}
