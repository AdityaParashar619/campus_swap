# CampusSwap faculty demonstration

This procedure uses the existing demo host, HTTPS, and campusswap_demo database. It preserves the reviewer and adds no seeded records. Enable both demo switches. The faculty switch restores eligible SATI student registration with real inbox OTP, with a named administrator and a strict database identity check. Alumni signup, dev mail preview, automatic administrator bootstrap, seeding and private evidence are disabled. Existing verified registration, rate limits, session and authorization checks remain in effect.

## Runtime settings

Retain the existing MongoDB URI, JWT secret, OTP pepper, HTTPS origin and proxy count. Set the following using the root-owned runtime file on the demo host in an authorized Session Manager session. Values enclosed in angle brackets are placeholders. Keep provider secrets out of Git, logs and command arguments.

~~~text
CAMPUSSWAP_DEMO_MODE=true
CAMPUSSWAP_FACULTY_DEMO_MODE=true
PILOT_MODE_ENABLED=false
PILOT_ALLOWED_EMAILS=
ADMIN_EMAIL=<approved SATI administrator email>
ADMIN_BOOTSTRAP_ENABLED=false
SEED_ON_STARTUP=false
OTP_MOCK_ENABLED=false
RESEND_TEST_MODE=false
CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED=false
EMAIL_PROVIDER=gmail
GMAIL_USER=<dedicated Gmail sender>
GMAIL_APP_PASSWORD=<Google App Password>
EMAIL_FROM=<same Gmail sender address>
CLOUDINARY_CLOUD_NAME=<approved Cloudinary cloud name>
CLOUDINARY_ASSET_NAMESPACE=campusswap-faculty
CLOUDINARY_API_KEY=<backend API key>
CLOUDINARY_API_SECRET=<backend API secret>
~~~

- Approve at least two real SATI student mailboxes if demonstrating peer chat. The administrator email is separate from the student allowlist.
- Use a dedicated Gmail sender with 2-Step Verification and an App Password. The existing Nodemailer Gmail transport uses TLS on TCP 465. The demo security group currently permits outbound TCP 80, 443 and 27017. The credential-free probes confirmed TCP 465 and 587 were blocked. Add only outbound TCP 465 to this instance's existing security group under separate approval. In the state-owning Terraform stack, add 465 to the existing egress port map and review a plan with one security-group update and no other changes. Verify TLS and SMTP authentication before cutover. The HTTPS alternative is the existing Resend Free integration with a verified sending domain the operator already controls. The host reached its API and received the expected unauthenticated 401. Resend onboarding or test sending cannot deliver real OTPs to arbitrary student inboxes.
- Faculty deployments require the campusswap-faculty public-ID namespace. Uploads create unique non-overwriting IDs and the server checks the stored namespace and owner before deletion. This is application-level isolation within a shared Cloudinary environment. The credential retains its provider-side permissions. Keep it backend-only. Use non-sensitive media and leave private evidence disabled.

## After exact scope approval

1. Publish the reviewed source through ordinary main CI and the existing gated public GHCR workflow. Verify the new digest and test it against the reviewed faculty settings. Keep the prior image available and verify the existing host and index inventory. Apply only the approved mail egress change if using Gmail.
2. Validate and install the faculty Nginx template with the existing IPv4, certificate paths and ACME webroot. Its admin paths use the existing application authorization. Only the upload routes get larger body limits. Port 80 remains ACME-only. Keep the original config available, validate with nginx -t, and reload.
3. Generate a fresh strong password and save it as a Windows user-bound DPAPI handoff. Transfer it privately to the host and pass it through stdin to the one-shot command below. Keep bootstrap credentials out of the runtime environment. The script checks the target, existing administrator, and required indexes, then uses the existing account creation logic and unique indexes. It leaves the reviewer intact.

~~~sh
docker run --rm -i --env-file /opt/campusswap/runtime.env "$APPROVED_IMAGE" \
  node scripts/provisionFacultyDemoAdmin.js campusswap_demo
~~~

4. Verify the administrator through /login then /admin. Use a real allowlisted inbox to verify student registration, six-digit OTP, dashboard, logout and reset. Verify a student is denied admin APIs, the reviewer still signs in, uploads are bounded, and both HTTPS health endpoints and WebSockets pass. Faculty can enter application records manually. Campus Map uses archive to remove a published location, and academic resources use HTTPS links managed in the existing admin workflow.

The present synthetic-only image rejects real identities in the database. Once a faculty account exists, use a faculty-capable release for recovery. The synthetic-only digest cannot safely serve this populated database. Once domain-wide registration is open, recover with a faculty release that accepts existing SATI students at startup. Older releases that only accept allowlisted accounts are incompatible. The optional pilot flag limits new registrations only.
