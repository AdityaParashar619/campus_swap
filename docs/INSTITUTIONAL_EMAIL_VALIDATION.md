# Institutional email validation

## Policy

Student registration accepts the SATI student format only:

```text
^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\.in$
```

The email is trimmed and lowercased before format validation, duplicate checks, persistence, OTP hashing, or login lookup. The backend also confirms the parsed branch is in `INSTITUTION_BRANCHES`. The configured regular expression is compiled at startup and must be non-stateful; backend structural parsing remains strict even if a custom regex is supplied.

Student enrollment numbers use the configured SATI format, defaulting to:

```text
^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$
```

The enrollment branch must match both the submitted branch and email branch. Invalid values return field-oriented validation messages. Unique indexes protect normalized email and enrollment number; temporary enrollment reservations prevent simultaneous pending registrations from claiming the same enrollment.

The two-digit year and three-digit email roll are retained as `institutionalYearCode` and `institutionalRollNumber`. The implementation does not infer a four-digit graduation year from the email. Student role/account creation remains behind successful OTP verification. Alumni review remains a separate flow and does not use student-format emails as an enrollment assertion.

**Identity limitation:** format validation establishes only that an address looks institutionally formatted. OTP confirmation establishes mailbox control. Neither proves current enrollment; no authoritative roster integration is configured.

## Configuration

Root and backend `.env.example` files provide the same safe defaults:

```env
ALLOWED_COLLEGE_DOMAINS=satiengg.in
INSTITUTION_EMAIL_PATTERN=^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\.in$
ENROLLMENT_PATTERN=^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$
INSTITUTION_BRANCHES=cs,bc,ai,ds,it,iot,ec,ce,me,ee
```

These are examples, not credentials. Missing email pattern falls back to the strict SATI default; malformed or stateful patterns fail startup. `satiengg.in` remains mandatory for student registration.

## Implementation and checks

Shared backend validation is in `backend/utils/institutionalIdentity.js`, invoked from `backend/controllers/authController.js`. Frontend feedback uses `frontend/src/utils/institutionalEmail.js` and is not trusted by the API. Automated checks cover each listed branch, normalization, personal and hostile domains, malformed lengths, unsupported branches, enrollment sections `10`/`11`, and invalid enrollment shapes.

See `backend/test/institutionalValidation.test.js`, `backend/test/auth.test.js`, and `frontend/test/registrationValidation.test.js`. Final observed test results are recorded in `PHASE_0_1_FINAL_RELEASE_REPORT.md`.
