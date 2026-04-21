package calculator

import "testing"

func TestAdd_ReturnsSumOfTwoIntegers(t *testing.T) {
	got := Add(2, 3)
	want := 5

	if got != want {
		t.Fatalf("expected %d, got %d", want, got)
	}
}
