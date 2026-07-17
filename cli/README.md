# reddit-cli — backend for the Reddit Karma Skill Pack

A single command-line tool that consolidates the JavaScript snippets scattered
across the skill docs (`reddit-cultivate`, `reddit-post`, `reddit-performance`)
into runnable commands. Same engine as [`browser-control.md`](../skills/browser-control.md):
it drives your **real, logged-in Chrome** through AppleScript, so every request
rides your existing session cookies and looks like ordinary browsing.

- **No API tokens** — uses the Chrome session you're already logged into
- **No dependencies** — Python 3 standard library only (macOS ships with it)
- **No Playwright/Selenium** — real Chrome, undetectable, same as the skills
- **Built-in rate limiting** — shared daily counters + inter-action spacing

## Requirements

- **macOS** (AppleScript is macOS-native)
- **Google Chrome**, logged into Reddit, with at least one open window
- Chrome → **View → Developer → Allow JavaScript from Apple Events** ✓
  (restart Chrome after enabling)

## Install

No install step. Run it directly, or symlink onto your `PATH`:

```bash
chmod +x cli/reddit_cli.py
ln -sf "$PWD/cli/reddit_cli.py" /usr/local/bin/reddit-cli
```

## Commands

| Command | What it does |
|---------|--------------|
| `karma` | Account name + total / comment / link karma (also a login check) |
| `scan <sub> [--sort rising\|hot\|new\|top] [--limit N]` | List posts with `t3_` ids, score, comment count, age |
| `rules <sub>` | Subreddit rules + `restrict_posting` / `restrict_commenting` flags |
| `top <sub> <post_id> [--limit N]` | Top comments of a post, with `t1_` ids to reply to |
| `comment <thing_id> <text> [--yes]` | Post a comment (`t3_` post or `t1_` comment) |
| `post <sub> --title T (--text B \| --url U) [--yes]` | Submit a text or link post |
| `inbox [--limit N]` | Comment replies in your inbox |
| `roi [--user U] [--limit N]` | Aggregate recent comment scores by subreddit |

Add `--json` to any read command (`karma`, `scan`, `rules`, `top`, `inbox`,
`roi`) for machine-readable output you can pipe into other tools.

## Examples

```bash
# Session start: confirm login + karma, then check replies
reddit-cli karma
reddit-cli inbox

# Find something to comment on
reddit-cli scan AskReddit --sort rising --limit 10
reddit-cli rules AskReddit                 # check restrictions before posting
reddit-cli top AskReddit 1saopui --limit 5 # pick a top comment to reply to

# Comment (dry-run preview + confirm; --yes to skip the prompt)
reddit-cli comment t3_1saopui "your genuine, specific take"
reddit-cli comment t1_odxcy8t "a reply that adds one more layer" --yes

# Submit a post (text or link)
reddit-cli post SideProject --title "I built X to solve Y" --text "Story..." --yes
reddit-cli post coolgithubprojects --title "X - does Y" --url https://github.com/a/b --yes

# Weekly ROI review
reddit-cli roi --limit 100
```

## Safety rails

- **Write commands preview first.** `comment` and `post` print what they're
  about to send and ask for confirmation. In a non-interactive shell they
  refuse unless you pass `--yes`.
- **Daily limits** (from `SKILL.md`): max **15 comments/day** and **1
  cross-subreddit post/day**. Counters live in `~/.reddit-cli/state.json` and
  reset at local midnight.
- **Inter-action spacing**: at least 2s between comments, 4s between posts —
  enforced automatically by sleeping before the write.

## How results come back

AppleScript can only read a tab's title synchronously, so each command runs an
async `fetch()` in the page and writes the result to `document.title` behind a
unique marker; the CLI polls the title, strips the marker, and parses the JSON
(see `browser-control.md` for the full rationale). Values injected into the
page (comment text, post titles/bodies) are JSON-encoded, so quotes, newlines
and apostrophes are handled without escaping headaches.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `osascript not found` | Not macOS — the AppleScript backend is macOS-only |
| `Chrome blocked the JavaScript` | Enable *Allow JavaScript from Apple Events*, restart Chrome |
| `Chrome has no scriptable window (0 windows)` | Open a normal Chrome window on your primary profile (multi-profile AppleScript bug) |
| `Timed out waiting for Reddit response` | Session expired (re-login in Chrome) or rate limited (wait ~5 min) |
| `not logged in` | Log into Reddit in Chrome first |

## Scope

This is single-account presence building with conservative, built-in rate
limits — the same conduct the skill docs describe. Keep comments genuine and
non-duplicated across subs (Reddit down-ranks repeated content); the CLI moves
the mechanics off manual `osascript` wrangling but the judgment about *what* to
post stays with you.
