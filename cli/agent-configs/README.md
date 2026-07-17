# Agent MCP registration snippets

Copy the snippet for your agent, **replace `/ABS/PATH/...` with the real
absolute path** to `cli/reddit_mcp.py`, and merge it into that agent's config.
All of them point at the same server — it's a standard MCP stdio server, so
every MCP-capable client uses it the same way.

| Agent | Config file | Snippet | Verify |
|-------|-------------|---------|--------|
| **Claude Code** | `.mcp.json` (repo root, already committed) | — auto-loaded — | `claude mcp list` |
| **Codex** | `~/.codex/config.toml` | [`codex.config.toml`](codex.config.toml) | restart Codex |
| **OpenClaw** | `~/.openclaw/openclaw.json` | [`openclaw.json`](openclaw.json) | `openclaw mcp doctor reddit-karma --probe` |
| **Hermes** | `~/.hermes/config.yaml` | [`hermes.config.yaml`](hermes.config.yaml) | `hermes mcp test reddit-karma` |

Claude Code can also register globally instead of via the committed
`.mcp.json`:

```bash
claude mcp add reddit-karma -- python3 /ABS/PATH/reddit-karma-skill/cli/reddit_mcp.py
```

Any other MCP client: register the stdio command
`python3 /ABS/PATH/reddit-karma-skill/cli/reddit_mcp.py`.

After registering, the agent gets 10 tools: `reddit_karma`, `reddit_profile`,
`reddit_scan`, `reddit_suggest`, `reddit_rules`, `reddit_top_comments`,
`reddit_inbox`, `reddit_roi`, `reddit_comment`, `reddit_post`. The two write
tools do nothing until called with `"confirm": true`.

> Field names for OpenClaw/Hermes reflect their published docs; if your version
> differs, check that agent's own MCP guide — only the file format changes, the
> `python3 … reddit_mcp.py` command stays the same.
