# Campus Map — Phase 4.8D.2

## Student workflow

Open **College Services → Campus Map** while signed in. Search for a location name, building code, or alias, and optionally choose a category. Select a map marker or a result to open location details. On wide screens the details sit beside the map. On smaller screens they appear directly below it.

If the catalogue is empty, the map remains pannable and zoomable and explains that verified locations appear after publication. Its initial center (23.5°, 78°, zoom 8) is a regional viewport for central Madhya Pradesh. It does not identify a SATI building or campus center. Results fit into view when they arrive. The map limits automatic zoom to 17 and groups locations with exactly matching coordinates in one marker popup. Every location also has a keyboard-accessible list entry.

## Architecture and API

The protected `/campus-map` route loads the map page and its stylesheet on demand. It uses Leaflet 1.9.4 and React Leaflet 4.2.1 with the existing React 18 application.

The authenticated Axios client requests `GET /api/campus-locations` in sequential pages of 50. The screen publishes a result set after all pages finish. If page totals change or duplicate IDs occur while paging, it offers a retry. Search is debounced by 300 ms and uses the backend's search, with its ten category values. Changing a query or selection cancels stale requests. The detail panel fetches `GET /api/campus-locations/:id` and renders only available public fields. Invalid coordinates are discarded before rendering. Loading, errors, retries and empty results have readable text and accessible status announcements.

The map requests standard [OpenStreetMap tiles](https://operations.osmfoundation.org/policies/tiles/) only for the viewport and shows attribution on the map. Tile images send an origin referrer on HTTPS deployments and use normal browser caching. Tile delivery can fail independently of the location API. The location list and directions links remain available in that case.

Get Directions produces `https://www.google.com/maps/dir/?api=1&destination=latitude%2Clongitude` for the selected location. The [Maps URL](https://developers.google.com/maps/documentation/urls/get-started) opens in a new tab with opener and referrer protection. Google Maps can determine the origin after the link opens. CampusSwap supplies the destination only and does not request GPS access.

The backend owns publication and verification checks. The UI accepts only public fields, uses credential-free HTTPS image URLs, renders descriptions as text, and lazy-loads images only for a selected location. The map controls, search and category fields are available at narrow widths. Marker navigation is supplemented by the labelled results list.

## Verification and scope

Frontend tests cover protection, navigation, data validation, cancellation, search/filter query forwarding, completeness across pages, optional metadata and directions URLs. Chromium exercises the live authenticated API and UI using fictional locations created through the admin API in disposable MongoDB. Map tiles are intercepted in Chromium to avoid dependency on the public service. The responsive checks cover 320, 390, 768, 1280 and 1920 pixels.

The focused frontend run passed 14 tests. The full frontend run passed 99 tests. The backend run passed 194 tests and skipped five environment-gated tests. The final Chromium run passed all seven tests. These final runs had zero failures. The production frontend built successfully, both production dependency audits reported zero vulnerabilities, both Compose configurations validated, and `git diff --check` passed.

Offset paging detects changed totals and duplicate IDs, but it does not provide a database snapshot during concurrent edits. Exact-coordinate grouping keeps coincident markers selectable. Nearby markers may still overlap at lower zooms, and the list provides a reliable way to select them individually.

Phase 4.8D.3 can add the administrator workflow for entering, reviewing and publishing real coordinates through the existing admin API.
