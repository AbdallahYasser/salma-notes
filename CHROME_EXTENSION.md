# Using the Claude in Chrome extension (Brave) from Claude Code

How to get a Claude Code session to actually drive your Brave browser — and
what to do when a session says it can't. Written after diagnosing exactly
that on 2026-08-22.

This is what let earlier sessions create the Cloudflare DNS record for
`salma.bode1.site`, run the GitHub device-login, and screenshot this app
while testing it.

---

## 1. The short version

Two different failures look identical from inside a session ("I can't use
the browser"). Tell them apart first — ask the session to run `ToolSearch`
for `mcp__claude-in-chrome__tabs_context_mcp`:

- **Returns the tool** → the tools were just deferred. Say
  `Use the claude-in-chrome skill` and it will load them. Done.
- **Returns nothing, and `claude-in-chrome` isn't in its skill list** →
  the integration isn't registered for that session at all. No prompt can
  fix this from inside; see §3.

The second case is what happened here on 2026-08-22, and the cause was a
**version mismatch** — see below.

---

## 2. How it's actually wired (verified on this machine)

It is **not** a normal MCP server. `mcpServers` is empty everywhere —
top-level in `~/.claude.json`, and in the per-project config for both
`Downloads/projects` and `Downloads/projects/salma-notes`. Nothing is
project-scoped, so there is nothing to copy between folders.

Instead it's a built-in integration with three moving parts:

| Part | Where | Current state |
|---|---|---|
| The extension | Installed in Brave | `cachedChromeExtensionInstalled: true` |
| The pairing | `~/.claude.json` → `chromeExtension` | Paired to `"Browser 1"`, deviceId `539e2e45-…` |
| The native host | `~/.claude/chrome/chrome-native-host` | Shell wrapper that execs the Claude binary with `--chrome-native-host` |

The pairing is **account-level, not per-folder and not per-terminal**.
`list_connected_browsers` reports the browser as connected "to this
account", `isLocal: true`. So any session on this machine can reach it —
which is exactly why a folder-specific fix isn't the answer.

---

## 3. Why a new session can't access it — the version mismatch

**A Claude Code auto-update silently breaks the browser bridge.**

The wrapper at `~/.claude/chrome/chrome-native-host` execs a *pinned,
hardcoded* version path. When Claude Code auto-updates, the CLI moves on
but that wrapper keeps pointing at the old binary:

```
CLI in PATH now:      2.1.239   (auto-updated 2026-08-21 23:53)
Native host execs:    2.1.234   (wrapper last written 2026-08-18)
```

Any session started after the update runs 2.1.239, while the bridge the
Brave extension talks through still launches 2.1.234 — so the integration
never registers for that session. The skill is absent and `ToolSearch`
finds nothing, because there is genuinely nothing to find. That matches
the symptom exactly: not deferred-and-hidden, just not there.

Sessions started *before* the update keep working, because they already
established their connection against the matching version. That's why one
terminal can be driving Brave happily while a brand-new one insists it has
no browser access — the confusing part, and the reason this is easy to
misdiagnose as a per-folder or permissions problem. It is neither.

**Fix — repoint the wrapper at the version-stable launcher** so it can't
drift again on the next auto-update:

```sh
cp ~/.claude/chrome/chrome-native-host ~/.claude/chrome/chrome-native-host.bak
cat > ~/.claude/chrome/chrome-native-host <<'EOF'
#!/bin/sh
# Chrome native host wrapper script
exec "$HOME/.local/bin/claude" --chrome-native-host
EOF
chmod +x ~/.claude/chrome/chrome-native-host
```

Then fully quit and reopen Brave (the extension only reads the manifest on
browser start), and start a fresh Claude session.

> **Status on this machine (2026-08-22): applied and confirmed working.**
> `~/.local/bin/claude` is a symlink the updater repoints on every release,
> so the wrapper above resolves to whatever is current instead of a
> version frozen at write-time — this should survive future auto-updates
> without needing to be reapplied. Original backed up to
> `~/.claude/chrome/chrome-native-host.bak` — restore with
> `cp ~/.claude/chrome/chrome-native-host.bak ~/.claude/chrome/chrome-native-host`
> if this ever regresses.

The file is marked "do not edit manually" because Claude Code regenerates
it — the supported alternative is re-running the Chrome setup/onboarding
from a session, which rewrites it with the current version. Either works;
the launcher-path version above just doesn't need redoing every update.

Other causes worth ruling out if the versions already match:

1. **Brave isn't running**, or the extension is disabled in it.
2. **Started with `--no-chrome`.** Default-on here via
   `claudeInChromeDefaultEnabled: true`, so only if something set it.
3. **Site permission not granted** — the extension asks per-site the first
   time it acts on a new domain.
4. **A sensitive click is being blocked**, which is not the same as "no
   access" — see §5.

---

## 4. Driving it from a session

Once the tools are loaded, the normal sequence is:

```
tabs_context_mcp  { createIfEmpty: true }   → always call this first; returns tab IDs
navigate          { tabId, url }
computer          { action: "screenshot", tabId }
read_page         { tabId, filter: "interactive" }   → element refs for reliable clicking
computer          { action: "left_click", ref: "ref_3", tabId }
tabs_close_mcp    { tabId }                 → clean up when done
```

Two things that make this much less painful in practice:

- **Prefer `ref` over coordinates.** `read_page` with
  `filter: "interactive"` returns stable refs like `ref_12`. Clicking by
  ref survives the page reflowing between your screenshot and your click;
  clicking by pixel coordinates often doesn't.
- **Batch with `browser_batch`.** Multiple actions in one round trip is
  dramatically faster than one call each. Coordinates inside a batch refer
  to the screenshot taken *before* the batch ran.

It uses your real Brave session, so you're already logged into whatever
you're logged into — that's the whole reason it can reach Cloudflare and
GitHub without any API token.

---

## 5. Known limits (hit while building this app)

These are real and will come up again; they are not misconfiguration.

- **Some clicks silently don't take.** GitHub's final "Authorize" button
  on the OAuth device-flow screen would not respond to automated clicks —
  most likely bot protection on that specific action. A human had to click
  it. If a button visibly does nothing after two honest attempts, hand it
  to the user rather than burning attempts.
- **The permission classifier blocks some actions outright.** Auth flows
  and anything resembling a production deploy can be refused regardless of
  how the request is phrased. The fix is switching the session's
  permission mode (Shift+Tab), not a different tool call. See
  `../perfume-erp/DEPLOY_GUIDE.md` §3.12 for the same problem on the
  deploy side.
- **The window will not resize below roughly 555px CSS width.**
  `resize_window` accepts smaller numbers and reports success, but the
  viewport stays at ~555px. True phone widths (iPhone 11 is 414px) can't
  be rendered live — verify narrower layouts by calculation and treat
  555px as the narrowest thing you can actually see. This is why the
  mobile fix in `FEATURES.md` was part measured, part computed.
- **Never trigger `alert()` / `confirm()` / `prompt()`.** A native modal
  blocks every subsequent extension command and the session goes deaf
  until someone dismisses it by hand.

---

## 6. If it's genuinely not connected

Check the live state from any session:

```
list_connected_browsers      → should return your browser, isLocal: true
```

Empty result means the browser side is down, not the Claude side. Then:

1. Make sure Brave is open and the Claude extension is enabled in it.
2. Re-pair if needed: `switch_browser` broadcasts a confirmation prompt to
   every connected extension and waits for you to click **Connect** in the
   one you want (it also lets you rename it).
3. If several browsers are connected, `select_browser { deviceId }` picks
   one without broadcasting.

---

## 7. Quick reference

| Symptom | Most likely cause | Fix |
|---|---|---|
| "I can't access the browser", but `ToolSearch` *does* find the tools | Deferred tools never loaded | `Use the claude-in-chrome skill` |
| `ToolSearch` finds nothing **and** no `claude-in-chrome` skill | Native-host version drift after an auto-update | Repoint the wrapper (§3), restart Brave |
| Worked yesterday, broken in new sessions today | Claude Code auto-updated overnight | Same as above — compare `claude --version` against the path inside `~/.claude/chrome/chrome-native-host` |
| `list_connected_browsers` returns `[]` | Brave closed / extension off | Open Brave, enable extension, `switch_browser` |
| Page loads but clicks do nothing | Site permission not granted | Approve the site in the extension |
| One specific button won't respond | Bot protection on that action | Ask the user to click it |
| Action refused with a permission message | Classifier block | Switch permission mode (Shift+Tab) |
| Layout won't render at phone width | ~555px floor | Verify by calculation below that |
