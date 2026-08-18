# Salma Notes — Feature & Change Log

Every feature or change to this app gets an entry here, in the same session
it's made — see the standing rule in `CLAUDE.md`. Each entry has a
**Business** view (what it means for the two people using the site) and a
**Technical** view (what changed under the hood, for whoever picks this up
next). Newest entries on top.

---

## 2026-08-18 — Links page (topics of titled, clickable links)

**Business**: A brand new second page, "Links" (tab next to "Notes" in the
top bar) — the first of the "more pages later" the site was meant to grow
into. Create a topic (e.g. "Wedding planning"), then add as many links to
it as you want, each with its own title so it's clear what it is. Links
are clickable, open in a new tab, and you can have as many topics as you
need, each with its own list.

**Technical**: Two new tables, `topics` and `links` (`links.topic_id` FK,
cascade-deleted with the topic in `links.py::delete_topic`) — brand new
tables so no `ALTER TABLE` migration was needed, unlike the `notes.parent_id`
change. New endpoints: `GET/POST /api/topics`, `DELETE /api/topics/{id}`,
`POST /api/topics/{id}/links`, `DELETE /api/links/{id}`. URLs typed without
a scheme get `https://` prepended server-side (`main.py::_normalize_url`)
so they're always genuinely clickable. Frontend: since there are now two
real pages, pulled the shared top bar out of `Notes.jsx` into a new
`Layout.jsx` (rendered via `react-router-dom`'s nested routes + `<Outlet />`)
with a `Notes`/`Links` nav pill; `Notes.jsx` now renders only its own
content. New `Links.jsx` page and matching `.topic-*`/`.link-*` CSS.

## 2026-08-18 — Threaded replies on notes

**Business**: Any note can now become a back-and-forth conversation. Open
a note and hit "Reply" — replies show nested under it, in order, each with
their own name and timestamp, so a topic like "what time for dinner?" can
be worked out in place instead of needing a separate note per message.
Only top-level notes carry the note/reminder/done status; replies are just
messages in that note's thread. Replies can be deleted individually.

**Technical**: Added nullable `parent_id` column to `notes` (self-referencing
FK), migrated in `db.py::apply_migrations()` via `ALTER TABLE` for
already-existing databases (production had 2 rows before this). API:
`POST /api/notes` accepts `parent_id`; server rejects replying to a reply
(400) or to a nonexistent note (404), and forces `kind='note'`/`remind_at=null`
on replies. Deleting a top-level note cascades to delete its replies
(`notes.py::delete_note`). Frontend: extracted the note list item into
`NoteThread.jsx` (was inline in `Notes.jsx`), which renders the parent note,
its replies (grouped client-side via `repliesByParent` in `Notes.jsx`), and
an inline reply composer. Filters/counts on the main list now only consider
top-level notes. Shared `colorFor` helper moved to `colorFor.js` since both
`Notes.jsx` and `NoteThread.jsx` need it now.

## 2026-08-18 — Show/hide toggle on password fields

**Business**: Every password field (login, and all three fields in the
change-password box) now has a "Show"/"Hide" button so you can check what
you typed before submitting, instead of typing blind.

**Technical**: New shared `PasswordField.jsx` component (input + toggle
button, local `visible` state flips `type` between `password`/`text`).
Replaces the raw `<input type="password">` in `Login.jsx` and
`PasswordModal.jsx`. New `.password-field` / `.password-toggle` CSS rules.

## 2026-08-18 — Change password from inside the site

**Business**: There's now a settings (⚙) button next to logout where either
person can change the shared login password themselves, without needing
Claude/a developer to do it via the server. Changing it tells you to let
your friend know, since it's one shared password for both of you.

**Technical**: Password moved from being a plain env-var comparison to a
salted PBKDF2 hash stored in a new `settings` key/value table in the
SQLite DB (`src/settings.py`). `APP_PASSWORD` env var is now only a
bootstrap default, seeded into the DB on first startup if no hash exists
yet — it stops mattering after the first password change. New endpoint
`PUT /api/auth/password` (session-required, rate-limited, verifies current
password before accepting a new one, min 4 chars). Frontend:
`PasswordModal.jsx`, opened from a new gear icon in the top bar.

## 2026-08-18 — Initial launch: shared notes + reminders

**Business**: A private, two-person notepad at salma.bode1.site. Either
person logs in with one shared password, picks their name once per device,
and can leave notes or dated reminders for the other to see — meant to
replace "I'll tell you later" conversations that take forever on a call.
Filter by Open / Reminders / All / Done; mark things done or delete them.

**Technical**: FastAPI + aiosqlite backend, React 19 + Vite frontend, no
per-user accounts (JWT session cookie shared by both people; `author` is a
free-text field chosen from `NAMES` env var and remembered in
localStorage). Deployed via Coolify on the same EC2 box as perfume-erp
(`13.62.25.23`), public GitHub repo `AbdallahYasser/salma-notes`, DNS via
Cloudflare. Design: Fraunces + Inter, warm terracotta palette, light/dark
aware. Full deploy details in `migration-secrets.local.md` (gitignored).

---

## Planned / not built yet

- More pages beyond notes (mentioned as a "maybe later, like the perfume
  site" — no concrete spec yet, add one here once there is).
- Auto-deploy on push (GitHub webhook → Coolify) — currently every change
  needs a manual redeploy call.
