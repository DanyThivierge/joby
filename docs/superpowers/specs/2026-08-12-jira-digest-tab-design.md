# Jira Digest tab — design

## Problem

Jira sends comment/mention/watch notifications (via Slack and via Jira's own
notification center), but neither surface organizes them: no per-initiative
grouping, no ordering, no way to mark an item as reviewed/in-progress/waiting
on someone, no persistent history. An Outlook rule used to fill this gap
(filter/search/"show me this thread") but that workflow is broken with no fix
planned.

Two earlier attempts didn't solve it:
- A Jira → Google Doc digest: unorganized, no history.
- Joby's existing Jira tab: pulls *assigned issues* into the task list well,
  but doesn't do comment-level triage (mentions, watch activity, "what does
  this person want from me").

## Goal

A new tab inside Joby (Task Organizer) — not a separate app — that turns
Jira comment/mention/watch activity into a triaged, organized inbox:
grouped by initiative, bucketed by what's being asked (Review / Fix-Help /
FYI), with a status you can track (To Do / In Progress / Waiting on someone /
Done), full thread context per issue, and image attachments visible inline.

Chosen as a new tab (not a standalone app) because people are already using
Joby day-to-day; a new tab doesn't disrupt that. It can be split out or
merged more tightly later if it proves useful.

## Data source

Reuses the existing `jira-proxy.py` local proxy (cookie-based, already
solves Jira's CORS/SSO restrictions — see `jira.js` / README "Jira Setup").
No new auth mechanism, no API token.

Query strategy: fetch issues where the user is assignee, watcher, or
mentioned, filtered to `updated >= lastPolled`; then fetch each such issue's
comments added/edited since `lastPolled`. A comment is flagged `mentionsMe`
when the user's Jira mention markup appears in the body.

## Data model

New OPFS file, separate from `work-tasks.json` / `personal-tasks.json`:
`jira-digest.json`, holding a `lastPolled` timestamp and a keyed map of
digest items:

```json
{
  "lastPolled": "2026-08-12T13:00:00Z",
  "items": {
    "12345": {
      "commentId": "12345",
      "issueKey": "HBMADJ-123",
      "issueSummary": "...",
      "epicKey": "HBMADJ-100",
      "epicName": "Plan Override Manager",
      "author": "Jane Doe",
      "body": "...",
      "created": "2026-08-12T12:55:00Z",
      "bucket": "review",
      "bucketAuto": true,
      "status": "todo",
      "waitingOn": null,
      "attachments": [
        { "filename": "screenshot.png", "isImage": true, "url": "..." }
      ],
      "mentionsMe": true
    }
  }
}
```

`epicName` falls back to the issue's Project name when the issue has no
epic. `bucketAuto` flips to `false` the moment a user manually overrides the
bucket, so future polls don't re-guess it.

## Auto-classification (heuristic, overridable)

- `mentionsMe` + phrasing like "review / thoughts / can you check" →
  **Review**
- `mentionsMe` + phrasing like "can you fix / help / look into" →
  **Fix/Help**
- Everything else (watcher activity with no direct ask) → **FYI**

Classification runs once per new comment. Clicking a bucket pill on any item
overrides it directly — no drag-and-drop needed. No LLM call; this is a
plain keyword/phrase heuristic, consistent with the rest of Joby being a
zero-dependency, client-side app.

## Grouping & ordering

Items group by `epicName`, most-recently-active group first. Within a
group, newest comment first. Clicking an item expands the full comment
thread for that issue (restores the "show me this thread" behavior from the
old Outlook workflow).

## Status workflow

Each item carries one of: **To Do**, **In Progress**, **Waiting on
\_\_\_** (free-text name), **Done**. Done items collapse out of the default
view but are never deleted — they stay queryable, which is the "no history"
gap the old Google-Doc digest had.

## Attachments

- Image attachments render as inline thumbnails, fetched through the proxy
  (which already forwards the user's session cookie) — click for full size.
- Non-image attachments show as a filename link that opens the attachment
  directly in Jira in a new tab (relies on the browser's existing Jira SSO
  session — no binary download/streaming through the proxy needed for
  documents).

## Refresh

- Auto-poll every 20 minutes while the tab is open.
- Manual refresh button, same pattern as the existing Jira tab.
- First poll of a session pulls everything since the last recorded
  `lastPolled` (covers overnight/weekend activity, i.e. "since last
  login").

**Explicitly out of scope for v1:** debouncing right after a new comment
appears (waiting a few minutes in case it's edited/deleted before showing
it) and priority-boosting for detected follow-ups. Real refinements, but
they add real complexity (debounce windows, re-classification on edit) for
an unproven first version. Revisit once the basic loop is running.

## Testing

Joby has no existing automated test setup; this follows the same pattern.
Verification is manual against real issues:
- Classification buckets and epic grouping look right on real comment data.
- Image thumbnails render; document links open in Jira.
- Status and bucket-override persist across a page reload (OPFS
  round-trip).
- Poll correctly picks up only what changed since `lastPolled` (no
  duplicate items, no missed comments across a 20-minute gap).

## Non-goals (v1)

- No Slack ingestion — Jira is the source of truth; Slack is a lossy relay
  of the same data and adds a second auth/data path for no new information.
- No AI-based classification — heuristic is cheap, explainable, and fully
  client-side; can be revisited if the heuristic's hit rate proves poor in
  practice.
- No merging into the main task list — a "promote to Joby task" action is a
  plausible future addition, not part of this pass.
