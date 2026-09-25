package docvalidate

import "testing"

func TestValidate_EC_NationalID_Valid(t *testing.T) {
	got, err := Validate("EC", "national_id", "1710034065")
	if err != nil {
		t.Fatalf("expected valid cédula, got error: %v", err)
	}
	if got != "1710034065" {
		t.Fatalf("expected normalized %q, got %q", "1710034065", got)
	}
}

func TestValidate_EC_NationalID_ValidWithFormatting(t *testing.T) {
	got, err := Validate("EC", "national_id", " 171-003 4065 ")
	if err != nil {
		t.Fatalf("expected valid cédula with formatting stripped, got error: %v", err)
	}
	if got != "1710034065" {
		t.Fatalf("expected normalized %q, got %q", "1710034065", got)
	}
}

func TestValidate_EC_NationalID_WrongLength(t *testing.T) {
	if _, err := Validate("EC", "national_id", "171003406"); err == nil {
		t.Fatal("expected 9-digit id to be rejected")
	}
}

func TestValidate_EC_NationalID_NonDigits(t *testing.T) {
	if _, err := Validate("EC", "national_id", "171003406A"); err == nil {
		t.Fatal("expected id with a letter to be rejected")
	}
}

func TestValidate_EC_NationalID_BadProvince(t *testing.T) {
	if _, err := Validate("EC", "national_id", "9900034065"); err == nil {
		t.Fatal("expected id with invalid province code 99 to be rejected")
	}
}

func TestValidate_EC_NationalID_ThirdDigitTooHigh(t *testing.T) {
	if _, err := Validate("EC", "national_id", "1760034065"); err == nil {
		t.Fatal("expected id with third digit >= 6 to be rejected")
	}
}

func TestValidate_EC_NationalID_BadCheckDigit(t *testing.T) {
	if _, err := Validate("EC", "national_id", "1710034066"); err == nil {
		t.Fatal("expected id with wrong check digit to be rejected")
	}
}

func TestValidate_UnknownCountryOrType_Passes(t *testing.T) {
	if _, err := Validate("US", "passport", "AB1234567"); err != nil {
		t.Fatalf("expected unknown country/doc-type combination to pass, got error: %v", err)
	}
}

func TestValidate_EmptyCountry_Passes(t *testing.T) {
	if _, err := Validate("", "national_id", "anything-goes-here"); err != nil {
		t.Fatalf("expected empty country to skip strict validation, got error: %v", err)
	}
}

func TestValidate_GenericMaxLength_Enforced(t *testing.T) {
	tooLong := "123456789012345678901234567890X" // 32 chars
	if _, err := Validate("", "other", tooLong); err == nil {
		t.Fatal("expected overly long card number with no matching rule to be rejected")
	}
}
