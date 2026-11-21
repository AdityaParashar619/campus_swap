# Phase 4.8B.2 — My Department UI

## Page structure

`/my-department` is a lazy-loaded protected route under College Services. The page contains an authenticated academic identity summary, high-priority Syllabus and Timetable sections, Academic Schemes, Faculty Directory, Department Overview, Academic Calendar, and a secondary section for future resource types.

The existing responsive Navbar supplies active-route highlighting and closes the compact menu after selection. Notes remains retired. Notice Board, Campus Map, and Campus Issues remain disabled without routes.

## API integration and authority

The frontend calls only `GET /api/academic/my-resources` through the existing authenticated Axios client. It sends no branch, department, program, or semester parameters and implements no academic matching. Identity displayed by the page comes from the backend response. Session expiration continues through the existing refresh interceptor and `campusswap:session-expired` flow.

## Resource rendering

- `exact_verified_match`: exact verified label and backend-provided resource action.
- `program_resource`, `department_resource`, `college_resource`: visibly scoped applicable resources.
- `browsing_fallback`: official browsing page, never labeled as an exact document.
- `session_or_batch_unconfirmed`: warning shown; no exact-document link is constructed.
- `not_available`: honest unavailable message.

Multiple documents per category are supported. Malformed resource objects are discarded safely, and unknown match statuses become unconfirmed rather than exact.

## Loading, errors, and incomplete identity

The page has an accessible loading state, retryable API error, empty category states, and an incomplete/unsupported identity recovery message. It never exposes controls that mutate branch, semester, session, or admission batch.

## Supported branches and responsiveness

All backend-supported registration codes are handled without frontend remapping: `cs`, `bc`, `ai`, `ds`, `it`, `iot`, `ec`, `ce`, `me`, and `ee`. Layout uses mobile-first grids and `min-w-0`/word breaking for long titles. Cards stack at narrow widths and expand at `md`/`lg`; external actions retain 44px minimum height and visible keyboard focus. Existing light/dark tokens are preserved.

## Tests

Focused tests cover all ten branch codes, CE semester 5 empty state, ME semester 3 multiple resources, CSE semester 7 fallback, exact/fallback distinctions, unconfirmed session/batch behavior, malformed and empty responses, loading/retry source guarantees, safe external links, protected routing, navigation, and absence of academic selectors.

Final frontend/backend/build/audit/Compose results are included in the implementation handoff.

## Known limitations

- No exact documents are currently stored in the development database, so the live page correctly shows fallbacks or unavailable states.
- Admission batch and academic session remain unavailable in the user identity model.
- This phase adds no resource management or import workflow.

## Files modified

- `frontend/src/App.jsx`
- `frontend/src/services/api.js`
- `frontend/src/utils/navigation.js`
- `frontend/src/utils/academicResources.js`
- `frontend/src/pages/MyDepartment.jsx`
- `frontend/test/navigation.test.js`
- `frontend/test/academicResources.test.js`

## Safe rollback

Remove the `/my-department` route and page/API utility, restore My Department to a disabled navigation item, and remove its focused tests. No database rollback is necessary because this phase performs only authenticated reads and adds no data.
