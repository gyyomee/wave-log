# Condition data audit and cleanup

These are **manual maintenance scripts, not automatic migrations**. Run with an administrator PostgreSQL connection and psql. Do not put the connection password in Vite variables, a committed file or chat. Stop app writes during the approved cleanup and rollback window.

## What exists

- `surf_sessions`: one actual session, unaffected by cleanup.
- `surf_session_conditions`: primary key `session_id` enforces one conditions row per session. Scalar environmental fields are the effective session values. `manual_fields`, `manual_origins`, and `api_values` preserve edit/provenance data.
- `condition_intervals`: formerly generated both for time ranges and forecast timestamps. The new app stores no automatically generated entries here. Explicit manual or uncertain legacy entries remain intact.
- `condition_hourly`: formerly appended source groups/full-day responses repeatedly. The new app retains relevant, deduplicated hourly values and provenance within the inclusive fixed 3-hour forecast bounds. The manual script compacts verified Open-Meteo groups and leaves malformed/unknown groups untouched.
- `surf_session_marine_samples`: raw Open-Meteo model samples, unique on `session_id,sampled_at`. The existing schema only accepts model forecast/reanalysis types, not user measurements. The app hides irrelevant samples; physical historical pruning requires the explicitly approved cleanup below.
- No interval table exists. No table or column needs to be dropped.

## Conservative classification

An interval is automatically generated only if its ID matches the historical timestamp naming pattern, it has no manual fields/origins or unknown properties, and every nonempty environmental value equals its original API value. Empty generated rows also qualify. Mismatching values, unknown IDs/properties, manual nulls and explicit edits are retained. All scalar session environmental values, ratings, board, wetsuit, tide data and real sessions are left untouched by SQL cleanup.

Raw model rows outside the parent session's rounded 3-hour display range are candidates. Historical model samples **inside** that range remain. The script does not automatically delete samples merely because their original request interval differs. Coordinates with unclear provenance require separate review; nothing guesses a station or location.

## 1. Read the audit

Apply the existing Phase 5.2/5.3 schema migrations if missing before running these scripts. This refactor adds no migration.

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/maintenance/audit_conditions.sql
```

The script changes no application data and rolls back its temporary helpers. Output includes actual session count, automatically generated JSON entry count, affected conditions-row count, source-group counts, and obsolete marine-row count by session ID. Private notes/values and credentials are not printed.

Remote affected counts have **not** been measured by the agent. The available local database had zero sessions and only `surf_sessions`/`surf_spots` installed. Isolated local fixtures were used for validation, not represented as production results.

## 2. Back up and approve IDs

Create a private directory `backups/` (gitignored), then take a backup with a matching PostgreSQL client:

```sh
pg_dump "$DATABASE_URL" --format=custom --file=backups/before-condition-cleanup.dump \
  --table=public.surf_sessions --table=public.surf_spots \
  --table=public.surf_session_conditions --table=public.surf_session_marine_samples
```

Keep this backup off-repository as well. Verify it with `pg_restore --list backups/before-condition-cleanup.dump`; test restoration in a separate disposable database, not over production.

Copy reviewed session UUIDs into the `approved_sessions` insert in `cleanup_conditions.sql`. An empty approval list affects zero rows. Do not insert every session blindly.

## 3. Dry run, then explicitly commit

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/maintenance/cleanup_conditions.sql
```

The default final `ROLLBACK` makes this a dry run. Review the affected-row counts. The script locks writes while calculating/backing up/updating so counts and backups are consistent. It backs up complete affected rows to the private `wave_log_cleanup.backups` table, including post-cleanup conditions state for conflict detection.

Only after approving the result, change the final `rollback;` to `commit;` in a private reviewed copy and run it. Save the reported batch UUID, rerun the audit, and verify the application. The live script remains rollback-by-default in version control. The lock can block app writes; use a maintenance window.

## 4. Roll back a committed cleanup

In `rollback_conditions.sql`, replace the NULL batch with the reviewed committed batch UUID. Dry run first. It restores only the changed condition JSON columns and removed marine rows from the backup. It aborts if conditions have changed since cleanup or a marine ID/timestamp is occupied, rather than overwriting subsequent user data. A deleted parent session also prevents restoration; handle that manually.

After verifying the dry run, explicitly change its final rollback to commit in a private copy. Do not directly restore the full dump over a database that has received new user records.

## Verification actually executed

The agent created isolated fixtures in a local transaction, ran the audit, backup/cleanup and rollback scripts, then rolled back the entire transaction:

- Actual fixture sessions: 1, retained throughout.
- Interval entries: 3 -> 2 (one proven auto entry removed; one manual and one uncertain retained).
- Source groups: 2 duplicate groups -> 1 relevant source group.
- Marine rows: 2 -> 1 (only the out-of-range model row removed).
- Backups: 1 full conditions row and 1 marine row.
- Rollback restored all 3 original interval entries and both marine rows.

No remote records were changed. New-form state tests additionally cover time changes, manual preservation, deduplication, no forecast persistence, and retries/concurrent saves creating only one session.
