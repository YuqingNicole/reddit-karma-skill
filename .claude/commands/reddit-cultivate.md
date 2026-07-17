---
description: Run a Reddit cultivation session (karma → inbox → opportunities → draft → post)
argument-hint: "[subreddit or focus, optional]"
---

Run a Reddit cultivation session using the `reddit-karma` MCP server (or
`cli/reddit_cli.py` if MCP is unavailable). Follow `skills/reddit-cultivate.md`
for persona/voice and `AGENTS.md` for the operating rules.

Focus for this session (optional): $ARGUMENTS

Steps:
1. `reddit_karma` — report account name and current karma.
2. `reddit_inbox` — surface comment replies worth answering; propose short,
   genuine replies for any with score > 1 or a real question.
3. `reddit_suggest` (or `reddit_scan` if a specific sub was given above) —
   present the top opportunities as a table.
4. For each sub you'll comment in, run `reddit_rules` and skip it if
   `restrict_commenting` is true.
5. Draft each comment fresh — 2–4 sentences, specific, no self-promotion, no
   emojis, matched to the sub persona. Never reuse text across subs.
6. **Show me every draft and wait for my approval.** Only then call
   `reddit_comment` with `confirm: true`, spacing posts out.
7. End with a summary table: sub, post title, and the direct comment link.

Respect the daily limit (max 15 comments) — stop early if we hit it.
