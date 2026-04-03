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
