# Smart Notice Board — Phase 4.8C.3 Admin Management and Integration

## Admin workflow

Authorized `admin`, `college_admin`, and `super_admin` users can open `/admin/notices` from the existing Admin Panel. The page uses the shared authentication context, `AdminRoute`, layout, UI primitives, and API client.

The default workflow is deliberately explicit:

1. Complete the form and **Save Draft**.
2. Optionally **Edit** and **Save Changes**.
3. Review the managed-notice card and **Publish**.
4. **Archive** a published notice after confirmation.
5. **Republish** an archived notice after confirmation.

There is no client-only publication state. Every card refreshes from the server after a successful mutation. Pending controls prevent duplicate submission, and failed requests retain the current form.

## Supported fields

The form represents every editable backend field:

- title and plain-text content;
- category and priority;
- college, selected-program, or selected-program-plus-semester targeting;
- canonical programs supplied by the backend academic registry;
- optional attachment/source HTTPS URLs and labels;
- optional local expiration date/time.

The payload allowlist excludes status, creator/updater identities, publication/archive timestamps, and all other protected fields.

For expiration, an edited browser-local value is converted to ISO. When an administrator edits an unrelated field, the exact original ISO timestamp—including seconds and milliseconds—is preserved instead of being silently rounded to the minute.

## Targeting

- College-wide clears program and semester targeting.
- Selected programs requires at least one authoritative canonical program.
- Selected programs plus semester requires at least one program and semester 1–8.

The frontend validates these combinations for usability; backend validation and authorization remain authoritative. Student targeting behavior is unchanged.

## API integration

The existing admin API client now wraps:

- `GET /api/admin/notices` with server-supported page, status, category, and bounded search filters;
- `GET /api/admin/notices/:id`;
- `POST /api/admin/notices`;
- `PATCH /api/admin/notices/:id`;
- `POST /api/admin/notices/:id/publish`;
- `POST /api/admin/notices/:id/archive`.

The existing list endpoint was minimally extended with bounded escaped title/content search and authoritative `programs` metadata. No duplicate registry or new endpoint was introduced.

## Security

- Frontend routing hides the page from students, while existing backend role guards enforce every operation.
- Student Notice pages contain no admin actions.
- Unsafe URLs fail client validation and remain subject to backend HTTPS validation.
- Notice content remains plain text; no HTML execution API is used.
- API/session errors flow through existing interceptors.
- List requests are debounced, abortable, and stale-response safe.
- CampusSwap continues to use neutral **Published on CampusSwap** attribution.

## Manual demonstration

1. Sign in using an authorized administrator account.
2. Open **Admin → Notice management**.
3. Create a CSE Semester 7 draft and optionally add a legitimate HTTPS attachment.
4. Edit the draft and verify targeting and expiration remain intact.
5. Publish the draft.
6. Sign in as a matching CSE Semester 7 student and open **College Services → Notice Board**.
7. Confirm the notice appears and opens safely.
8. Confirm a non-matching program or semester cannot access it.
9. Archive it as admin and confirm it disappears.
10. Republish it and confirm it reappears with a new publication timestamp.

Use only legitimate demonstration content. Do not create notices in production without the appropriate authority.

## Testing and limitations

Focused tests cover payload protection, targeting, unsafe URLs, timestamp preservation, lifecycle controls, duplicate guards, failure preservation, role-protected routing, and student regressions. Isolated integration and Chromium cover the complete draft/edit/publish/student/archive/republish workflow.

Exact execution results are reported in the final task handoff.

Remaining limitations:

- no scheduled publication;
- no read receipts or acknowledgements;
- no push/email fan-out;
- no bulk mutation or analytics;
- archived notices remain editable by design, with server validation applied on republication.
