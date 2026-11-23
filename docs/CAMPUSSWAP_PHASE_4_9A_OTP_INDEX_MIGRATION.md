# CampusSwap Phase 4.9A OTP index migration preparation

**GO to request approval for the migration. Phase 4.9 remains NO-GO.** The persistent database was inspected read-only. All index creation and restore testing took place in disposable MongoDB containers. This procedure still requires explicit authorization before the persistent backup and maintenance window.

## Target and root cause

The running target is development Compose project `campus_swap`, MongoDB container `campus_swap-mongodb-1`, named volume `campus_swap_mongodb_data` mounted at `/data/db`, database `campusswap`, collection `emailverifications`. MongoDB runs as a standalone service with an internal port. The database tools inside the MongoDB image report version 100.20.0.

`backend/models/EmailVerification.js` declares `{ email: 1, kind: 1 }` with `unique: true`. Registration and password reset both upsert using normalized email and an explicit purpose. The schema lowercases and trims email, and defines `student` and `password_reset` as the allowed kinds. Its default for new records is `student`. MongoDB weighs stored values when enforcing uniqueness. A noncanonical stored value can evade the logical key check performed by the application, so the preflight detects it and stops. The email format check is a structural sanity check. It does not enforce current enrollment patterns on historic data.

Cold start was reproduced on a separate disposable database with the existing application entry point. Mongoose attempted model initialization before its database handle existed with buffering disabled. The initialization failed, and the OTP collection remained without the compound index after a document was written on the connected server. The current startup code explicitly creates indexes for Listing and Campus Issues. The registration integration test explicitly initializes its auth fixture indexes, which explains why it passed without detecting the running catalog drift.

## Persistent read-only preflight

| Check | Result |
| --- | --- |
| OTP documents | 0 |
| Duplicate exact key groups | 0 |
| Duplicate groups after trimming and lowercasing | 0 |
| Email missing / null / wrong BSON type / malformed / noncanonical | 0 / 0 / 0 / 0 / 0 |
| Kind missing / null / wrong BSON type / invalid enum | 0 / 0 / 0 / 0 |
| Equivalent or conflicting compound indexes | None |

| Existing index | Exact key | Relevant options |
| --- | --- | --- |
| `_id_` | `{ _id: 1 }` | Default identifier index, version 2 |
| `email_1` | `{ email: 1 }` | Nonunique, version 2, stored legacy `background: true` |
| `expiresAt_1` | `{ expiresAt: 1 }` | TTL `expireAfterSeconds: 0`, version 2, stored legacy `background: true` |

The required new index is **`email_1_kind_1`**, ascending email then kind, `unique: true`, with simple collation inherited from the collection. The schema calls for a full index. A partial or sparse definition would change which records are constrained. The two OTP kinds may coexist for the same email. [MongoDB unique index documentation](https://www.mongodb.com/docs/manual/core/index-unique/).

## Approved maintenance procedure

The commands in this section are proposed for a later, explicitly authorized window. Run PowerShell from the repository root. A short backend outage gives registration, resend, verification, and reset requests a clean write boundary. It also quiesces application writers for the whole-database backup. Before starting, confirm no other writer has access to the internal MongoDB network and confirm that backend seeding, administrator bootstrap, and startup Marketplace cleanup have no pending changes. If another writer or startup side effect is present, pause for a separate coordination decision.

### Verify target and pause writes

```powershell
$source = 'campus_swap-mongodb-1'
$compose = @('-p', 'campus_swap', '--env-file', '.env', '-f', 'docker-compose.yml')
$uri = 'mongodb://127.0.0.1:27017/campusswap?directConnection=true'
$migration = 'backend/scripts/otpIndexMigration.mongosh.js'

docker compose @compose ps
docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}} {{range .Mounts}}{{.Name}} {{.Destination}}; {{end}}' $source
if ($LASTEXITCODE -ne 0) { throw 'Target inspection failed' }
# Confirm project campus_swap and campus_swap_mongodb_data mounted at /data/db.
docker compose @compose stop backend
if ($LASTEXITCODE -ne 0) { throw 'Backend did not stop' }
docker compose @compose ps --status running backend
# Confirm no running backend and no other OTP writers.
Get-Content -Raw -LiteralPath $migration | docker exec -i -e OTP_INDEX_MODE=preflight $source mongosh --norc --quiet $uri --file /dev/stdin
if ($LASTEXITCODE -ne 0) { throw 'Preflight command failed' }
# Require readyForApply: true, zero anomalies, and the expected database and collection.
```

### Back up to a new timestamped archive

Use a user-restricted backup location outside the repository. A whole-database BSON archive retains the related account, enrollment reservation and session data, as well as collection and index metadata. Backups contain sensitive data. Keep them access restricted and verify the restore before the migration. Standalone MongoDB has no replica-set oplog snapshot option. Application writes should stay paused through validation, and TTL expiry can still occur in the background. Compare restore counts against an appropriate snapshot and account for naturally expired OTP records. [MongoDB backup and restore guidance](https://www.mongodb.com/docs/v8.0/tutorial/backup-and-restore-tools/).

```powershell
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$backupDir = Join-Path $env:LOCALAPPDATA "CampusSwapBackups\otp49a-$stamp"
if (Test-Path -LiteralPath $backupDir) { throw 'Backup destination already exists' }
[IO.Directory]::CreateDirectory($backupDir) | Out-Null
$name = "campusswap-$stamp.archive.gz"
$remote = "/tmp/$name"
$archive = Join-Path $backupDir $name

docker exec $source sh -c 'umask 077; exec mongodump --host 127.0.0.1 --port 27017 --db campusswap --archive="$1" --gzip --quiet' _ $remote
if ($LASTEXITCODE -ne 0) { throw 'Backup creation failed' }
$sourceDigest = ((docker exec $source sha256sum $remote) -split '\s+')[0]
if ($LASTEXITCODE -ne 0) { throw 'Source checksum failed' }
docker cp "${source}:$remote" $archive
if ($LASTEXITCODE -ne 0) { throw 'Archive copy failed' }
$digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
if ($sourceDigest -ne $digest) { throw 'Archive checksum mismatch' }
Set-Content -LiteralPath "$archive.sha256" -Value $digest -Encoding ascii
```

Both the staged copy under `/tmp` and the host archive should be protected. Handle temporary copies under the approved backup retention process. Verify the archive with its saved SHA-256 before any later transfer.

### Restore into an isolated container

Use a fresh container with no network and temporary filesystems. The restore command maps namespaces to `campusswap_otp_index_restore_test`. Validate the restored collection counts and index metadata, including representative related collections and valid document shapes, without printing document contents. Archive checksum or a dry run alone does not establish restorability. [MongoDB namespace remapping examples](https://www.mongodb.com/docs/database-tools/mongorestore/mongorestore-examples/).

```powershell
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne (Get-Content -LiteralPath "$archive.sha256").Trim()) { throw 'Archive validation failed' }
$image = docker inspect --format '{{.Image}}' $source
if ($LASTEXITCODE -ne 0) { throw 'MongoDB image lookup failed' }
$restore = "campusswap-otp49a-verify-$stamp"
docker run -d --rm --name $restore --network none --tmpfs /data/db --tmpfs /data/configdb $image
if ($LASTEXITCODE -ne 0) { throw 'Restore container did not start' }
# Repeat this read-only ping until ready, then verify this is the intended disposable container.
docker exec $restore mongosh --norc --quiet --eval 'if (db.adminCommand({ping:1}).ok !== 1) quit(1)'
if ($LASTEXITCODE -ne 0) { throw 'Restore MongoDB is not ready' }
docker cp $archive "${restore}:$remote"
if ($LASTEXITCODE -ne 0) { throw 'Restore archive copy failed' }
docker exec $restore gzip -t $remote
if ($LASTEXITCODE -ne 0) { throw 'Archive gzip integrity check failed' }
$restoreArgs = @('--host','127.0.0.1','--port','27017',"--archive=$remote",'--gzip','--nsInclude=campusswap.*','--nsFrom=campusswap.*','--nsTo=campusswap_otp_index_restore_test.*','--stopOnError')
docker exec $restore mongorestore @restoreArgs --dryRun
if ($LASTEXITCODE -ne 0) { throw 'Archive dry run failed' }
docker exec $restore mongorestore @restoreArgs
if ($LASTEXITCODE -ne 0) { throw 'Restore failed' }
Get-Content -Raw -LiteralPath $migration | docker exec -i -e OTP_INDEX_MODE=preflight $restore mongosh --norc --quiet 'mongodb://127.0.0.1:27017/campusswap_otp_index_restore_test?directConnection=true' --file /dev/stdin
if ($LASTEXITCODE -ne 0) { throw 'Restored OTP catalog check failed' }
$manifest = 'printjson(db.getCollectionNames().sort().map(name=>({collection:name,count:db.getCollection(name).countDocuments({})})))'
docker exec $restore mongosh --norc --quiet 'mongodb://127.0.0.1:27017/campusswap_otp_index_restore_test?directConnection=true' --eval $manifest
if ($LASTEXITCODE -ne 0) { throw 'Restored aggregate counts failed' }
# Compare with the source manifest captured during the maintenance window.
# Once verification is complete, stop only the disposable restore container.
docker stop $restore
```

To capture the source manifest before the dump, use the same `$manifest` expression in mongosh inside `$source` with `$uri`. Compare exact counts for non-TTL data where available. For a usability check, read a known non-sensitive document shape from the restored database and print only integrity counts. The synthetic restore used both OTP kinds, checked that the records remained unexpired and readable, and verified an independent synthetic user marker and legacy TTL metadata.

### Apply and verify the index

The [migration script](../backend/scripts/otpIndexMigration.mongosh.js) defaults to preflight. Apply requires the explicit mode and a target-specific confirmation string. Access to the protected Docker process and a separately recorded operator approval are still required. The string guards against accidental invocation. The script rechecks collection type, collation, duplicates, malformed fields, and conflicting names or keys immediately before attempting the index. It uses one journaled `createIndexes` command and checks the catalog afterward. An exact index already present is a no-op. MongoDB also checks the constraint during index build, so an unexpected concurrent duplicate can still cause it to fail. [MongoDB index build behavior](https://www.mongodb.com/docs/manual/core/index-creation/).

```powershell
# Run only after separate approval, restore verification, and confirmation that writers are paused.
Get-Content -Raw -LiteralPath $migration | docker exec -i -e OTP_INDEX_MODE=apply -e OTP_INDEX_APPROVAL=APPROVED_CAMPUSSWAP_OTP_INDEX_49A $source mongosh --norc --quiet $uri --file /dev/stdin
if ($LASTEXITCODE -ne 0) { throw 'Index apply failed or was blocked. Keep the maintenance window open for inspection.' }
Get-Content -Raw -LiteralPath $migration | docker exec -i -e OTP_INDEX_MODE=preflight $source mongosh --norc --quiet $uri --file /dev/stdin
if ($LASTEXITCODE -ne 0) { throw 'Index verification failed' }
# Require requiredPresent: true, no conflicts, and the three original indexes still listed.
# Confirm no startup seeding, administrator bootstrap, or pending cleanup can affect data.
docker compose @compose start backend
if ($LASTEXITCODE -ne 0) { throw 'Backend resume failed' }
docker compose @compose ps
```

## Rollback and verification checklist

- Confirm the Compose project, exact database and OTP namespace before the maintenance window opens.
- Require aggregate preflight success both before backup and at apply time. Stop if duplicates, incompatible indexes, or malformed values appear. Address data anomalies only under separate authorization.
- Confirm the archive digest, actual isolated restore, record checks, and permissions.
- On timeout or ambiguous index acknowledgement, run read-only preflight to determine whether the index exists before considering retry. A failed preflight never justifies deleting OTP records.
- Compare the new catalog with the original. The expected difference is the verified unique `email_1_kind_1` index. Existing records and the TTL index remain intact.
- If operational rollback is necessary and separately approved, pause writers and remove only the verified `email_1_kind_1` index introduced in this window. Removing it reopens the original concurrency risk. A whole-database restore is a separate disaster-recovery decision and must never overwrite the running target as part of this procedure.
- After resuming the existing backend, verify health and both local proxies with read-only requests. Repeat the registration, reset, and overlapping issuance regression on a disposable database. Any persistent synthetic account or OTP write requires separate authorization.

## Rehearsal results

| Rehearsal | Result |
| --- | --- |
| Cold startup on an empty disposable database | Reproduced the initialization failure and the missing constraint after startup |
| Synthetic backup | SHA-256 matched after transfer and again after restore validation. Gzip integrity and archive dry run passed |
| Isolated restore | 4 restored, 0 failed. Verified 2 student OTPs, 1 reset OTP, 1 user fixture, 3 unexpired readable OTP payloads, and the 3 original OTP indexes |
| Guarded migration | First run created and verified the unique index. Reruns returned `already-present` and preserved the legacy indexes |
| Negative preflight | Duplicate and malformed keys blocked apply before DDL. The conflicting same-key index was reported. An attempt without target-specific confirmation was blocked |
| Registration and password-reset integration | 2 passed, 0 failed, 0 skipped, including the existing registration/reset suite and the dedicated concurrent reset test |
| Existing auth workflow regression | 7 passed, 0 failed, 0 skipped |

The concurrent reset test forced two requests past the initial cooldown read together. It observed one reset record, a separate student record for the same email, rejection of a duplicate same-kind insert, and two mock delivery calls. The index ensures record uniqueness. Delivery deduplication is a separate behavior. No real email was sent.

The verified archive contained only synthetic fixtures. The backup of the existing development database and its restore verification are still pending the approved maintenance window. No persistent database, index, account, volume, or secret was changed.
