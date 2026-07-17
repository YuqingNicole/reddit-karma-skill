#!/usr/bin/env python3
"""reddit-mcp — Model Context Protocol server for the Reddit Karma Skill Pack.

Exposes the same operations as reddit_cli.py (karma, scan, suggest, rules, top
comments, inbox, roi, comment, post) as MCP tools with JSON schemas, so any MCP
client — Claude Code, Codex, Cursor, etc. — can call them natively instead of
shelling out and parsing text.

Transport: newline-delimited JSON-RPC 2.0 over stdio (the MCP stdio transport).
Zero dependencies — Python 3 standard library only. Same Chrome/AppleScript
engine as the CLI (macOS only).

Safety: the write tools (reddit_comment, reddit_post) do nothing until called
with "confirm": true. Without it they return a preview — the MCP analogue of
the CLI's --yes gate — so an agent can't post to Reddit without an explicit,
separate confirmation step. Daily rate limits and inter-action spacing are
shared with the CLI via ~/.reddit-cli/state.json.

Register with Claude Code:
    claude mcp add reddit -- python3 /abs/path/cli/reddit_mcp.py
Register with Codex (~/.codex/config.toml):
    [mcp_servers.reddit]
    command = "python3"
    args = ["/abs/path/cli/reddit_mcp.py"]
"""

import importlib.util
import json
import os
import sys

# Import the CLI module (same directory) to reuse every reddit operation.
_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "reddit_cli", os.path.join(_HERE, "reddit_cli.py"))
rc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rc)

SERVER_NAME = "reddit-karma"
SERVER_VERSION = "1.0.0"
DEFAULT_PROTOCOL = "2024-11-05"


# --------------------------------------------------------------------------
# Tool implementations (return any JSON-serialisable Python object)
# --------------------------------------------------------------------------

def _tool_karma(a):
    me = rc.with_reddit_tab(rc.op_me)
    return {k: me[k] for k in ("name", "total", "comment", "link")}


def _tool_scan(a):
    posts = rc.with_reddit_tab(
        lambda: rc.op_scan(a["subreddit"], a.get("sort", "rising"),
                           int(a.get("limit", 10))))
    return rc.filter_posts(posts, a.get("min_score"),
                           a.get("max_comments"), a.get("max_age_hours"))


def _tool_profile(a):
    return rc.with_reddit_tab(rc.op_profile)


def _tool_suggest(a):
    subs = a.get("subreddits") or rc.TARGET_SUBS
    subs = [str(s).strip().lstrip("r/") for s in subs if str(s).strip()]
    results = rc.with_reddit_tab(
        lambda: rc.op_multiscan(subs, a.get("sort", "rising"),
                                int(a.get("per_sub_limit", 15))))
    return rc.rank_opportunities(
        results,
        a.get("min_score", 2), a.get("max_comments", 100),
        a.get("max_age_hours", 8.0), int(a.get("top", 15)))


def _tool_rules(a):
    return rc.with_reddit_tab(lambda: rc.op_rules(a["subreddit"]))


def _tool_top(a):
    return rc.with_reddit_tab(
        lambda: rc.op_top_comments(a["subreddit"], a["post_id"],
                                   int(a.get("limit", 5))))


def _tool_inbox(a):
    return rc.with_reddit_tab(lambda: rc.op_inbox(int(a.get("limit", 25))))


def _tool_roi(a):
    user = a.get("user")
    if not user:
        user = rc.with_reddit_tab(rc.op_me)["name"]
    return rc.with_reddit_tab(lambda: rc.op_roi(user, int(a.get("limit", 25))))


def _tool_comment(a):
    thing_id, text = a["thing_id"], a["text"]
    if not a.get("confirm"):
        return {"preview": True, "would_reply_to": thing_id, "text": text,
                "note": "Not sent. Call again with confirm=true to post."}
    rc.check_daily_limit("comment")
    rc.enforce_gap("comment")
    res = rc.with_reddit_tab(lambda: rc.op_comment(thing_id, text))
    rc._report_errors(res.get("errors"))
    rc.record_action("comment")
    state = rc.load_state()
    return {"posted": True, "permalink": res.get("permalink"),
            "id": res.get("id"),
            "daily": "%d/%d" % (state["comments"], rc.MAX_COMMENTS_PER_DAY)}


def _tool_post(a):
    sub, title = a["subreddit"], a["title"]
    text, url = a.get("text"), a.get("url")
    if bool(text) == bool(url):
        raise rc.RedditCliError("Provide exactly one of text (self post) or url (link post).")
    kind = "self" if text else "link"
    if not a.get("confirm"):
        return {"preview": True, "subreddit": sub, "kind": kind, "title": title,
                "body": text if kind == "self" else url,
                "note": "Not sent. Call again with confirm=true to submit."}
    rc.check_daily_limit("post")
    rc.enforce_gap("post")
    res = rc.with_reddit_tab(lambda: rc.op_submit(sub, kind, title, text, url))
    rc._report_errors(res.get("errors"))
    rc.record_action("post")
    return {"posted": True, "url": res.get("url"), "name": res.get("name")}


# --------------------------------------------------------------------------
# Tool registry (name -> (handler, description, inputSchema))
# --------------------------------------------------------------------------

def _obj(props, required=None):
    return {"type": "object", "properties": props, "required": required or []}


_STR = {"type": "string"}
_INT = {"type": "integer"}
_NUM = {"type": "number"}
_BOOL = {"type": "boolean"}

TOOLS = {
    "reddit_karma": (
        _tool_karma,
        "Show the logged-in account's karma (total/comment/link). Also a login check.",
        _obj({})),
    "reddit_scan": (
        _tool_scan,
        "List posts in a subreddit with t3_ ids, score, comment count and age. "
        "Optional filters apply the 选帖标准 thresholds.",
        _obj({"subreddit": _STR,
              "sort": {"type": "string", "enum": ["rising", "hot", "new", "top"]},
              "limit": _INT, "min_score": _INT, "max_comments": _INT,
              "max_age_hours": _NUM}, ["subreddit"])),
    "reddit_profile": (
        _tool_profile,
        "List the account's joined subreddits (largest first) as an interest map.",
        _obj({})),
    "reddit_suggest": (
        _tool_suggest,
        "Scan several subreddits in one round-trip and return ranked comment "
        "opportunities (early traction, not yet saturated).",
        _obj({"subreddits": {"type": "array", "items": _STR},
              "sort": {"type": "string", "enum": ["rising", "hot", "new"]},
              "per_sub_limit": _INT, "top": _INT, "min_score": _INT,
              "max_comments": _INT, "max_age_hours": _NUM})),
    "reddit_rules": (
        _tool_rules,
        "Show a subreddit's rules and restrict_posting/restrict_commenting flags. "
        "Call before commenting in an unfamiliar sub.",
        _obj({"subreddit": _STR}, ["subreddit"])),
    "reddit_top_comments": (
        _tool_top,
        "List a post's top comments with t1_ ids, so you can reply to a comment.",
        _obj({"subreddit": _STR, "post_id": _STR, "limit": _INT},
             ["subreddit", "post_id"])),
    "reddit_inbox": (
        _tool_inbox,
        "List comment replies in the inbox (author, sub, score, body, context link).",
        _obj({"limit": _INT})),
    "reddit_roi": (
        _tool_roi,
        "Aggregate recent comment scores by subreddit (count/total/avg/max).",
        _obj({"user": _STR, "limit": _INT})),
    "reddit_comment": (
        _tool_comment,
        "Post a comment to a t3_ post or t1_ comment. Returns a preview unless "
        "confirm=true; then it sends (subject to daily limits).",
        _obj({"thing_id": _STR, "text": _STR, "confirm": _BOOL},
             ["thing_id", "text"])),
    "reddit_post": (
        _tool_post,
        "Submit a text post (text) or link post (url) to a subreddit. Returns a "
        "preview unless confirm=true; then it sends (subject to daily limits).",
        _obj({"subreddit": _STR, "title": _STR, "text": _STR, "url": _STR,
              "confirm": _BOOL}, ["subreddit", "title"])),
}


# --------------------------------------------------------------------------
# JSON-RPC / MCP plumbing
# --------------------------------------------------------------------------

def _result(id_, result):
    return {"jsonrpc": "2.0", "id": id_, "result": result}


def _error(id_, code, message):
    return {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": message}}


def _handle(msg):
    """Return a response dict for a request, or None for a notification."""
    method = msg.get("method")
    id_ = msg.get("id")
    is_request = id_ is not None

    if method == "initialize":
        proto = (msg.get("params") or {}).get("protocolVersion", DEFAULT_PROTOCOL)
        return _result(id_, {
            "protocolVersion": proto,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
        })

    if method in ("notifications/initialized", "initialized"):
        return None  # notification, no response

    if method == "ping":
        return _result(id_, {})

    if method == "tools/list":
        tools = [{"name": name, "description": desc, "inputSchema": schema}
                 for name, (_fn, desc, schema) in TOOLS.items()]
        return _result(id_, {"tools": tools})

    if method == "tools/call":
        params = msg.get("params") or {}
        name = params.get("name")
        args = params.get("arguments") or {}
        entry = TOOLS.get(name)
        if not entry:
            return _error(id_, -32602, "Unknown tool: %s" % name)
        fn = entry[0]
        try:
            data = fn(args)
            text = json.dumps(data, ensure_ascii=False, indent=2)
            return _result(id_, {"content": [{"type": "text", "text": text}],
                                 "isError": False})
        except rc.RedditCliError as exc:
            return _result(id_, {"content": [{"type": "text", "text": str(exc)}],
                                 "isError": True})
        except Exception as exc:  # noqa: BLE001 — surface as tool error, don't crash server
            return _result(id_, {"content": [{"type": "text",
                                 "text": "internal error: %s" % exc}],
                                 "isError": True})

    if is_request:
        return _error(id_, -32601, "Method not found: %s" % method)
    return None  # unknown notification


def main():
    out = sys.stdout
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue  # ignore unparseable lines
        try:
            response = _handle(msg)
        except Exception as exc:  # noqa: BLE001
            response = _error(msg.get("id"), -32603, "Internal error: %s" % exc)
        if response is not None:
            out.write(json.dumps(response, ensure_ascii=False) + "\n")
            out.flush()


if __name__ == "__main__":
    main()
