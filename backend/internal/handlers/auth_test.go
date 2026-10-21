package handlers

import "testing"

func TestNormalizePhoneNumber(t *testing.T) {
	tests := []struct {
		input string
		want  string
		valid bool
	}{
		{"081234567890", "081234567890", true},
		{"+62 812-3456-7890", "081234567890", true},
		{"81234567890", "081234567890", true},
		{"123", "", false},
	}
	for _, test := range tests {
		got, err := normalizePhoneNumber(test.input)
		if (err == nil) != test.valid || got != test.want {
			t.Fatalf("normalizePhoneNumber(%q) = %q, %v; want %q, valid=%v", test.input, got, err, test.want, test.valid)
		}
	}
}
