---
description: Scan target subreddits and rank comment opportunities right now
argument-hint: "[comma-separated subs, optional]"
---

Find the best Reddit comment opportunities available right now.

Target subs (optional; default = high-ROI set): $ARGUMENTS

1. Call `reddit_suggest` (pass `subreddits` if I named any above). If MCP is
   unavailable, run `cli/reddit_cli.py suggest --subs "$ARGUMENTS"`.
2. Present the ranked opportunities as a table: sub, opportunity score, score,
   comments, age, and title — highest opportunity first.
3. For the top 3–5, briefly note the angle I could take per the sub's persona
   in `skills/reddit-cultivate.md` (do not draft full comments yet).
4. Do not post anything. This command is read-only scouting.
