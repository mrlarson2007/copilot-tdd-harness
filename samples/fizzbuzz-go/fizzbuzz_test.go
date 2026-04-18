package fizzbuzz

import "testing"

func TestWhenInputIsOne_ShouldReturnOne(t *testing.T) {
got := FizzBuzz(1)
want := "1"

if got != want {
t.Fatalf("expected %q, got %q", want, got)
}
}
