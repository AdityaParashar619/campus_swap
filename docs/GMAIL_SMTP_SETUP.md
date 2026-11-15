# Gmail SMTP for CampusSwap

Gmail is supported for local development and college demonstrations through Nodemailer. Resend remains available as an independent provider. CampusSwap never sends test emails from automated tests.

## Gmail App Password setup

1. Sign in to the Google account that will send demonstration mail and enable 2-Step Verification.
2. Create an App Password for CampusSwap in Google Account security settings. Google may not offer App Passwords for accounts enrolled in Advanced Protection or organization-managed accounts; ask the Google Workspace administrator about an approved SMTP option in that case.
3. Copy the 16-character App Password. Do not use the account's normal password.
4. Put the values in the backend `.env` (or the root `.env` used by Docker Compose):

   ```dotenv
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your-account@gmail.com
   GMAIL_APP_PASSWORD=your-16-character-app-password
   EMAIL_FROM=CampusSwap <your-account@gmail.com>
   OTP_MOCK_ENABLED=false
   ```

5. Restart the backend. On startup it verifies the Gmail SMTP connection. If verification fails, the service logs only a generic status and email requests return a service-unavailable error; credentials and provider response details are not logged.
6. Register with the exact SATI student email address. The message is sent to that registered address. Password recovery uses a different six-digit OTP and requires OTP verification before the short-lived, one-use password-reset authorization is issued.

Gmail may require `EMAIL_FROM` to match `GMAIL_USER` or a sender alias configured in Gmail. Keep the sender aligned with the account while testing.

## Provider selection

`EMAIL_PROVIDER` is backend-only. It defaults to `resend` for compatibility with existing deployments.

- `EMAIL_PROVIDER=gmail` selects only Nodemailer/Gmail. `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM` are required. Resend variables may be absent and are ignored. No fallback to Resend or mock capture occurs if SMTP fails.
- `EMAIL_PROVIDER=resend` selects only the existing Resend adapter. In real-email development mode, configure `RESEND_API_KEY` and `EMAIL_FROM`. Resend onboarding test mode retains its configured permitted sender and recipient. Production Resend sends remain unavailable until `RESEND_DOMAIN_VERIFIED=true` and the verified sender configuration is valid. There is no fallback to Gmail.
- To return to development OTP capture, select `resend` and set `OTP_MOCK_ENABLED=true`. Gmail mode always attempts Gmail delivery and does not use mock capture.

For Docker Compose, configure these values in the root `.env`; Compose passes them only to the backend container. Do not add them to any `VITE_*` variable or frontend environment.

## Troubleshooting

- **Invalid login / authentication failed:** regenerate the App Password, check that 2-Step Verification remains active, remove accidental spaces, and verify `GMAIL_USER` is the account that created the App Password.
- **Connection verify or timeout fails:** check network access to Gmail SMTP and restart the backend after correcting credentials. Provider details are intentionally sanitized from application errors.
- **From address rejected:** set `EMAIL_FROM` to the authenticated account or a Gmail-configured send-as alias.
- **No message appears:** inspect spam and Gmail's sent folder, confirm the student address is correct, and ensure `EMAIL_PROVIDER=gmail` and `OTP_MOCK_ENABLED=false` in the backend's actual environment.
- **Workspace-managed account:** the organization may disable App Passwords or SMTP. Use an administrator-approved sender or select Resend after its sender domain is verified.

Gmail SMTP is intended here for local development and a limited project demonstration. Consumer Gmail sending limits and account policies apply; use an approved transactional email service for a production deployment. No SATI inbox delivery is asserted until a real message is received there.
