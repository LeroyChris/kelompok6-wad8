package handlers

import "testing"

func TestSandboxOTPDefault(t *testing.T) {
	t.Setenv("SANDBOX_OTP_CODE", "")
	if got := sandboxOTPCode(); got != defaultSandboxOTP {
		t.Fatalf("sandboxOTPCode() = %q, want %q", got, defaultSandboxOTP)
	}
}

func TestSandboxOTPConfigured(t *testing.T) {
	t.Setenv("SANDBOX_OTP_CODE", "654321")
	if got := sandboxOTPCode(); got != "654321" {
		t.Fatalf("sandboxOTPCode() = %q", got)
	}
}
