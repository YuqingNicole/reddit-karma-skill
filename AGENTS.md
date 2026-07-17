# AGENTS.md

Guidance for AI coding agents (Codex, Claude Code, and any MCP-capable client)
working in this repository.

## What this repo is

A skill pack for building and maintaining a single Reddit account's presence.
The strategy lives in Markdown under `skills/`; the runnable backend lives in
`cli/`:

- `cli/reddit_cli.py` — command-line tool
- `cli/reddit_mcp.py` — MCP server exposing the same operations as tools

Both drive the user's **real, logged-in Chrome via AppleScript** (macOS only),
so requests use the existing session — no API tokens, no dependencies (Python 3
standard library), no Playwright/Selenium.

## Preferred interface: MCP

If you are an MCP-capable agent, use the **`reddit-karma` MCP server**
(`cli/reddit_mcp.py`) rather than shelling out. Tools:

| Tool | Purpose |
|------|---------|
| `reddit_karma` | account karma + login check |
| `reddit_profile` | joined subreddits (interest map) |
| `reddit_scan` | posts in a sub (filters: min_score, max_comments, max_age_hours) |
| `reddit_suggest` | ranked comment opportunities across several subs |
| `reddit_rules` | a sub's rules + posting restrictions |
| `reddit_top_comments` | a post's top comments (t1_ ids to reply to) |
| `reddit_inbox` | comment replies |
| `reddit_roi` | recent comment scores aggregated by sub |
| `reddit_comment` | post a comment (**needs `confirm: true`**) |
| `reddit_post` | submit a post (**needs `confirm: true`**) |

Ready-to-copy registration snippets for Claude Code, Codex, OpenClaw and Hermes
are in [`cli/agent-configs/`](cli/agent-configs/); the how-to is in
[`cli/README.md`](cli/README.md#agent-integration-mcp).

If you cannot use MCP, call the CLI instead — same operations, `--json` on all
read commands. See [`cli/README.md`](cli/README.md).

## Operating rules (important)

1. **Never post without an explicit confirm step.** Write tools return a
   *preview* until called with `confirm: true`; the CLI prints a preview and
   needs `--yes`. Show the user the preview and get agreement before confirming.
2. **Respect the rate limits.** Max 15 comments/day and 1 cross-subreddit
   post/day; the backend enforces this via `~/.reddit-cli/state.json` and will
   refuse over-limit writes. Do not try to route around it.
3. **Check `reddit_rules` before commenting in an unfamiliar sub.** Skip subs
   with `restrict_commenting: true` for new/low-karma accounts.
4. **Never duplicate text across subs.** Reddit down-ranks repeated content.
   The same *angle* can inspire multiple comments, but every comment must be
   written fresh. This is the one rule that most affects account health.
5. **Comments must add genuine value** — specific, 2–4 sentences, no
   self-promotion, matched to the sub's culture. See
   `skills/reddit-cultivate.md` for per-sub personas.
6. **macOS + Chrome required.** On other platforms the tools return a clear
   error; report it, don't retry.

## Typical session

1. `reddit_karma` — confirm login and current karma
2. `reddit_inbox` — reply to anything worth replying to first
3. `reddit_suggest` — get ranked opportunities (or `reddit_scan` a specific sub)
4. `reddit_rules` on any new target sub
5. Draft a genuine comment; show the user; on approval call `reddit_comment`
   with `confirm: true`
6. `reddit_roi` periodically to steer which subs are worth the effort

## Do not

- Do not commit secrets, cookies, or `~/.reddit-cli/state.json`.
- Do not mass-target, spam, or automate posting without a human in the loop.
- Do not edit the karma/history tables in `skills/` to fabricate progress.
