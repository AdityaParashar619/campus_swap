# Campus Map — Phase 4.8D.1

Campus locations use a single MongoDB collection. No records are seeded.

## Data model

- Required name (120 characters) and category. Categories are academic, administration, library, hostel, sports, food, medical, parking, facility, and other.
- Optional description (2,000 characters), unique building code (up to 24 characters, normalized to uppercase), and up to 10 aliases.
- Separate numeric WGS84 `latitude` and `longitude` fields, in degrees. Latitude accepts −90 through 90 and longitude accepts −180 through 180. Draft edits may omit either field or clear it with JSON null. Strings, booleans and non-finite values are invalid.
- Optional address, floor, accessibility, opening-hours and contact text, plus credential-free HTTPS image and external map URLs.
- Draft, published, and archived states. Audit fields track creation, update, publication, archival, and the administrator, source and timestamp of coordinate verification.

A partial unique index enforces building-code uniqueness while allowing omitted codes. The status/name/ID index supports ordered publication queries. No geospatial index is required for returning markers.

## Administrator API

All routes use the existing authentication and the `admin`, `college_admin` or `super_admin` role check.

| Method | Path under `/api/admin/campus-locations` | Action |
| --- | --- | --- |
| POST | / | Create draft |
| GET | / | List, including optional status filter |
| GET | /:id | Retrieve location with audit metadata |
| PATCH | /:id | Edit allowed fields |
| POST | /:id/verify-coordinates | Confirm the exact stored coordinate pair and record its source |
| POST | /:id/publish | Publish or republish a verified location |
| POST | /:id/archive | Archive a published location |

Example draft JSON using a synthetic label:

```json
{"name":"Synthetic library","category":"library","buildingCode":"LIB-TEST","aliases":["Study Hall"]}
```

After adding coordinates with PATCH, submit the reviewed numeric pair and source to the verification endpoint. The following coordinates are synthetic test values:

```json
{"latitude":12.5,"longitude":-45.75,"coordinateSource":"Synthetic integration fixture"}
```

Coordinates alone do not establish verification. Verification records the authenticated administrator and server time, and rejects a pair that differs from the stored coordinates. Publication and archival accept no fields. Ordinary edits preserve the coordinate audit. A coordinate change clears the audit and atomically returns a published record to draft. An archived record remains archived when edited. An administrator must verify the new pair and publish again. Concurrent changes to the same record fail with HTTP 409 if another write won first.

## Student API

Authenticated clients can GET `/api/campus-locations` and `/api/campus-locations/:id`. Only published records with valid, verified coordinates and verification metadata qualify. Hidden and missing locations return HTTP 404 on detail lookup. The response includes the public location fields and excludes all administrator IDs and verification provenance. Example detail response:

```json
{"success":true,"data":{"id":"507f1f77bcf86cd799439011","name":"Synthetic library","category":"library","latitude":12.5,"longitude":-45.75}}
```

Both lists accept `category`, `search`, `page`, and `limit`. Search matches a literal, case-insensitive substring in name, building code or aliases, with a 100-character limit. Pages start at 1 and are capped at 10,000. Limit defaults to 20 and is capped at 50. Results sort by name and ID and include `pagination: { page, limit, total, totalPages }`. Admin lists also accept `status`. The API rejects unknown fields, uses the existing creation limiter, and returns standard error envelopes.

## Verification and limitations

Run the model/input checks with `node --test test/campusLocation.test.js`. Run the HTTP lifecycle suite with `CAMPUS_LOCATION_TEST_MONGO_URI` pointing to the disposable loopback MongoDB instance on port 27018 and database `campusswap_locations_test`. The test covers access control, visibility, audit fields, concurrent edits and the verify/publish/archive lifecycle. Existing backend tests cover startup and cross-module regressions.

Verification results: four campus location unit tests passed. The full backend run passed 194 tests, skipped five environment-gated tests, and had zero failures. Three isolated MongoDB integration tests passed (Campus Locations, Smart Notice Board, and Academic Resources). The focused regression and startup run passed 43 tests. The live and health endpoints returned HTTP 200 with isolated MongoDB connected. Both Compose configurations validated and the backend production dependency audit reported zero vulnerabilities. Docker Desktop was unavailable, so the runtime checks used local temporary MongoDB storage.

Coordinate verification records administrator-confirmed provenance. It is not proof of survey-grade accuracy. The API does not verify the physical campus footprint or automatically geocode a building. Literal substring search is intended for a small campus catalogue.

Phase 4.8D.2 can consume the authenticated list for Leaflet markers, use `[latitude, longitude]` in that order, and generate directions links from each verified coordinate pair.
