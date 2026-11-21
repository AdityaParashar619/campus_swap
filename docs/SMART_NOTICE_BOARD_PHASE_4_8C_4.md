# Phase 4.8C.4 — Notice Poster and Document Uploads

## Scope

Notice Management extends the existing Notice model and admin routes. It does not replace the legacy `attachmentUrl`, introduce client-side Cloudinary credentials, or alter Marketplace and Notes storage.

## Supported files and limits

- JPEG, PNG, and WebP images
- PDF documents
- DOCX documents
- Up to five uploaded attachments per notice
- Up to 10 MB per file

Multer enforces count and byte limits in memory. The backend then inspects decoded image metadata with Sharp, requires `%PDF-` for PDFs, and requires ZIP/Office document markers for DOCX. SVG, HTML, scripts, executables, malformed files, MIME mismatches, and unsafe protocols are rejected.

## Upload workflow

An administrator selects files in the existing create/edit form. Selection does not upload. Saving first creates or updates the notice, then `POST /api/admin/notices/:id/attachments` uploads the selected files. Progress, filenames, and sizes are displayed. A failed upload leaves form content intact and the saved notice remains editable.

Existing attachments are preserved by ordinary edits. Removal is an explicit confirmed `DELETE /api/admin/notices/:id/attachments/:attachmentId` action. Archiving does not delete attachments.

## Cloudinary and metadata

The existing server-side Cloudinary configuration is reused. Assets use the `campusswap/notices` folder. Images use Cloudinary's image resource type; PDF and DOCX use raw delivery because Office documents are not safe inline previews.

Each Notice embeds server-generated metadata: original/safe display name, MIME type, size, public ID, resource type, secure URL, kind, and upload time. Clients cannot add attachment metadata through ordinary notice create/update payloads.

## Student display

Only attachments serialized from a currently published, unexpired notice matching the authenticated student's database-backed targeting identity are returned. Draft, archived, expired, wrong-program, and wrong-semester notices remain inaccessible through student APIs.

Images receive a lazy poster preview and full-image link. PDFs receive Open PDF and Download actions. DOCX receives Download only. Notice text remains plain React text; document content is never executed or embedded.

## Lifecycle and cleanup

MongoDB is updated before provider deletion. Removal verifies the dedicated folder and checks for another Notice referencing the same public ID. Provider failures are reported as `cleanup_required`; the database operation is not rolled back and no unrelated asset is deleted. This deliberately favors data safety over aggressive cleanup.

Uploads are persisted attachment-by-attachment, so partial multi-file success remains visible. A provider success followed by an unexpected MongoDB failure can still leave an orphaned Cloudinary asset. Production operations should reconcile assets under `campusswap/notices` against stored `attachments.publicId` values using a reviewed, dry-run cleanup job. No automatic destructive cleanup was added in this phase.

## Security

- Existing admin role middleware protects upload and removal.
- Existing creation rate limiting protects uploads.
- Public IDs and URLs come only from Cloudinary responses.
- Public-ID deletion requires the dedicated folder prefix and a shared-reference check.
- Cloudinary credentials remain backend-only.
- The legacy safe HTTPS attachment remains supported.

## Testing and limitations

Focused tests cover signatures, MIME mismatch, oversized data, the five-file schema limit, server-owned metadata, safe normalization, rendering actions, and unauthorized routes. Cloudinary calls use mocks; no test uploads target a real account.

DOCX inspection validates its ZIP signature and required Office entries without fully parsing document XML. Antivirus/malware scanning and a durable cleanup queue are not included; both are recommended before institutional-scale production use.
