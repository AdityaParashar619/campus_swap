# Institutional validation report

This earlier report has been superseded by `INSTITUTIONAL_EMAIL_VALIDATION.md` and the release summary in `PHASE_0_1_FINAL_RELEASE_REPORT.md`.

The current student-registration policy accepts only the strict SATI address form with a two-digit year, a configured SATI branch, a three-digit roll, and `@satiengg.in`. The previous version of this report described an optional section-bearing regex; that description was stale and is no longer correct. The current enrollment format requires section `10` or `11` and a two-digit roll. Backend validation, normalization, branch matching, and tests are documented in the new report.

Do not use this legacy report as deployment configuration. Refer to root `.env.example`, `backend/.env.example`, and `EMAIL_OTP_CONFIGURATION.md` for the active settings. Real provider delivery remains **BLOCKED BY ENVIRONMENT** until an actual provider and mailbox acceptance test is completed.
