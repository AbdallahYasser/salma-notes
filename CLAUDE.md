# Salma Notes

A private, two-person shared notepad (notes + optional reminders). See
`FEATURES.md` for what exists and what's planned, and
`migration-secrets.local.md` (gitignored) for live deploy credentials.

## Rule: keep FEATURES.md current

Whenever you add a feature, change existing behavior, or fix something
user-visible in this project, add an entry to the top of `FEATURES.md` in
the same session as the change — don't defer it. Each entry needs:

- A dated heading.
- **Business**: what it means for the two people using the site, in plain
  language — no code or file names.
- **Technical**: what actually changed (files, endpoints, schema), terse
  enough for a future session to pick up from.

This is the standing record of the app's history from both a business and
technical view — treat it as required, not optional, for every change no
matter how small.
