# Password policy

New passwords for student registration, alumni registration, password changes, and password reset require:

- 8–128 characters
- At least one uppercase ASCII letter
- At least one lowercase ASCII letter
- At least one digit
- At least one non-alphanumeric character

The example `Campus@2027` meets this policy. The frontend shows live requirement status and confirmation mismatch feedback; backend handlers independently enforce the same rules. Shared policy implementations live in `backend/utils/passwordPolicy.js` and `frontend/src/utils/passwordPolicy.js`; API validation and controller validation both reject weak values. Passwords are not logged. Existing bcrypt hashing remains in place, and submitted clear-text values are hashed once before persistence.

Existing password hashes are not migrated or rewritten by this change. Login continues to compare against existing bcrypt hashes. An existing account may continue to authenticate with an older password; password policy applies when a password is newly set.

Automated tests cover each missing rule, minimum and maximum length, the passing example, and reset workflow use of the same backend validator. See `backend/test/institutionalValidation.test.js`, `backend/test/auth.test.js`, `backend/test/authWorkflows.test.js`, and `frontend/test/registrationValidation.test.js`.
