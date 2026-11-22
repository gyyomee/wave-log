# Wave Log

## Journal Cleanup And Personal Equipment (Current)

This section supersedes the My Page/inspection UI described below. The redundant "마이페이지로" and journal-detail "목록으로" buttons are removed. Detail actions are Edit/Delete, with delete confirmation preserved. Top-level Calendar/My Page navigation and browser Back/Forward use the existing app without React Router or new URL paths. My Page now contains Statistics, My Equipment, Preferences and Logout. Statistics no longer displays the wind inspection inventory, review table, download or correction actions. Internal unit/provenance validation still excludes unresolved wind values; regular wind statistics and the chosen kts/m/s display remain unchanged.

### Session Date And Time

The selected calendar date is non-editable context. Only the 24-hour start/end wheel inputs remain. An earlier end clock means the following Seoul day and shows "익일". Equal clocks are rejected for new sessions. Editing uses the existing session start date, not today. Unchanged historical timestamp strings (including seconds/milliseconds) are preserved. Existing sessions lasting 24 hours or more retain their original end date when editing; a multi-day end date is shown explicitly rather than being silently collapsed. Tide-event dates remain editable and are unrelated to the removed session-date inputs.

### Equipment Storage And Saving

Migration: `supabase/migrations/20261122010000_user_equipment.sql`. `public.user_equipment` stores `id`, authenticated `user_id`, `equipment_type` (`surfboard`/`wetsuit`), display name, generated normalized name, active flag and timestamps. SELECT/INSERT/UPDATE RLS restrict access to the owner; hard DELETE is not granted. A database unique constraint covers owner/type/normalized name across active and archived rows, preventing concurrent duplicates. Explicitly adding an archived name reactivates that entry instead of creating another one.

The additive migration imports distinct historical `surf_sessions.board_name` and `surf_session_conditions.wetsuit` values into the collection. NFC, collapsed whitespace and lowercase identity deduplicate names; the earliest matching spelling is chosen deterministically for the collection. No journal text, timestamps, ratings, environmental samples or authentication records are updated. Empty or normalized names longer than 200 characters are not imported and remain untouched in the historical journal. No sample boards/suits are seeded as user equipment.

My Equipment supports add, rename and removal from the active list (archive). Renaming/archive never rewrites journal snapshots and never deletes a session. Unchanged historical gear is not re-registered during unrelated journal edits, so archived/renamed gear does not reappear just because an old journal is saved. Historical board and suit strings are kept exactly when their inputs were not edited. Active collection items are the selectable source after migration; old names are backfilled once, not repeatedly re-imported after archive.

The journal uses custom accessible comboboxes instead of native `datalist` (whose suggestion affordance was unreliable on mobile). Focus or the visible arrow opens all active options before typing. Filtering, scrolling/tap selection, Arrow/Enter selection, Escape/Tab dismissal and keyboard-aware placement are supported. The wetsuit field stays immediately below the board. Typing alone does not write equipment. After the session and conditions both save successfully, `register_my_equipment` registers the entered pair atomically as the authenticated user; normalized uniqueness makes retries/concurrent registration idempotent. If journal/conditions saving fails, equipment registration is not called. If registration itself fails, the journal has already saved: the form says so and a retry updates the same journal ID and retries equipment registration. No frontend service-role key or new dependency is used.

### Deployment And Verification

The new migration has **not** been applied to the remote project. Until applied, the app reports that equipment cannot be loaded; new equipment-bearing saves are blocked before writing a journal when the collection is unavailable. Existing unchanged gear snapshots can still be saved. Apply only after reviewing pending migrations and taking a database backup:

```sh
cd /Volumes/GAYOMEE/wave-log
npx supabase link --project-ref mtfbtokzodgmppcmbghu
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Review the pending list, then explicitly apply:
npx supabase db push --linked
npx supabase migration list --linked
```

Check that `20261122010000` appears in both Local/Remote, inspect `user_equipment` and its owner-only policies, then reload. My Page > My Equipment should show historical distinct names. Test adding, renaming and archiving a disposable new equipment item; old journal details must retain their original names. For a new disposable journal, confirm new names appear only after successful save. Verify the same collection on another device after reload. No additional API credentials, Kakao changes, Edge Function deployment or Pages configuration changes are needed. Publish the frontend separately through the existing GitHub Pages workflow when approved. Nothing was committed, pushed or deployed automatically.

Validation: **94 JavaScript tests passed**, **92 pgTAP checks passed** against the local Supabase PostgreSQL container (including 22 equipment checks), plus **5 actual migration/backfill checks passed**. All SQL fixtures and temporary migrations were transactionally rolled back. The production build passed with the existing non-blocking mixed Supabase import warning. `tests/verifyEquipmentMigration.mjs` can replay the backfill checks against the local `supabase_db_wave-log` container before the equipment migration is installed; it refuses to reset an already-migrated database. For a disposable fully migrated local database, run `npx supabase test db`; no production test writes were performed.

Browser checks covered real read-only navigation/detail pages and the time-only creation form, plus the isolated `/wave-log/tests/browser/equipment.html` fixture for mobile dropdown scrolling/selection/search/keyboard dismissal, fake save-failure/retry registration and rename. Fixtures use only in-memory test gear, not Supabase. Real iOS keyboard/touch behavior, remote equipment writes and cross-device synchronization await manual deployment/testing. Collection changes load on sign-in/reload, not realtime. The existing multi-request journal save remains non-transactional; equipment registration occurs only after it succeeds and is independently atomic.

Added files: `src/equipment/{EquipmentContext,EquipmentInput,EquipmentManager}.jsx`, `src/equipment/equipmentModel.js`, `src/services/equipment.js`, `src/journal/{sessionTimes,useJournalRoute}.js`, the equipment migration and `supabase/tests/database/equipment.test.sql`, `tests/equipment.test.js`, `tests/verifyEquipmentMigration.mjs`, and `tests/browser/equipment.{html,jsx}`. Updated App, MyPage, Journal, SessionForm, useConditions, Statistics, ConditionsDetail, journal CSS, journalSave/sessionConditions services and regression tests. Removed the unused user-facing `WindReviewAction.jsx`; historical interpretation helpers and source metadata are retained. Previous uncommitted work remains intact.

## My Page And Account Preferences (Current)

This supersedes the fixed-kts UI and top-level Statistics navigation below. Main navigation is Calendar / My Page. My Page retains the Kakao nickname and logout, and opens the existing Statistics dashboard or Preferences. Calendar cells, authentication, Pages base path, tide inputs and existing journals are unchanged.

### Account-specific wind units

`public.user_preferences` is a minimal settings table, not a profile/authentication table. Its primary key is `auth.users.id`; `wind_speed_unit` is `kts` (default) or `m/s`. Separate SELECT/INSERT/UPDATE/DELETE RLS policies and grants restrict records to their owner. The new additive migration is `supabase/migrations/20261122000000_user_preferences.sql`. No existing record is backfilled, converted or deleted.

Preferences load on sign-in and are shared by the form, saved conditions, timestamp table and Statistics through an account-keyed provider. No global localStorage preference is used. Selecting a unit saves immediately, with saving/success/error feedback. Failed initial reads use kts without writing a default; controls stay disabled until a successful retry. Failed saves restore the last unit. In-flight results cannot cross account boundaries. Other already-open devices pick up changes on sign-in/reload; realtime cross-device notifications are not implemented.

Canonical effective storage and calculations remain **m/s**. `windToDisplay`, `windFromInput`, and `formatWind` in `src/lib/windUnits.js` are the shared boundary for current UI and future Phase 8. A preference change never edits condition state, original samples, or journals, and never triggers an Open-Meteo request. Saved display/statistics round to one decimal; editable inputs show up to six decimals while the unrounded canonical value remains untouched until the user actually edits that field. The editor also provides the same unit control so unsaved timestamp edits survive switching. API reset values remain canonical internally and are converted only at display.

Open-Meteo remains explicitly requested with `wind_speed_unit=kn`, independently of display preference. The response must declare `kn`/`kts` in `hourly_units.wind_speed_10m`. Incoming values normalize once; original source values/units and caches remain intact. Earlier ms requests are differentiated from explicit response-unit evidence. See [official weather API documentation](https://open-meteo.com/en/docs).

### Historical review

Statistics includes a read-only wind inventory: historical manual flags (interpreted as kts by the owner's instruction), explicit API unit evidence, code-derived legacy m/s evidence, user-reviewed units, tagged canonical values, and unresolved units. Counts include scalar/interval values and raw hourly samples, not just unique sessions; they should not be interpreted as independent observations. A manual flag alone cannot distinguish old restore-button use from typed input. Code-derived API units are not claimed to be recovered response metadata.

Unresolved values stay out of wind-dependent statistics. For each unresolved value, select its original unit and explicitly confirm. Only interpretation metadata is saved: `_wind_speed_review` in scalar/interval `api_values`, or `wind_speed_review` on an hourly JSON sample. The original number and API unit are not overwritten. Reviews bind to the original number, path and timestamp; an `updated_at` compare-and-swap rejects concurrent changes. This uses existing conditions RLS, not an admin key or a new journal table. A later explicit journal save may normalize effective scalar/interval values with the existing `_wind_speed_storage` marker; raw hourly numbers remain unchanged. Review is not a bulk conversion tool. Back up the affected conditions row before correcting historical data. To reverse an erroneous confirmation, restore its reviewed JSON field from that backup after checking for newer edits; no automatic destructive undo is provided.

Read-only inspection on 2026-11-22 of the signed-in account's 6 loaded sessions found **7 manual-flagged values, 0 API values with explicit unit metadata, 30 API values classified from historical ms-request code, 0 unresolved, 0 user-reviewed, and 0 other tagged values**. This is not an audit of every Supabase user, and does not prove that all seven manual flags originated in typing rather than old reset controls. No journal or preference was written to the remote project during validation.

### Apply And Verify

The new settings migration has **not** been applied remotely. Until it is applied, settings load failures are expected; the calendar and journal continue using the safe default. Review pending migrations before any push:

```sh
cd /Volumes/GAYOMEE/wave-log
npx supabase link --project-ref mtfbtokzodgmppcmbghu
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Only after confirming the pending list and taking a backup:
npx supabase db push --linked
npx supabase migration list --linked
```

Expect `20261122000000` in both Local and Remote. Open `user_preferences` in the Dashboard table editor and inspect its RLS policy view for the four owner-only policies. No Kakao/OAuth/API-secret changes are needed. Reload the app, open My Page > Preferences, select m/s, and confirm the saved message. Reload or sign into the same account on another device to check persistence. Another account without a settings row must still default to kts. Confirm that 10 kts displays as approximately 5.1 m/s without changing journal data or statistics sample counts. Publish the frontend separately through the existing GitHub Pages workflow when approved; nothing is auto-committed or deployed.

For a disposable local Supabase database, use `npx supabase migration up --local` then `npx supabase test db`. Do not reset a populated database to run tests. During this task the new migration and its pgTAP file were executed together inside a transaction against the existing local Supabase PostgreSQL container: **17 RLS/constraint checks passed and the entire transaction was rolled back**. No local or remote persistent migration was performed. [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-up).

`npm test` covers preference lifecycle/races, account isolation in service calls, conversion, ambiguous review metadata/concurrency, timestamp input/reset/reload and consistent UI units. `npm run build` uses the unchanged Pages configuration. The optional dev-only `/wave-log/tests/browser/windPreferences.html` fixture uses two in-memory fake accounts and no data/weather requests for browser interaction checks; it is not included in the production build and resets on reload. Real cross-device preference persistence and remote review writes must be tested after manual deployment, not claimed from the fixture.

Final validation: **87 JavaScript tests passed**, **70 local pgTAP assertions passed** across all five SQL test files (including 17 new preferences checks), and the production build succeeded. Pending local migrations were prepended inside each test transaction, with all DDL and fixtures rolled back. `supabase test db` was not the runner for these checks; they used psql against the local Supabase container to avoid permanently applying pending local migrations. The existing non-blocking mixed static/dynamic Supabase import warning remains. Browser checks covered My Page navigation, the safe missing-migration state, 375px/desktop layout, fake-account persistence/isolation, keyboard unit switching and editable values. Reset logic was verified by automated tests; a browser confirmation-dialog automation limitation prevented completing the reset click interactively. Actual physical-device touch gestures and real cross-device writes remain untested.

New files: `src/preferences/{MyPage,PreferencesContext,WindUnitControl,WindReviewAction}.jsx`, `src/preferences/preferenceStore.js`, `src/services/{userPreferences,windReview}.js`, `src/lib/windReview.js`, the migration/RLS test above, `tests/preferences.test.js`, `tests/preferencesUI.test.js`, `tests/windReview.test.js`, and `tests/browser/windPreferences.{html,jsx}`. Updated: App, Journal, Statistics/statisticsModel, ConditionsEditor, SavedWaveTable, windUnits, conditionModel/conditionPersistence/forecast, journal CSS, existing UI tests and this README. Earlier uncommitted wind/statistics work is preserved.

## Wind Units And Phase 7 Statistics (Current)

User-facing wind input, saved detail and statistics use **kts**. Internal effective values and new writes to `surf_session_conditions.wind_speed` and timestamp edits use **m/s**, retaining existing database bounds. Conversion is exact: 1 kt = 1852/3600 m/s. Historical raw JSON API samples are not rewritten just to display them.

### Historical evidence and preservation

- The original and pre-change `conditionApi.js` explicitly requested `wind_speed_unit=ms` for both forecast and archive weather. Its old response validator checked m/s only when `hourly_units` existed. A public-coordinate live API probe confirmed ms returns m/s and kn returns kn. See [Open-Meteo unit documentation](https://open-meteo.com/en/docs).
- Historical `manual_fields` identifying wind mean the original number was entered in knots, per the owner's clarification. A manual 10 stays **10 kts** on screen, not 19.44. It becomes 5.144444... m/s only in the normalized model and on an explicit save. Original numbers and units are retained in JSON metadata.
- API values with explicit units use those units. Older compacted snapshots often lost `hourly_units`: only a complete recognized legacy Open-Meteo weather signature (provider, model, source type, fetch timestamp and session context) uses the old ms request code as evidence. This is **code-derived inference, not recovered response metadata**. Similar-looking numbers are never unit evidence. Incomplete, contradictory or invalid records are flagged rather than guessed.
- Historical manual flags cannot prove whether the user typed a value or used an old restore control that also set that flag. Manual flags follow the owner's manual=kts convention; numerical equality with API values does not override it. Review such known restore cases with the owner before any correction.
- `api_values._wind_speed_storage` version 1 tags canonical m/s or unknown, with the normalization reason and original number/unit where present. The same marker is used inside `condition_intervals`. It prevents double conversion. `manual_origins`, original `api_values.wind_speed`, and raw hourly values remain intact. An unknown value is retained but not presented as a known wind speed or used in wind statistics.
- Future forecast/archive requests explicitly use `wind_speed_unit=kn` and require a compatible `hourly_units.wind_speed_10m`. Parsed values normalize once to m/s; `wind_speed_source_value`, `wind_speed_source_unit`, `response_unit`, and `requested_wind_speed_unit` retain the received value and unit through source compaction.

No bulk conversion, new schema, migration, or Edge Function deployment is required. Reads, statistics and review export never write to Supabase. Only a user's explicit journal save persists normalized effective values and markers through the existing conditions upsert. No production write test or remote migration was executed. Back up `surf_session_conditions` before editing historical records; keep that backup with the old app version. Rolling back to an old client after tagged saves requires a reviewed restoration, since old clients cannot understand the new marker. Close/reload older tabs when publishing this version.

### Statistics and review

The Statistics tab shares the existing authenticated session/conditions query. It supports Seoul start-date and spot filters, record/day/hour totals, optional rating means, and monthly, spot and whitespace-normalized board summaries. No additional table, dependency, recommendation algorithm or API is involved.

Wind contributes at most one value per session: the saved effective clock point nearest the session midpoint, with earlier timestamp winning ties. A legacy session-wide manual baseline has midpoint priority. Candidates are limited to the existing displayed forecast range; no interpolation or missing-value substitution is performed. The mean weights sessions equally, not hourly sample counts. Any unresolved unit in a session's stored wind provenance excludes that session's wind only, not its ratings/counts. Missing wind is separate from unresolved wind. Future Phase 8 code must consume `sessionWind`/`windResolution`, never average raw stored `wind_speed` numbers.

Unresolved values appear under "풍속 단위 확인 대상" with a record link and downloadable local JSON list (record ID, date, spot, path, original number and reason). This is a read-only report for manual review, not a conversion script. The current browser inspection covers only the signed-in account's loaded records, not every database user.

Validate with `npm test` and `npm run build`. Publish only when approved via the unchanged GitHub Pages workflow. Mocked service roundtrips test persistence without touching real records. Mobile layout keeps tables horizontally scrollable, condition row labels compact, and reset controls beside their inputs. Earlier validation counts below describe previous phases, not this update.

## Session Conditions Persistence (Current)

This supersedes the historical interval descriptions below. Forecast clock points are derived UI data (`_forecast`). The single editable wave-information table stores only explicit timestamp edits, not automatically generated interval entries. One `surf_sessions` row represents one surf; one `surf_session_conditions` row contains its environment, wetsuit and optional tides.

Timestamp edits use the existing `condition_intervals` JSON column: `forecast_at`, the edited fields, `manual_fields`, `manual_origins` and separate `api_values`. Re-editing a timestamp updates the same entry. A one-millisecond start/end envelope satisfies the existing positive-duration validator; it does not represent another session. Original hourly values remain separate in `condition_hourly`. Existing owner-only RLS covers these columns. No new migration or Edge Function deployment is needed; the existing `20261101030000_condition_intervals_tides.sql` migration must already be applied.

Only exact hourly samples prefill timestamps; a session's automatic representative is not copied into missing timestamp cells. Legacy session-wide manual values act as the recorded baseline, and overlapping legacy interval manual values take precedence within their original coverage. New timestamp edits override either baseline without deleting it. Values outside the selected range are not displayed in the editor and remain preserved if manually recorded. API refresh cannot replace manual values. Direction names are FROM bearings; arrows point TO (`degrees + 180`), with precise API angles retained until explicitly changed.

Calendar cells contain only dates and a registration dot. Selected-day sessions appear separately below. Saved detail actions are Edit, Delete, Back to List. The editor has one wave-information table with sticky row labels and horizontally scrollable timestamp columns. No credentials or deployment settings change; publish through the existing GitHub Pages workflow when ready.

Changing session time immediately discards old automatic form values and out-of-range source samples. Explicit manual values (including null), original edit provenance, and uncertain legacy input are preserved. Replacing a manual value with an API value requires confirmation. Historical multiple manual inputs remain separate rather than being merged or discarded silently.

Forecast reference timestamps still use fixed Seoul 3-hour boundaries. Only exact hourly values are shown. Relevant source samples retain their original values and provenance but are deduplicated; full-day payloads and older selection groups are not appended indefinitely. Marine table display is filtered to the selected session/spot/range. Existing physical marine-table leftovers require reviewed maintenance, not silent deletion on page load.

The time wheel, wetsuit placement, authentication and deployment configuration are unchanged. Saving is guarded against simultaneous submissions and reuses the assigned session ID after a conditions-save failure. Condition persistence is still an upsert on the unique `session_id`.

No new schema migration is required. For existing-data impact counts, backup, explicit ID approval, dry-run cleanup and conflict-aware rollback, see [maintenance instructions](supabase/maintenance/README.md). No remote audit or destructive cleanup was performed. Only isolated local fixture cleanup/rollback was executed. Back up affected data before editing old records or approving maintenance.

Current validation: 60 JavaScript tests pass and the production build succeeds (existing non-blocking mixed static/dynamic Supabase import warning). Tests cover timestamp-specific edits, mocked save/reload, source/manual separation, legacy preservation, spot/time changes, nulls, 90-minute boundaries, overnight dates, calendar indicators and 16-direction mapping. Browser checks confirmed calendar selection, detail actions, responsive tables, independent timestamp input and keyboard direction selection; temporary edits were cancelled without saving. Remote database writes and real-device touch dragging were not tested. No remote data, migration, authentication or deployment configuration was changed in this UI update. Earlier local SQL maintenance validation is historical, not a new production audit.

## Time Picker And Fixed Forecast Times

This update supersedes the session-anchored forecast display described in Phase 5.3 below.

- Start/end (and tide event) time fields open a vertical hour/minute wheel dialog. Hours are 00–23 and minutes 00–59. Native touch scrolling, mouse scrolling/dragging, Arrow/Home/End/Page keys, exact HH:mm text entry, confirm/cancel and Escape are supported. Choosing a time does not change the date; overnight sessions retain separate start/end dates. No horizontal time slider or AM/PM selector is used.
- Forecast timestamps are fixed to Asia/Seoul 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00 and 21:00. Start rounds down. End uses the preceding boundary when at most 90 minutes after it, otherwise the next boundary (the 90-minute tie rounds down). Thus 08:00-14:00 shows 06/09/12/15, and 18:00-18:20 shows only 18:00. Dates appear alongside every timestamp, including midnight crossings.
- Only an hourly sample at that exact timestamp is used. There is no nearest-neighbour substitution, interpolation or averaging. Missing values remain empty; manual overrides remain distinct. Requests cover the expanded forecast range including its final hourly sample. Existing hourly snapshots are reused, and original marine sample records remain unchanged.
- Saved forecast-point overrides use the existing JSON condition storage with a `forecast_at` marker and a one-millisecond storage envelope to satisfy its positive-duration constraint. This is an exact timestamp, not an aggregated interval or a new surf-session record. No database migration is added.
- Only timestamps for the currently selected session range are editable in the single table. Hidden older manual rows remain stored, but there is no separate historical-interval or session-environment editor. Legacy manual values provide the compatible baseline described above; automatic summaries are never copied into other timestamps.
- Wetsuit input now follows the board input directly, preserving custom text and historical suggestions.

Validation: 44 automated JavaScript tests pass, including all 1440 valid HH:mm combinations, keyboard bounds, fixed-boundary examples, midnight dates, exact-sample/null behaviour, override preservation, and server-rendered wetsuit placement. Production build passes (existing non-blocking mixed import warning remains). Real touch/mouse interaction and mobile screenshots could not be verified because browser control was unavailable. No production records were created or changed. No new dependencies, remote migrations or deployment settings were added.

## Phase 5.3 Intervals And Tides

This phase supersedes the session-wide representative editing workflow described below. Kakao Auth, calendar/list, GitHub Pages base and deployment configuration are unchanged.

### Three-hour intervals

- Intervals start at the actual session start, last no longer than three hours, and end exactly at the session end. They are half-open [start, end): 08:00–14:00 becomes 08:00–11:00 and 11:00–14:00. Overnight boundaries use UTC instants displayed in Asia/Seoul.
- For a given session/location request, each Open-Meteo source group (waves, SST, weather) is fetched once, not per interval. All intervals are derived from those hourly rows. Existing matching marine samples are reused.
- For each field independently, choose the valid hourly sample inside the interval nearest its midpoint; a tie selects the earlier timestamp. Different fields can have different timestamps, displayed individually. There is no interpolation or direction averaging. Null stays unknown, zero remains zero. A short interval without an hourly instant has no automatic value.
- `condition_intervals` contains effective values, original API representative values, manual fields and their original provenance. Manual edits, including clearing to null, survive API refresh. Restore uses the latest API representative. `condition_hourly` appends source snapshots (including raw new API responses where available); manual edits do not alter them. Previously saved hourly marine samples are unchanged.
- Interval identity is its exact start/end boundary pair. Changing boundaries retains the previous rows under “이전 시간 구간 기록”, rather than guessing where to move manual overrides. Restoring the original boundaries reuses their manual values. Previous Phase 5.2 scalar environmental values remain under “기존 세션 전체 환경값”; they are never automatically copied into every new interval.
- Wetsuit, board and ratings remain session-level. Sessions remain limited to 31 days. Historical intervals are retained, with a maximum of 1000 stored interval rows per session.

### Tide input and future KHOA integration

- “물때” is nullable free text with 1물–14물, 조금 and 무시 suggestions. The independently chosen convention is unset, 7물때, 8물때 or custom. The app never infers a convention from location or computes a label from a Gregorian date.
- Optional tide events support high/low type, a local date and 24-hour HH:mm, nullable predicted height in centimeters, and a station name. Adjacent dates and multiple events of either type are accepted, with a defensive limit of 500 events per session. Negative tide heights are allowed relative to the provider's datum; accepted range is -5000 to 5000 cm.
- Each event preserves its Asia/Seoul date/time and UTC `occurred_at`. The schema also reserves `station_id`, `source` (manual/khoa), and an `original` object for provider response, retrieval timestamp, units and vertical datum. Editing a future imported event retains its original payload and marks the effective event manual.
- **No KHOA requests or automatic station assignment are enabled in this phase.** Manual input works without an API key. Station name entered by the user is labelled manual, not a verified KHOA prediction. No unofficial endpoint, inferred station coordinate or fabricated forecast has been added.
- Before enabling KHOA, obtain access to the official [KHOA high/low tide forecast service](https://www.data.go.kr/data/15156018/openapi.do) through the public data portal. Verify its current response contract, station catalogue, date coverage, units and vertical datum with the approved account. The official endpoint contract could not be retrieved during this implementation.
- A future server-side adapter must use an explicitly verified spot-to-prediction-station mapping (station ID/name, spot/location, verification provenance), not merely the geographically nearest observation station. Keep its service key in Supabase Edge Function secrets, never a VITE variable. Import original forecasts separately from edited values, and do not convert predicted heights to numbered tide labels. No new key or Edge Function deployment is required for the current manual workflow.

### Schema and deployment

New migration: `supabase/migrations/20261101030000_condition_intervals_tides.sql`. It adds `condition_intervals`, `condition_hourly`, `tide_cycle_label`, `tide_convention`, and `tide_events` to the existing `surf_session_conditions` table. Existing owner-only CRUD RLS and grants cover the added fields. Database checks validate interval duration/numeric bounds, tide date/time/UTC agreement, event type, nullable height, and regional convention. There is no data backfill or deletion.

From this repository, review and apply pending migrations yourself:

```sh
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Check the pending list (including Phase 5.2 if not applied), then:
npx supabase db push --linked
npx supabase migration list --linked
```

Both Local and Remote migration columns should include `20261101030000`. Refresh the local app after applying it. Publishing to GitHub Pages requires committing the changes and pushing to main; no workflow change is needed. Remote migrations have not been applied by the agent.

### Verification

```sh
npm test
npm run build
# On a local Supabase database with the migrations applied:
npx supabase test db supabase/tests/database/intervals_tides.test.sql
```

39 JavaScript tests passed, including interval splitting, midnight, null/zero, compass precision, overrides, original snapshots, multiple tide events, regional labels, service serialization and server-rendered controls. Build passed with the existing non-blocking mixed static/dynamic import warning.

13 pgTAP checks passed on local PostgreSQL using a temporary transaction containing the new schema and isolated fixture data; everything was rolled back. They cover owner writes, interval bounds, tide validation, cross-user read/update/insert denial, anonymous denial and cascade deletion. Remote storage, live KHOA integration and browser/mobile interaction are not verified. Browser automation was unavailable; no production records were modified.

## Phase 5.2 Editable Conditions

New journals start with three 1–5 ratings at 3. Existing values, including null, remain unchanged until edited. `rating_intent` records default/confirmed/modified/legacy per rating. The 3-point confirmation action is optional; merely saving does not falsely mark defaults intentional. Performance is still excluded.

The location warning now uses validated coordinates from the selected saved or external spot. A selected location remains valid after the search dropdown closes. Kakao search/auth/CORS and deployment configuration were not changed in this phase.

New migration: `supabase/migrations/20261101020000_session_conditions.sql`. It adds a one-to-one `surf_session_conditions` table with nullable wave height/period, swell height/period/direction, wind speed/direction, water/air temperatures, wetsuit and provenance. Numeric bounds and parent-session ownership RLS protect the table; session deletion cascades. Existing journals and hourly marine samples are not rewritten.

Effective values are separate from immutable existing marine samples. `api_values` stores representative original values with source, model, timestamp, fetch time and coordinate/time context. `manual_fields` identifies overrides including explicit clearing to null; `manual_origins` retains the original API/context at the first override. API refresh updates only unedited fields. Restore uses the latest original API value. Old-context values are labelled when location/time changes. Failed API groups retain existing values rather than replacing them with zero or silently clearing them.

The representative sample is the valid hourly timestamp nearest the session midpoint within [start, end), ties choosing the earlier timestamp. Wave, SST and weather groups may use different available timestamps; each field displays its source timestamp. Directions remain precise numeric FROM-degrees and are shown with a 16-point compass. No arithmetic direction averaging is used.

Wave prefilling reuses matching stored marine samples or the existing MFWAM integration. SST uses the Marine API's `sea_surface_temperature` best-match model, available from January 2022 subject to provider coverage. Weather uses `/v1/forecast` for recent dates and `archive-api.open-meteo.com/v1/archive?models=era5` for dates older than 90 days. Wind requests use `wind_speed_unit=ms`; temperatures use Celsius. Forecast and reanalysis are labelled distinctly, never observations. Requests are debounced 600 ms and identical contexts cached in memory for five minutes; failures may be retried. No request is made without valid location and time. Short sessions with no hourly instant can have no model data.

Wetsuit is free text with supplied/common and user-history suggestions; it is never inferred from temperature. Historical suggestions are limited to the first 1000 accessible nonempty rows.

Manual deployment (not executed by the agent):

```sh
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Review pending migrations, then explicitly apply:
npx supabase db push --linked
```

After applying all pending migrations, refresh the app. No Edge Function deployment or new secret is needed for Phase 5.2. Local DB tests can run with `npx supabase test db supabase/tests/database/conditions.test.sql`.

Session and condition saves are separate requests. If conditions fail, the saved journal is preserved and the form explicitly reports the partial save; retry within that form updates the same session ID. Do not close the form until retry succeeds. Loading existing conditions must succeed before an existing journal can be edited, preventing accidental loss of unread metadata. Until migration is applied, existing-condition loading/saving will report a schema error.

Validation: 32 JavaScript tests passed, including mocked API parsing, midpoint/overnight selection, rating defaults/null preservation, location validity, manual overrides/refresh, missing values, compass precision and wetsuit deduplication. Server-render tests verify slider bounds and no activation checkboxes. Five pgTAP checks passed against local Supabase PostgreSQL (owner insert/read, invalid direction, cross-user read/insert, cascade delete); the migration and fixtures were wrapped in a transaction and rolled back. Real weather/SST responses, browser touch interaction and remote table/RLS execution have not been verified in this phase.

References: [Marine API](https://open-meteo.com/en/docs/marine-weather-api), [Weather Forecast](https://open-meteo.com/en/docs), [Historical Weather](https://open-meteo.com/en/docs/historical-weather-api).

## Phase 5.1 Place Search Setup

Ratings now use immediately interactive native 0–5 sliders: 0 saves null, 1–5 preserve their numeric value. No activation checkbox/default 3 is used. Performance rating remains omitted from writes.

Existing user spots (loaded through RLS) are listed before Kakao results. External searches debounce for 500 ms, require at least two characters and return at most eight places. Stale responses are ignored. External results are never selected automatically. Selecting a saved spot and then an external place links that location to the same spot ID after confirmation; alternatively use the detail panel's location search. Existing coordinates are never overwritten from a fuzzy name match. A text-only spot remains valid if search fails or has no coverage, but marine retrieval then needs a location.

### Secrets And Deployment (Manual)

1. In Kakao Developers, open your app and obtain its REST API key. Check that the app is allowed to call the Local keyword search API and has available quota. This is separate from Kakao OAuth client-secret configuration. Endpoint: `GET https://dapi.kakao.com/v2/local/search/keyword.json`, authorization `KakaoAK REST_API_KEY`. See [official Kakao Local documentation](https://developers.kakao.com/docs/ko/local/dev-guide).
2. Supabase Dashboard > Edge Functions > Secrets: add `KAKAO_LOCAL_REST_API_KEY` with that key. Never put it in any `VITE_` variable or commit it.
3. Add `PLACE_SEARCH_ALLOWED_ORIGINS` as a comma-separated list of exact origins, for example `http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:5173,http://localhost:5173,https://YOUR_GITHUB_USERNAME.github.io`. Replace the GitHub hostname. Origins have no path or trailing slash, so do not append `/wave-log/`.
4. After explicitly approving deployment, run:

```sh
npx supabase link --project-ref mtfbtokzodgmppcmbghu
npx supabase functions deploy search-places --project-ref mtfbtokzodgmppcmbghu
```

No database migration is added in Phase 5.1. No function or secrets were deployed automatically. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the function runtime. The function checks every bearer token against Auth's `/auth/v1/user` before querying Kakao. Config disables only the gateway's legacy JWT verifier so current signing keys work; application-level authentication remains mandatory. CORS allows only configured origins. No service-role key is used.

After deployment, sign in and type a place name. Check saved results first, choose an external place, save a new disposable record, then check automatic marine retrieval. For an existing coordinate-less spot, choose that saved spot first and then a Kakao result (or use details location search); confirm the update. Existing journal IDs/history and marine snapshots are preserved.

Per-user throttling allows 30 requests/minute per Edge isolate, not a global quota guarantee. Production-wide rate limiting and Kakao quota monitoring may be needed as traffic grows. Korea coverage is strongest; overseas misses remain text-only. Duplicate prevention is best-effort by normalized name and exact coordinates; concurrent tabs may still duplicate spots. Live Kakao/Edge authentication, CORS and deployment need verification after secrets are configured; local mocked tests do not establish those results.

## Phase 5 Marine Snapshots

Migration: `supabase/migrations/20261101010000_marine_samples.sql`. It has NOT been applied remotely by the agent. With the existing CLI link to project `mtfbtokzodgmppcmbghu`, inspect then manually approve/apply:

```sh
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# Only after reviewing the pending marine migration:
npx supabase db push --linked
npx supabase migration list --linked
```

The new table stores nullable hourly wave/swell/wind-wave data, provider/model/source type, requested and returned grid coordinates, fetch time, and the session interval/spot used for the snapshot. UNIQUE(session_id, sampled_at) prevents duplicate hours; parent-session deletion cascades. Separate RLS policies check parent ownership for SELECT/INSERT/UPDATE/DELETE. The refresh RPC is security-invoker and atomically replaces one owned session's samples. It never edits the parent journal. No secrets or extra dependencies are required.

After session save, the detail panel checks for existing samples and retrieves/stores marine data if none exist. Failures leave the session saved and visible. Enter missing/corrected coordinates in the detail panel's coordinate form; these update the existing spot, never inferred from its name. Existing snapshots are preserved on reopen or session edits. Changed session/spot metadata is flagged, and refresh requires confirmation when replacing a snapshot. Empty/failed refresh preserves the previous snapshot.

Hourly boundary rule: include only actual provider timestamps with `started_at <= sampled_at < ended_at`. No interpolation, nearest-hour substitution, or missing-to-zero conversion is performed. Sessions shorter than an hour may contain no hourly instant and display "파도 데이터 없음". Only UTC dates containing eligible hourly instants are requested, including overnight sessions; display remains Asia/Seoul. Requests longer than 31 days are rejected.

Uses `https://marine-api.open-meteo.com/v1/marine`, `models=meteofrance_wave`, `cell_selection=sea`, `timeformat=unixtime`, `length_unit=metric`. The ten variables requested match the Phase 5 specification. MFWAM is explicitly selected to keep model provenance stable. Recent and older archived forecasts use this same marine endpoint with explicit dates, not the atmospheric archive endpoint. Official documentation lists MFWAM coverage from October 2021 and a 10-day forecast; this implementation conservatively permits through now + 9 days. Model coverage, coastal cells, individual variables and availability near the archive start remain provider-dependent.

Past samples are labelled archived_forecast; future samples forecast, at fetch time. They are model estimates, not observations. ERA5 historical reanalysis is not requested; historical_model is reserved in the schema, not falsely attached to archived forecasts. The existing snapshot source label is not changed as time passes.

In-flight requests are deduplicated; stored snapshots avoid repeat API calls and upsert ignores duplicate hours. No background polling or automatic retry loop is used. Free Open-Meteo access is for non-commercial use: review current [usage limits and commercial licensing](https://open-meteo.com/en/pricing) before public/commercial rollout. Attribution to Open-Meteo and Météo-France/Copernicus Marine is displayed with the data. Browser-only deduplication is not a project-wide quota limiter.

Verification: unit tests mock API responses, exercise null/zero handling, hourly boundaries, midnight, historical selection, missing coordinates, API failures and duplicate requests. `supabase/tests/database/marine.test.sql` covers ownership, duplicate hours and session-delete cascade but has not been executed against a database. Run on local/disposable Supabase after migrations:

```sh
npx supabase test db supabase/tests/database/marine.test.sql
```

A real read-only API request at test coordinates 37.8,129 for 2025-06-01 returned hourly marine values successfully. These are not user spot coordinates. MFWAM returned null swell peak periods; they remain null. Remote Supabase sample persistence, refresh RPC, RLS and delete cascade still require runtime verification after manual migration.

Sources: [official Marine docs](https://open-meteo.com/en/docs/marine-weather-api), [official endpoint controller](https://github.com/open-meteo/open-meteo/blob/main/Sources/App/Controllers/ForecastapiController.swift).

## Phase 4.1 Input Improvements

Spot autocomplete searches only the signed-in user's loaded spots, ranking exact names before prefixes and substring/region matches. Existing selections reuse the original ID and coordinates. New names are created on session form submission only. Normalized exact names are reused; ambiguous duplicate names require selecting the region-specific option. Concurrent creation in separate tabs can still create duplicates because no new database uniqueness constraint was added.

Surfboard suggestions come from the user's session history; whitespace and case-equivalent names are consolidated on submission and filtering without rewriting old records. List view supports board filtering and board-name sorting (newest first within each board).

Each optional rating has an explicit enable checkbox, a native 1–5 slider and a visible value. Unchecking saves null; merely opening the form never assigns a score. Performance rating is absent from the UI and write payload, preserving existing database values. Date/time labels omit the timezone text but still use Asia/Seoul.

The pure suggestion module accepts spot-shaped records and is separate from the input component. Future Kakao search should use a separate provider adapter and explicitly confirmed selection before saving coordinates; do not mix public search results with private user spots implicitly. Open-Meteo integration should follow coordinate verification and define hourly timezone/unit handling and missing-data behavior first. No external provider or credential is included here.

## Phase 4 Journal UI

After Kakao login, the main screen shows a monthly calendar or a reverse-chronological list. The chosen view is remembered in localStorage. Both views share the same session data and spot filter. Select a date to see its records, or use Record Add to create a session and optionally a new named spot. Details support editing and confirmed deletion. My Account shows the nickname and logout.

All form dates/times and calendar grouping use Asia/Seoul. An explicit end date supports overnight sessions. Ratings are optional. Saving a new spot and saving a session are separate operations: if session saving fails, the created spot remains selected for retry. Coordinates are not invented.

UI verification: calendar/list switching, view persistence after refresh, and the input form were checked in the signed-in browser. Automated date tests cover Seoul midnight, leap years, and year navigation. Existing mocked CRUD tests pass; live create/update/delete were not performed during Phase 4 verification. Verify those with a disposable new record before relying on the workflow. Existing records were not changed.

## Phase 3 Verification Status

The local JavaScript suite includes a mocked CRUD workflow covering spot creation/read/update/delete, session creation/joined read/update/delete, ownership filters, and date boundaries. Run `npm test` with Node 22.12+; Node's experimental module mocking flag is used without extra dependencies. These tests do not contact Supabase and cannot prove that RLS or actual relationship embedding works.

The pgTAP suite is `supabase/tests/database/journal.test.sql`. It tests own CRUD, cross-user visibility/update/delete, foreign-spot attachment, owner reassignment, anonymous access, and constraints. All fixtures are in a transaction that rolls back. Run only against a local or disposable database:

```sh
npx supabase start
npx supabase migration up --local
npx supabase test db supabase/tests/database/journal.test.sql
```

Use the explicit test path: the other SQL files in `supabase/tests/` are manual SQL scripts, not pgTAP output. No `--linked` or remote database URL is needed. Local Docker/Supabase must be running.

Actual database security and authenticated service integration remain unverified until the pgTAP suite and the real CRUD procedure below run successfully. A successful migration or mocked test alone is not final Phase 3 sign-off. Remote test writes require separate approval, even when fixtures will be deleted afterward.

## Phase 3 Database

The migration `supabase/migrations/20261101000000_surf_journal.sql` creates:

- `surf_spots`: per-user named spots, optional region/country/coordinates, latitude -90..90 and longitude -180..180.
- `surf_sessions`: required spot, start and end timestamps, optional board data, independent overall/wave/performance ratings and crowd level (1..5). Crowd 1 means empty; 5 means very crowded. Board length is decimal feet, not feet/inches notation.

Both tables use UUID IDs, a required `auth.users.id` owner, and automatic created/updated timestamps. Start and end are required finite timestamps; end must be later than start. Multiple sessions on one date are allowed. A composite foreign key `(spot_id, user_id)` enforces spot ownership even independently of RLS. Delete a spot's sessions before deleting that spot. Account deletion cascades to its application records.

Both tables have separate authenticated SELECT/INSERT/UPDATE/DELETE RLS policies. UPDATE checks both the existing and new owner. Anonymous users have no table grants. Indexes support owner/name, owner/start-time, and spot relationship lookups. There are no profile, marine-data, or recommendation tables.

### Apply The Migration Manually

For CLI-managed deployment, prefer the following workflow instead of pasting SQL manually. The repository currently contains one migration, version `20261101000000`. Local files alone do not prove that it has been deployed. No CLI link or remote history has been verified.

Run from the repository root (Node/npm required; npx downloads the CLI without adding an app dependency):

```sh
cd /Volumes/GAYOMEE/wave-log
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Run `init` only if `supabase/config.toml` is absent. Enter credentials in the CLI prompts, not in tracked files. Inspect both migration history and the actual tables using `supabase/tests/inspect_schema.sql` in SQL Editor. A missing history entry does not prove the tables are absent: an earlier SQL Editor deployment would not have registered the migration.

If the tables are absent and the dry run lists only the intended pending migration, the following command changes the remote database. Run it only after explicitly deciding to approve deployment:

```sh
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

After success, `20261101000000` should appear in both Local and Remote history, and dry-run should report no pending migrations. Run `supabase/tests/inspect_schema.sql`: expect two tables with RLS enabled, eight policies scoped to authenticated, no anon/PUBLIC application-table privileges, the ownership composite FK, validation constraints, indexes and updated_at triggers. History alone does not verify schema or security.

If the migration was already pasted into SQL Editor, do not push it again. First compare the deployed schema, policies, grants, indexes and triggers against the complete migration. Only if they match exactly and you approve changing migration history, register it:

```sh
npx supabase migration repair 20261101000000 --status applied --linked
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

`repair` records history; it does not create or fix tables. If the schema differs, stop and prepare a corrective migration after reviewing the difference. Do not reset the remote database or mark an unverified migration applied.

For local database execution, install/start Docker and the PostgreSQL `psql` client. After `init`, use:

```sh
npx supabase start
npx supabase migration up --local
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -W -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql
```

Use the local database port/password from your local Supabase configuration. This plain SQL assertion script is not a pgTAP suite; invoke it via psql or SQL Editor, not `supabase test db`. It uses simulated claims and cannot replace testing CRUD with real Kakao sessions.

See the [official migration deployment guide](https://supabase.com/docs/guides/deployment/database-migrations).

Alternative SQL Editor deployment (does not register CLI migration history):

No remote migration is applied by the app or GitHub Pages deployment.

1. Open the intended Supabase project and verify the project reference. Prefer a test project first; review and back up any existing application schema.
2. Open SQL Editor > New query.
3. Paste the complete contents of `supabase/migrations/20261101000000_surf_journal.sql` and run it once. It is transactional and intentionally fails if these tables already exist; do not drop existing tables to rerun it.
4. Confirm both tables and eight policies in the dashboard. Ensure the public schema is exposed through the Data API. No additional frontend keys or provider settings are required.
5. Keep the migration in Git. If later adopting the Supabase CLI, reconcile its migration history for this manually applied migration before using `db push`.

### Verify Isolation

In a disposable Supabase project after migration, run `supabase/tests/isolation.sql` in SQL Editor as postgres. It creates two temporary test users and records inside a transaction, then switches to authenticated/anon roles. It checks cross-user reads/writes, owner reassignment, foreign-spot references, time/rating/coordinate constraints, same-date sessions, own writes, and deletion restrictions. Success ends with ROLLBACK, leaving no fixtures. If execution fails in an open SQL session, run ROLLBACK before continuing. Do not remove the role switches: postgres itself bypasses RLS.

Also verify with two real Kakao users in separate browser profiles: user B must not see user A's data, and attempts to use A's IDs must fail or return no rows. The SQL test uses simulated JWT claims; it does not test Kakao or the network API.

### CRUD Usage And Checks

`src/services/surfSpots.js` exports `listSpots()`, `createSpot(input)`, `updateSpot(id, patch)`, `deleteSpot(id)`.

`src/services/surfSessions.js` exports `listSessions(options)`, `getSession(id, options)`, `createSession(input)`, `updateSession(id, patch)`, `deleteSession(id)`.

Create/update input uses the database's snake_case field names. Owner/ID/audit fields are rejected; the current verified Supabase user supplies ownership. Functions return data or throw `DataAccessError` with `code` and `cause`. Missing or inaccessible single records throw; deletes return `{ id }`. A spot with sessions cannot be deleted.

Sessions include a nested `spot` by default; use `includeSpot: false` for list/get to omit it. Lists sort by start descending then ID descending. Session pagination defaults to `limit: 100, offset: 0`, with a maximum limit of 1000. Spot listing is subject to the project's Data API row cap.

Date filtering uses start time, from inclusive to exclusive, with explicit ISO offsets:

```js
await listSessions({
  from: '2026-11-01T00:00:00+09:00',
  to: '2026-11-02T00:00:00+09:00',
})
```

Timestamps are normalized to UTC. For future UI display use `Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })`; do not assume the browser's local timezone.

After migration, while signed in on the local Vite app, the browser console can import the modules and test actual CRUD:

```js
const spots = await import('/wave-log/src/services/surfSpots.js')
const sessions = await import('/wave-log/src/services/surfSessions.js')
const spot = await spots.createSpot({ name: 'My test spot' })
const session = await sessions.createSession({
  spot_id: spot.id,
  started_at: '2026-11-01T09:00:00+09:00',
  ended_at: '2026-11-01T10:00:00+09:00',
  wave_rating: 4,
})
await spots.listSpots()
await spots.updateSpot(spot.id, { region: 'Test' })
await sessions.listSessions()
await sessions.getSession(session.id)
await sessions.updateSession(session.id, { overall_rating: 5 })
await sessions.deleteSession(session.id)
await spots.deleteSpot(spot.id)
```

This intentionally writes test records to the configured project; use a test project. These source imports are development-only, not GitHub Pages URLs. `npm test` checks validation and error handling locally without a database. `npm run build` checks the frontend bundle. Neither command establishes remote database integration or RLS correctness; execute the SQL and authenticated CRUD checks separately.

Wave Log is a personal surfing journal. It will later support surf-session logging, marine conditions, spot-specific ratings, and personalized surf-condition recommendations.

## Getting Started

Install dependencies:

```sh
npm install
```

Create a local environment file:

```sh
cp .env.example .env.local
```

Set the Supabase values in `.env.local`:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Run locally:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

## Supabase Setup

Create a Supabase project, then copy these values from the project dashboard:

- `VITE_SUPABASE_URL`: Project URL from the Connect dialog or Integrations > Data API
- `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key from the Connect dialog or Settings > API Keys

Use only the publishable client key. Do not use a secret key or legacy service-role key in this frontend.

Enable Kakao-only authentication (existing configuration can be kept if it matches):

1. Open the Supabase dashboard for the project.
2. Go to Authentication > Sign In / Providers.
3. Enable Kakao with the Kakao REST API key as Client ID and the Client Secret. Keep these credentials only in Supabase, never in Vite variables.
4. Enable **Allow users without an email** in the Kakao provider settings.
5. Disable the Email provider and any other enabled providers if the project must enforce Kakao-only login. Removing email UI alone does not disable server-side password authentication.

In Kakao Developers, enable Kakao Login and the nickname consent item (`profile_nickname`). This app requests only nickname, not email. Register the Supabase callback URL shown in the provider settings: `https://<project-ref>.supabase.co/auth/v1/callback`. This callback is the same for local frontend development and GitHub Pages when using the hosted Supabase project.

Configure auth URLs:

1. Go to Authentication > URL Configuration.
2. Set Site URL to the GitHub Pages URL, for example `https://<github-user>.github.io/wave-log/`.
3. Add `http://localhost:5173/wave-log/` to Redirect URLs for local development.
4. Add the GitHub Pages URL, for example `https://<github-user>.github.io/wave-log/`, to Redirect URLs.
5. Also add `http://127.0.0.1:5173/wave-log/` if opening the local app with that hostname. If Vite chooses another port, allow that exact URL as well.

For GitHub Pages deployment, add repository secrets in GitHub:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The GitHub Actions workflow passes these values to `npm run build` so Vite can include them in the deployed static app.

## Authentication And Testing

The single Kakao button calls Supabase OAuth and returns to the current origin plus Vite's base path. The existing Supabase browser client processes the callback, persists the session, and refreshes tokens. No callback route or GitHub Pages rewrite is needed.

The auth context restores the session, subscribes to auth changes, and displays callback or session errors. A nickname is shown when available; otherwise the display name is "서퍼". For future database records use `useAuth().userId` (Supabase `auth.users.id`), never nickname, email, or Kakao's provider ID.

1. Preserve any existing `.env.local`; only create one from the example if it is absent. Run `npm run dev` and open the printed URL with `/wave-log/`.
2. Select "카카오로 시작하기", complete Kakao consent, and verify the main screen and nickname (or fallback).
3. Refresh to check session persistence, then log out to return to the login screen.
4. Cancel a new Kakao login to verify the error and retry path. Test an account without email consent too.
5. Push to `main` after configuring the existing GitHub Actions secrets. Repeat the same checks on `https://<github-user>.github.io/wave-log/`.

Real OAuth verification requires a Kakao account and the dashboard settings above. Existing email sessions are not automatically revoked by this frontend change.

Reference: [Supabase Kakao setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao).

## Missing Login Configuration

The client and GitHub Actions both use `VITE_SUPABASE_PUBLISHABLE_KEY`. Configure the repository secret with this exact name; `.env.local` is not available to GitHub Actions. The old `VITE_SUPABASE_ANON_KEY` variable is no longer read.

The message "현재 로그인 서비스를 사용할 수 없습니다." means the Supabase client was not created because the URL or client key is missing. It is not a session-expiration error. Vite does not load `.env.example` automatically, and GitHub Actions secrets are not downloaded to your local machine.

Create `.env.local` only if absent, using the example's exact variable names: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Fill them with your own project URL and publishable key locally. Do not use a service-role key. Restart the Vite server after changing the file, then reload the page.

For GitHub Pages, set the two repository Actions secrets and run the deployment again. Vite embeds these values at build time; refreshing an old deployment cannot update them. The workflow now refuses to deploy when either value is empty. A local build can still succeed without credentials, but authentication will be unavailable.
