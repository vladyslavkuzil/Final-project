# Database Relationships

This document describes the entity relationships in the schema, as of the
normalization pass in PR #31.

## Entity Overview

| Table | Purpose |
|---|---|
| `users` | Application accounts. |
| `projects` | A project workspace. |
| `project_membership` | Join table linking users to projects, with a role. |
| `join_codes` | Single active invite code per project. |
| `documents` | Files uploaded to a project. |
| `messages` | Chat messages posted to a project. |

## Relationships

### `users` ↔ `projects` (many-to-many, via `project_membership`)

A user can belong to many projects; a project can have many users. This is
resolved with a junction table rather than a direct FK on either side,
because the relationship itself carries data (`role`) that belongs to
neither `users` nor `projects` alone.

```
users (1) ──< project_membership >── (1) projects
                    │
                    └── role: OWNER | PARTICIPANT
```

- `project_membership.project_id → projects.id`, `ON DELETE CASCADE`
  (deleting a project removes its membership rows)
- `project_membership.user_id → users.id`, `ON DELETE CASCADE`
  (deleting a user removes their membership rows)
- `UNIQUE(project_id, user_id)` — a user can hold only one membership row
  per project.

**Ownership**: a project's owner is not stored on `projects` directly.
It is derived by querying `project_membership` for the row where
`role = OWNER`. This was changed in PR #31 — previously `projects.admin_id`
duplicated this fact, creating two sources of truth that could disagree.
Use `get_project_owner(db, project_id)` / `get_project_owner_id(db, project_id)`
in `projects/services.py` rather than reading a column.

### `projects` ↔ `join_codes` (one-to-one, enforced)

Each project has at most one active join code at a time.

```
projects (1) ──── (0..1) join_codes
```

- `join_codes.project_id → projects.id`, `ON DELETE CASCADE`
- `UNIQUE(project_id)` enforces the one-active-code-per-project rule at the
  database level.
- `join_codes.created_by → users.id` — the user who generated the code.
  No `ON DELETE` behavior specified (defaults to `RESTRICT`); a user with
  an active-code-creation record cannot currently be deleted while that
  code exists. Not addressed in this PR — flagged as a follow-up.

Note: a join code is an *invitation mechanism*, not a membership. It is
intentionally a separate table from `project_membership` rather than a
special role, since it has its own lifecycle (`expires_at`) independent of
who has actually joined.

### `projects` ↔ `documents` (one-to-many)

A project has many documents; a document belongs to exactly one project.

```
projects (1) ──< documents
```

- `documents.project_id → projects.id`, `ON DELETE CASCADE`
  (deleting a project deletes its documents)
- `documents.uploaded_by → users.id`, `ON DELETE SET NULL`
  (deleting a user does not delete the documents they uploaded; the
  attribution is cleared instead, preserving the file and its history)

This `ON DELETE SET NULL` choice (introduced in PR #31) was made after
weighing three options for what should happen to a document when its
uploader's account is deleted:
- `CASCADE` — rejected, since it would delete documents other project
  members may still depend on.
- `RESTRICT` (the previous, implicit default) — rejected as the permanent
  behavior, since it would block account deletion entirely for any user
  who has ever uploaded a file.
- `SET NULL` — adopted. The document and its history survive; only the
  attribution is lost. `documents.uploaded_by` is nullable to support this.

### `projects` ↔ `messages` (one-to-many)

A project has many chat messages; a message belongs to exactly one project.

```
projects (1) ──< messages
```

- `messages.project_id → projects.id`, `ON DELETE CASCADE` (migration
  `2131e43c0dda`, follow-up from PR #31 now resolved: deleting a project
  deletes its messages too, consistent with how `documents` behaves).

### `users` ↔ `messages` (one-to-many)

A user can send many messages; a message has exactly one sender.

```
users (1) ──< messages
```

- `messages.sender_id → users.id` — no `ON DELETE` behavior currently
  specified (defaults to `RESTRICT`/`NO ACTION`); a user who has ever sent a
  message cannot currently be deleted while that message exists. Unlike
  `documents.uploaded_by`, this hasn't been changed to `SET NULL` — still
  flagged as a follow-up.

## Denormalized fields (intentional, documented)

`projects.documents_count` and `projects.total_size_bytes` are **not**
raw facts — they are aggregates of `documents` (`COUNT(*)` and `SUM(size)`
respectively) that are cached directly on `projects` to avoid a join +
aggregate on every dashboard read. This is a deliberate normalization
trade-off for read performance, not an oversight.

**Resolved:** the service layer (`documents/services.py`) now increments
both fields on upload and decrements them on delete, in the same
transaction as the `Document` row change, so they stay in sync with the
real document set. (Previously tracked as a known gap, not fixed in
PR #31 — now fixed.)

## Summary of source-of-truth decisions

| Fact | Source of truth | Notes |
|---|---|---|
| Who owns a project | `project_membership.role = OWNER` | `projects.admin_id` removed in PR #31 — was a duplicate. |
| Who is a member of a project | `project_membership` rows | — |
| Who uploaded a document | `documents.uploaded_by` (nullable) | Cleared, not cascaded, on uploader deletion. |
| Project document count / size | `projects.documents_count` / `total_size_bytes` | Denormalized cache, actively maintained by `documents/services.py` on upload/delete. |
