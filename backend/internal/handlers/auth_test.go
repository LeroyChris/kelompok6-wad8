package handlers

import (
	"testing"
	"time"
)

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

func TestConsumeOTPSingleUse(t *testing.T) {
	h := &AuthHandler{otpCodes: map[string]otpEntry{}}
	h.storeOTP("a@x.id", "123456")

	if h.consumeOTP("a@x.id", "000000") {
		t.Fatal("consumeOTP accepted a wrong code")
	}
	if !h.consumeOTP("a@x.id", "123456") {
		t.Fatal("consumeOTP rejected the correct code after a wrong attempt")
	}
	if h.consumeOTP("a@x.id", "123456") {
		t.Fatal("consumeOTP allowed a second use of the same code")
	}
}

func TestConsumeOTPExpired(t *testing.T) {
	h := &AuthHandler{otpCodes: map[string]otpEntry{}}
	h.storeOTP("b@x.id", "111111")
	h.otpMu.Lock()
	h.otpCodes["b@x.id"] = otpEntry{code: "111111", expires: time.Now().Add(-time.Minute)}
	h.otpMu.Unlock()

	if h.consumeOTP("b@x.id", "111111") {
		t.Fatal("consumeOTP accepted an expired code")
	}
}

func TestRandomOTPCodeFormat(t *testing.T) {
	code := randomOTPCode()
	if len(code) != 6 {
		t.Fatalf("randomOTPCode() = %q, want 6 digits", code)
	}
}
