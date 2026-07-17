---
name: reddit-karma-skill
description: Build and maintain Reddit presence for indie developers. Covers account cultivation (finding hot posts and posting comments via AppleScript Chrome control), product promotion (post templates, subreddit selection, timing strategy), and performance tracking (karma stats, subreddit ROI analysis). Use when user mentions "reddit", "karma", "post to reddit", "reddit promotion", "/reddit-cultivate", "check my reddit", "reddit maintenance", "find reddit opportunities", "build reddit karma", "share on reddit", "submit to subreddit".
---

# Reddit Karma Skill Pack

Three skills for building Reddit presence without API tokens or detectable automation.

## Skills

| Skill | Trigger | File |
|-------|---------|------|
| **browser-control** | (shared layer, load when doing any browser automation) | [skills/browser-control.md](skills/browser-control.md) |
| **reddit-cultivate** | `/reddit-cultivate`, "check my reddit", "find reddit opportunities" | [skills/reddit-cultivate.md](skills/reddit-cultivate.md) |
| **reddit-post** | "post to reddit", "share on reddit", "reddit post" | [skills/reddit-post.md](skills/reddit-post.md) |
| **reddit-performance** | "reddit performance", "subreddit ROI", "karma analysis" | [skills/reddit-performance.md](skills/reddit-performance.md) |

## How It Works

```
Claude Code → osascript (browser-control.md) → Chrome (real browser, logged in) → Reddit
```

AppleScript controls the user's real Chrome — undetectable by Reddit's anti-bot systems. Browser operations are in `browser-control.md` (shared across all skills). Reddit-specific logic lives in each skill file.

## Backend CLI

For scripted or repeatable operations, the same logic is packaged as a command-line tool: [`cli/reddit_cli.py`](cli/reddit_cli.py) (see [cli/README.md](cli/README.md)). It uses the identical AppleScript → Chrome engine, adds shared rate limiting and a dry-run gate on writes, and needs no API tokens or dependencies (Python 3 stdlib, macOS only).

```bash
reddit-cli karma                                  # login check + karma
reddit-cli scan AskReddit --sort rising --limit 10
reddit-cli rules AskReddit                        # posting restrictions
reddit-cli comment t3_POSTID "your comment" --yes
reddit-cli post SideProject --title "..." --text "..." --yes
reddit-cli inbox                                  # reply notifications
reddit-cli roi --limit 100                        # subreddit ROI review
```

Prefer the CLI when you want one deterministic command instead of hand-assembling `osascript` calls; fall back to the raw `browser-control.md` methods for anything the CLI doesn't cover.

## Rate Limits (Cross-Skill)

Track daily usage across all three skills to avoid triggering Reddit spam detection:

| Limit | Value |
|-------|-------|
| Comments per session | Max 5 |
| Comments per day | 10–15 max |
| Between API calls | 2+ seconds |
| Between posts | 4+ seconds |
| Cross-subreddit posts | 1 per day max |

## Account Status

- **Account:** YOUR_REDDIT_USERNAME
- **Target:** 1,000 karma
- Check current karma by running Step 1 of `reddit-cultivate`.
