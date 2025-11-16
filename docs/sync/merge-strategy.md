# Google Drive Merge Strategy

This document describes the merge-based multi-device sync for Goaly.

## Overview

- Automatic background sync runs periodically and after local changes (debounced).
- Sync uses a three-way merge when possible: base (last successful sync), local (current browser), remote (Google Drive).
- Conflicts are resolved with a latest-edit-wins policy based on `goal.lastUpdated`. Histories are merged to preserve audit trail.

## Data Compared

- Version (`version`) must match the current `GOAL_FILE_VERSION`; older payloads are migrated before merge.
- Goal identity (`id`) is the stable key across devices.
- Timestamps: `createdAt`, `lastUpdated`.
- Modification history (`history`) is merged by unique `history.id` and sorted by `timestamp`.

## Algorithm

1. Load `base` from `localStorage: goaly_gdrive_last_sync` if available.
2. Download `remote` payload from Google Drive if it exists.
3. Build `local` from the in-memory app state via export.
4. Migrate any of the three to the current version before merging.
5. For each goal `id` across all three sets:
   - If present in only one side, include that goal.
   - If present in multiple:
     - If a side equals `base`, take the other side’s version.
     - Else, pick the one with the newer `lastUpdated` (tie-breaker by `createdAt`).
   - Merge `history` entries from all sides; sort by `timestamp`; cap to history limit.
6. Settings are taken from the payload with the newer `exportDate` as a simple strategy.
7. Apply merged payload locally, then upload merged to Drive to converge all devices.
8. Persist the merged payload as the new `base` for the next sync.

## Offline and Consistency

- If offline or Drive returns errors, local changes remain and the next sync will merge once online.
- If the Drive file does not exist, the merged upload creates it.

## Performance Notes

- Sync is debounced (5s) after saves and runs every 2 minutes in the background when authenticated.
- The payload size is small; multipart uploads and Drive revisions are used for reliability.

## Future Improvements

- Field-level merges using per-field timestamps derived from history.
- Optional conflict resolution UI.
- Adaptive sync intervals and backoff on repeated failures.


