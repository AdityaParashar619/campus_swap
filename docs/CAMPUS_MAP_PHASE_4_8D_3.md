# Campus Map Phase 4.8D.3

The Admin Panel links to the protected `/admin/campus-locations` page. The page lists locations by name, code or alias, category, and publication status. Filters query the server and the list requests 12 rows per page. Use **Add Location** for a new draft or **Edit Location** to load a saved record. Optional address, accessibility, hours, contacts and HTTPS links are under **Advanced Details**.

## Coordinates and publication

**Select on Map** opens the Leaflet picker with OpenStreetMap attribution. Click a point, drag the pin, or enter latitude and longitude manually. The picker starts at the saved position when available or uses the regional viewport at 23.5° N, 78° E. The regional viewport does not identify a SATI building. Coordinate values use the backend's numeric precision and latitude-first ordering.

1. Save the location and its coordinates.
2. Choose **Verify Coordinates**, review the saved pair, enter the provenance, and choose **Confirm Verification**.
3. Choose **Publish**. The student map reads the same published and verified record through the existing student API.
4. **Archive** asks for confirmation. **Republish** restores visibility if the coordinates are still verified.

Changing coordinates clears verification and atomically returns a published location to draft. Reverify the saved point and then publish again. Verification documents the administrator's judgment about the location and its source. It does not establish survey-grade accuracy.

## API and conflict handling

The admin UI reuses the existing `/api/admin/campus-locations` list, detail, create, edit, and lifecycle endpoints. Verification submits the saved pair and provenance. The server supplies actor IDs and timestamps. The UI sends only changed editable fields on PATCH and sends the loaded version in a quoted `If-Match` header on every existing-record write. If the version is stale, the server returns HTTP 409, and the UI locks further writes while keeping local input visible. **Reload saved location** requests confirmation before discarding unsaved edits. Older clients may omit the header for compatibility. MongoDB optimistic concurrency still protects overlapping writes.

A synchronous submission guard prevents duplicate requests from the editor. Existing administrator roles, HTTPS validation, rate limiting and student visibility checks apply. The picker uses standard OSM viewport tiles and manual entry remains available when tile delivery fails. The page has no delete endpoint, geocoding or GPS access.

## Testing

Unit coverage checks the existing route guard, editable-field allowlist, coordinate precision, validation, preservation of advanced values, and publication gates. Isolated MongoDB exercises lifecycle, roles and stale update/archive versions. Browser tests use fictional locations and mocked tiles, including the student visibility lifecycle, coordinate selection and drag, list filtering and responsive layouts at 320, 390, 768, 1280 and 1920 px.

Final verification passed four focused frontend tests, all 103 frontend tests, the isolated MongoDB integration test, and all nine Chromium tests. The full backend suite passed 194 tests with five environment-gated skips. There were zero failures in the final runs. The production build, Compose validation, and `git diff --check` passed. Both production dependency audits reported zero vulnerabilities.

Run the browser suite with a fresh disposable Compose project. To run alongside the default E2E stack, set `E2E_FRONTEND_PORT=8082`, `E2E_BACKEND_PORT=5101` and `E2E_MONGO_PORT=27019` for Compose. Set `E2E_BASE_URL=http://127.0.0.1:8082` and `E2E_BACKEND_URL=http://127.0.0.1:5101` for Playwright, and use the synthetic administrator fixture expected by the pilot suite. The separate HTTP integration test targets `campusswap_locations_test` on the loopback E2E MongoDB port.
