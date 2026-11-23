# Campus Issues Phase 4.8E.4A live Cloudinary verification

## Scope and method

One explicitly authorized 48 × 32 synthetic image was submitted through the existing `POST /api/campus-issues` multipart route. The API used synthetic student and administrator accounts in a disposable loopback MongoDB database. It used the existing Compose Cloudinary credentials, which were confirmed to match the running development backend's configuration. The feature flag was enabled only in the isolated verification process.

The upload used the production code path with Cloudinary resource type `image`, delivery type `authenticated`, the issue evidence namespace, and overwrite disabled. Cloudinary returned an upload acknowledgement, CampusSwap returned HTTP 201, and a Cloudinary Admin API lookup confirmed the exact public ID, immutable asset ID, version, delivery type, and WebP format. Both identifiers and the cleanup outcome were recorded in a local audit file outside the repository. The record contains no credentials, bearer tokens, or signed URLs.

## Unsigned Cloudinary delivery

The requests used the recorded asset version and public ID with no Cloudinary signature, cookie, or authorization header. Redirects were inspected without following them. Response bodies were checked for decodable image bytes.

| Request | HTTP | Image bytes | Content-Type |
| --- | ---: | --- | --- |
| Original, authenticated delivery path | 401 | None | `text/plain;charset=UTF-8` |
| Resize | 401 | None | `text/plain;charset=UTF-8` |
| Crop | 401 | None | `text/plain;charset=UTF-8` |
| PNG conversion | 401 | None | `text/plain;charset=UTF-8` |
| Thumbnail | 401 | None | `text/plain;charset=UTF-8` |
| Same identifier under public delivery mode | 404 | None | `application/octet-stream` |

All six responses had empty bodies, `Cache-Control: private, no-transform, max-age=0, no-cache`, `Content-Disposition: inline`, and no redirect. A read-only follow-up on the deleted fixture confirmed that Cloudinary's public-mode 404 repeats the identifier already present in the request in `x-cld-error`. The header contained no credentials or signing token. CampusSwap does not forward that header.

## CampusSwap authorization and response headers

| Request | HTTP | Result |
| --- | ---: | --- |
| Report owner | 200 | Decodable WebP, byte-for-byte equal to the sanitized fixture |
| Authorized admin | 200 | Decodable WebP, byte-for-byte equal to the sanitized fixture |
| Different student on the owner route | 404 | JSON error |
| Student on the admin route | 403 | JSON error |
| Unauthenticated client | 401 | JSON error |
| Expired application token | 401 | JSON error |
| Invalid application token signature | 401 | JSON error |
| Unrelated well-formed evidence identifier | 404 | JSON error |
| Malformed evidence identifier | 400 | JSON error |

Both image responses carried `Cache-Control: no-store`, `Content-Type: image/webp`, `Content-Disposition: inline`, and `X-Content-Type-Options: nosniff`. None of the nine responses redirected or exposed a signed URL, provider identifier, or API credential. Authorization failures that occurred before the evidence handler returned generic JSON. The report and identifier errors returned `no-store`.

Cloudinary's signed, server-to-server download returned the image directly with HTTP 200 and `Cache-Control: public, max-age=2592000`. It also included a provider-generated filename. Those upstream headers and the signed download URL stayed on the server. CampusSwap sent its own browser-facing headers listed above. This verified the application boundary. Provider caching behavior for a separately disclosed signed URL and signed-URL replay after expiry remain unverified.

## Cleanup and configuration

Cloudinary returned `ok` for deletion of the single recorded authenticated image, with invalidation requested. Subsequent Admin API lookups by both its exact public ID and immutable asset ID returned 404. No orphaned fixture was observed. Existing Cloudinary assets, account settings, environment secrets, persistent MongoDB data, and the running configuration were preserved. No application code, deployment, or Git index changes were made. No account-wide configuration change was needed for the tested delivery path.

## Regression verification

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Focused backend Campus Issues | 11 | 0 | 0 |
| Backend Marketplace image regressions | 10 | 0 | 0 |
| Focused frontend Campus Issues | 15 | 0 | 0 |
| Isolated Campus Issues MongoDB integration | 6 | 0 | 0 |
| Chromium E2E | 12 | 0 | 0 |
| Production frontend build | 1 | 0 | 0 |
| Git diff check | 1 | 0 | 0 |

Chromium, Marketplace upload, and cleanup regressions used mocked provider operations. The live verification created no Marketplace asset.

**Decision: GO for Phase 4.8E.4A.** The verified Cloudinary configuration passed the live checks. Uploads remain disabled in the running application.
