// Package docvalidate validates identity document numbers per country and
// document type. Rules are kept in a registry keyed by (country_code,
// doc_type), so adding support for a new country is adding one entry plus a
// validator function; countries/types without a registered rule keep the
// previous permissive behavior (only a generic max-length sanity check).
package docvalidate

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
)

// MaxCardNumberLength is the generic sane upper bound applied to any document
// number that has no country/doc-type-specific rule.
const MaxCardNumberLength = 30

// ErrCardNumberTooLong is returned when a document number with no specific
// rule exceeds MaxCardNumberLength.
var ErrCardNumberTooLong = errors.New("document number is too long")

type ruleKey struct {
	Country string
	DocType string
}

// Validator normalizes and validates a raw document number, returning the
// normalized value on success.
type Validator func(raw string) (string, error)

var registry = map[ruleKey]Validator{
	{Country: "EC", DocType: "national_id"}: validateECNationalID,
}

// Validate normalizes and validates cardNumber for the given country code and
// document type. Documents with an empty country or with no matching rule in
// the registry keep the current (permissive) behavior: only a generic
// max-length check is applied. countryCode and docType are matched
// case-sensitively on docType and case-insensitively on countryCode.
func Validate(countryCode, docType, cardNumber string) (string, error) {
	countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
	docType = strings.TrimSpace(docType)

	if countryCode == "" {
		return genericValidate(cardNumber)
	}

	if fn, ok := registry[ruleKey{Country: countryCode, DocType: docType}]; ok {
		return fn(cardNumber)
	}

	return genericValidate(cardNumber)
}

func genericValidate(cardNumber string) (string, error) {
	normalized := strings.TrimSpace(cardNumber)
	if len([]rune(normalized)) > MaxCardNumberLength {
		return "", ErrCardNumberTooLong
	}
	return normalized, nil
}

var digitsOnly = regexp.MustCompile(`^[0-9]+$`)

// validateECNationalID validates an Ecuadorian cédula: exactly 10 digits,
// province code 01-24 or 30, third digit < 6, and a modulo-10 check digit
// (coefficients 2,1,2,1,2,1,2,1,2; products over 9 subtract 9).
func validateECNationalID(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "-", "")

	if len(s) != 10 || !digitsOnly.MatchString(s) {
		return "", errors.New("invalid Ecuadorian national ID: must be exactly 10 digits")
	}

	province, err := strconv.Atoi(s[0:2])
	if err != nil {
		return "", errors.New("invalid Ecuadorian national ID: must be exactly 10 digits")
	}
	if !((province >= 1 && province <= 24) || province == 30) {
		return "", errors.New("invalid Ecuadorian national ID: invalid province code")
	}

	thirdDigit := int(s[2] - '0')
	if thirdDigit >= 6 {
		return "", errors.New("invalid Ecuadorian national ID: invalid third digit")
	}

	coeffs := [9]int{2, 1, 2, 1, 2, 1, 2, 1, 2}
	sum := 0
	for i := 0; i < 9; i++ {
		d := int(s[i] - '0')
		p := d * coeffs[i]
		if p > 9 {
			p -= 9
		}
		sum += p
	}
	check := (10 - sum%10) % 10
	lastDigit := int(s[9] - '0')
	if check != lastDigit {
		return "", errors.New("invalid Ecuadorian national ID: check digit mismatch")
	}

	return s, nil
}
