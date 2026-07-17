#!/usr/bin/env python3
"""reddit-cli — backend for the Reddit Karma Skill Pack.

Drives the user's real, logged-in Chrome via AppleScript (same approach as
skills/browser-control.md) so every request rides the existing session
cookies and is indistinguishable from human browsing. No API tokens, no
Playwright/Selenium, no third-party dependencies — macOS + Chrome only.

The skills' scattered JavaScript snippets (check karma, scan posts, comment,
submit, ROI, inbox) are consolidated here behind a single command line, with
shared rate limiting and a dry-run gate on anything that writes to Reddit.

Usage:
    reddit_cli.py karma
    reddit_cli.py scan AskReddit --sort rising --limit 10
    reddit_cli.py rules SideProject
    reddit_cli.py top AskReddit 1saopui --limit 5
    reddit_cli.py comment t3_abc123 "your comment text" --yes
    reddit_cli.py post SideProject --title "..." --text "..." --yes
    reddit_cli.py post SideProject --title "..." --url https://... --yes
    reddit_cli.py inbox
    reddit_cli.py roi --limit 25

Add --json to any read command for machine-readable output.
"""

import argparse
import json
import os
import subprocess
import sys
import time

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

STATE_DIR = os.path.expanduser("~/.reddit-cli")
STATE_FILE = os.path.join(STATE_DIR, "state.json")

# Rate limits — mirror SKILL.md "Rate Limits (Cross-Skill)".
MAX_COMMENTS_PER_DAY = 15
MAX_POSTS_PER_DAY = 1
MIN_GAP_COMMENT_S = 2       # 2+ seconds between API calls
MIN_GAP_POST_S = 4          # 4+ seconds between posts

# How long to wait for an async fetch to resolve into document.title.
JS_TIMEOUT_S = 12
JS_POLL_S = 0.4
PAGE_LOAD_TIMEOUT_S = 15

REDDIT_URL = "https://www.reddit.com"

_marker_counter = 0


class RedditCliError(Exception):
    """User-facing error — printed without a traceback."""


# --------------------------------------------------------------------------
# Rate-limit state (persisted across invocations)
# --------------------------------------------------------------------------

def _today():
    return time.strftime("%Y-%m-%d", time.localtime())


def load_state():
    try:
        with open(STATE_FILE) as fh:
            state = json.load(fh)
    except (OSError, ValueError):
        state = {}
    if state.get("date") != _today():
        state = {"date": _today(), "comments": 0, "posts": 0, "last_action_ts": 0}
    state.setdefault("comments", 0)
    state.setdefault("posts", 0)
    state.setdefault("last_action_ts", 0)
    return state


def save_state(state):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(STATE_FILE, "w") as fh:
        json.dump(state, fh)


def check_daily_limit(kind):
    """Raise if today's quota for 'comment' or 'post' is already spent."""
    state = load_state()
    if kind == "comment" and state["comments"] >= MAX_COMMENTS_PER_DAY:
        raise RedditCliError(
            "Daily comment limit reached (%d). Wait until tomorrow to avoid "
            "Reddit spam detection." % MAX_COMMENTS_PER_DAY)
    if kind == "post" and state["posts"] >= MAX_POSTS_PER_DAY:
        raise RedditCliError(
            "Daily post limit reached (%d cross-subreddit post/day). Posting "
            "more today risks a shadowban." % MAX_POSTS_PER_DAY)


def enforce_gap(kind):
    """Sleep so consecutive writes keep the minimum spacing."""
    state = load_state()
    min_gap = MIN_GAP_POST_S if kind == "post" else MIN_GAP_COMMENT_S
    elapsed = time.time() - state["last_action_ts"]
    if 0 <= elapsed < min_gap:
        time.sleep(min_gap - elapsed)


def record_action(kind):
    state = load_state()
    if kind == "comment":
        state["comments"] += 1
    elif kind == "post":
        state["posts"] += 1
    state["last_action_ts"] = time.time()
    save_state(state)


# --------------------------------------------------------------------------
# Browser layer (AppleScript / Chrome)
# --------------------------------------------------------------------------

def _osa(script):
    """Run a one-shot AppleScript, return trimmed stdout."""
    try:
        out = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        raise RedditCliError("osascript not found — this CLI requires macOS.")
    except subprocess.TimeoutExpired:
        raise RedditCliError("Chrome did not respond (osascript timed out).")
    if out.returncode != 0:
        raise RedditCliError("AppleScript error: " + out.stderr.strip())
    return out.stdout.strip()


def _osa_exec_js(js):
    """Execute JavaScript in the front window's last tab.

    The JS is passed as an AppleScript run-argument so quotes, backticks and
    newlines inside it need no shell/AppleScript escaping.
    """
    script = (
        "on run argv\n"
        'tell application "Google Chrome"\n'
        "tell (last tab of front window) to execute javascript (item 1 of argv)\n"
        "end tell\n"
        "end run"
    )
    try:
        out = subprocess.run(
            ["osascript", "-e", script, js],
            capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        raise RedditCliError("Chrome did not respond while running JavaScript.")
    if out.returncode != 0:
        stderr = out.stderr.strip()
        if "Allow JavaScript from Apple Events" in stderr or "-1728" in stderr:
            raise RedditCliError(
                "Chrome blocked the JavaScript. Enable "
                "View → Developer → Allow JavaScript from Apple Events, "
                "then restart Chrome.")
        raise RedditCliError("AppleScript error: " + stderr)


def _ensure_chrome_window():
    count = _osa('tell application "Google Chrome" to return count of windows')
    if count in ("0", ""):
        # Multi-profile can hide windows from AppleScript entirely.
        raise RedditCliError(
            "Chrome has no scriptable window (0 windows). Open a normal Chrome "
            "window logged into Reddit and try again. If you use multiple Chrome "
            "profiles, this is the known multi-profile AppleScript bug — use the "
            "primary profile window.")


def _open_reddit_tab():
    _osa('tell application "Google Chrome" to tell front window to '
         'make new tab with properties {URL:"%s"}' % REDDIT_URL)
    deadline = time.time() + PAGE_LOAD_TIMEOUT_S
    while time.time() < deadline:
        loading = _osa('tell application "Google Chrome" to return '
                       'loading of last tab of front window')
        if loading == "false":
            return
        time.sleep(0.3)
    # Not fatal — reddit may still be interactive enough for fetch().


def _close_last_tab():
    try:
        _osa('tell application "Google Chrome" to close last tab of front window')
    except RedditCliError:
        pass  # best-effort cleanup


def _read_title():
    return _osa('tell application "Google Chrome" to return '
                'title of last tab of front window')


def _run_js_result(body):
    """Run a JS body (ending in `return <value>`) and return the parsed value.

    Bridges async results through document.title, the only channel AppleScript
    can read back synchronously (see browser-control.md).
    """
    global _marker_counter
    _marker_counter += 1
    marker = "__RCLI%d__" % _marker_counter
    wrapped = (
        "(async () => {\n"
        "  try {\n"
        "    const __v = await (async () => {\n" + body + "\n})();\n"
        '    document.title = "' + marker + '" + JSON.stringify(__v);\n'
        "  } catch (__e) {\n"
        '    document.title = "' + marker + '" + JSON.stringify('
        '{__error: (__e && __e.message) || String(__e)});\n'
        "  }\n"
        "})();"
    )
    _osa_exec_js(wrapped)

    deadline = time.time() + JS_TIMEOUT_S
    while time.time() < deadline:
        title = _read_title()
        if title.startswith(marker):
            payload = title[len(marker):]
            try:
                data = json.loads(payload)
            except ValueError:
                raise RedditCliError("Could not parse Reddit response.")
            if isinstance(data, dict) and "__error" in data:
                raise RedditCliError("Reddit request failed: " + str(data["__error"]))
            return data
        time.sleep(JS_POLL_S)
    raise RedditCliError(
        "Timed out waiting for Reddit response. The session may be expired "
        "(re-login in Chrome) or rate limited (wait ~5 min).")


def with_reddit_tab(fn):
    """Open a fresh reddit.com tab, run fn(), always close it (golden rule:
    never touch the user's current tab)."""
    _ensure_chrome_window()
    _open_reddit_tab()
    try:
        return fn()
    finally:
        _close_last_tab()


# --------------------------------------------------------------------------
# Reddit operations
# --------------------------------------------------------------------------

def op_me():
    return _run_js_result(
        'const r = await fetch("/api/me.json",{credentials:"include"})'
        '.then(x=>x.json());\n'
        'if(!r||!r.data||!r.data.name) return {__error:"not logged in"};\n'
        'return {name:r.data.name, total:r.data.total_karma, '
        'comment:r.data.comment_karma, link:r.data.link_karma, '
        'modhash:r.data.modhash};')


def op_scan(sub, sort, limit):
    body = (
        'const r = await fetch("/r/%s/%s.json?limit=%d",{credentials:"include"})'
        '.then(x=>x.json());\n'
        'const now = Date.now()/1000;\n'
        'return (r.data.children||[]).map(c=>({id:c.data.name, score:c.data.score, '
        'comments:c.data.num_comments, age_h:(now-c.data.created_utc)/3600, '
        'title:c.data.title, sub:c.data.subreddit, '
        'permalink:"https://www.reddit.com"+c.data.permalink}));'
        % (sub, sort, limit))
    return _run_js_result(body)


def op_rules(sub):
    body = (
        'const rr = await fetch("/r/%s/about/rules.json",{credentials:"include"})'
        '.then(x=>x.json());\n'
        'const ab = await fetch("/r/%s/about.json",{credentials:"include"})'
        '.then(x=>x.json());\n'
        'return {sub:"%s", restrict_posting:!!ab.data.restrict_posting, '
        'restrict_commenting:!!ab.data.restrict_commenting, '
        'subscribers:ab.data.subscribers, '
        'rules:(rr.rules||[]).map((x,i)=>({n:i+1, name:x.short_name, '
        'applies_to:x.kind, desc:(x.description||"").slice(0,180)}))};'
        % (sub, sub, sub))
    return _run_js_result(body)


def op_top_comments(sub, post_id, limit):
    body = (
        'const r = await fetch("/r/%s/comments/%s.json?limit=%d&sort=top",'
        '{credentials:"include"}).then(x=>x.json());\n'
        'const kids = (r[1] && r[1].data && r[1].data.children) || [];\n'
        'return kids.filter(c=>c.kind==="t1").slice(0,%d).map(c=>({id:c.data.name, '
        'author:c.data.author, score:c.data.score, '
        'replies:(c.data.replies&&c.data.replies.data&&'
        'c.data.replies.data.children.length)||0, '
        'body:(c.data.body||"").replace(/\\s+/g," ").slice(0,140)}));'
        % (sub, post_id, limit, limit))
    return _run_js_result(body)


def op_comment(thing_id, text):
    body = (
        'const me = await fetch("/api/me.json",{credentials:"include"})'
        '.then(x=>x.json());\n'
        'const uh = me.data.modhash;\n'
        'const p = new URLSearchParams({thing_id:%s, text:%s, uh:uh, '
        'api_type:"json"});\n'
        'const resp = await fetch("/api/comment",{method:"POST",'
        'credentials:"include",headers:{"Content-Type":'
        '"application/x-www-form-urlencoded","X-Modhash":uh},'
        'body:p.toString()}).then(x=>x.json());\n'
        'const errs = (resp.json && resp.json.errors) || [];\n'
        'let t=null; try{ t = resp.json.data.things[0].data; }catch(e){}\n'
        'return {errors:errs, id:t&&t.name, permalink:t&&("https://www.reddit.com"'
        '+t.permalink)};'
        % (json.dumps(thing_id), json.dumps(text)))
    return _run_js_result(body)


def op_submit(sub, kind, title, text=None, url=None):
    if kind == "self":
        content_line = 'params.text = %s;' % json.dumps(text or "")
    else:
        content_line = 'params.url = %s;' % json.dumps(url or "")
    body = (
        'const me = await fetch("/api/me.json",{credentials:"include"})'
        '.then(x=>x.json());\n'
        'const uh = me.data.modhash;\n'
        'const params = {sr:%s, kind:%s, title:%s, uh:uh, api_type:"json", '
        'resubmit:"true"};\n'
        '%s\n'
        'const p = new URLSearchParams(params);\n'
        'const resp = await fetch("/api/submit",{method:"POST",'
        'credentials:"include",headers:{"Content-Type":'
        '"application/x-www-form-urlencoded"},body:p.toString()})'
        '.then(x=>x.json());\n'
        'return {errors:(resp.json&&resp.json.errors)||[], '
        'url:(resp.json&&resp.json.data&&resp.json.data.url)||null, '
        'name:(resp.json&&resp.json.data&&resp.json.data.name)||null};'
        % (json.dumps(sub), json.dumps(kind), json.dumps(title), content_line))
    return _run_js_result(body)


def op_inbox(limit):
    body = (
        'const r = await fetch("/message/inbox.json?limit=%d",'
        '{credentials:"include"}).then(x=>x.json());\n'
        'return (r.data.children||[]).filter(m=>m.kind==="t1").map(m=>({'
        'from:m.data.author, sub:m.data.subreddit, type:m.data.type, '
        'isnew:!!m.data.new, score:m.data.score, '
        'body:(m.data.body||"").replace(/\\s+/g," ").slice(0,140), '
        'context:"https://reddit.com"+m.data.context}));' % limit)
    return _run_js_result(body)


def op_roi(user, limit):
    body = (
        'const r = await fetch("/user/%s/comments.json?limit=%d",'
        '{credentials:"include"}).then(x=>x.json());\n'
        'const rows = (r.data.children||[]).map(c=>({sub:c.data.subreddit, '
        'score:c.data.score}));\n'
        'const m={};\n'
        'rows.forEach(c=>{if(!m[c.sub])m[c.sub]={count:0,total:0,max:0};'
        'm[c.sub].count++;m[c.sub].total+=c.score;'
        'm[c.sub].max=Math.max(m[c.sub].max,c.score);});\n'
        'return {n:rows.length, subs:m};' % (user, limit))
    return _run_js_result(body)


# --------------------------------------------------------------------------
# Output formatting
# --------------------------------------------------------------------------

def _print_table(rows, columns):
    """rows: list of dicts. columns: list of (key, header, width, transform)."""
    headers = [c[1] for c in columns]
    widths = [c[2] for c in columns]
    line = "  ".join(h.ljust(w) for h, w, in zip(headers, widths))
    print(line)
    print("  ".join("-" * w for w in widths))
    for row in rows:
        cells = []
        for key, _hdr, width, transform in columns:
            val = transform(row.get(key)) if transform else row.get(key, "")
            val = "" if val is None else str(val)
            if len(val) > width:
                val = val[: width - 1] + "…"
            cells.append(val.ljust(width))
        print("  ".join(cells))


def _confirm(prompt):
    if not sys.stdin.isatty():
        return False
    try:
        return input(prompt).strip().lower() in ("y", "yes")
    except EOFError:
        return False


def _report_errors(errors):
    """Reddit returns errors as [[CODE, message, field], ...]."""
    if errors:
        msgs = "; ".join("%s: %s" % (e[0], e[1]) for e in errors)
        raise RedditCliError("Reddit rejected the request — " + msgs)


# --------------------------------------------------------------------------
# Command handlers
# --------------------------------------------------------------------------

def cmd_karma(args):
    me = with_reddit_tab(op_me)
    if args.json:
        print(json.dumps({k: me[k] for k in ("name", "total", "comment", "link")}))
        return
    print("Account: u/%s" % me["name"])
    print("Total karma:   %s" % me["total"])
    print("Comment karma: %s" % me["comment"])
    print("Link karma:    %s" % me["link"])


def cmd_scan(args):
    posts = with_reddit_tab(lambda: op_scan(args.subreddit, args.sort, args.limit))
    if args.json:
        print(json.dumps(posts, ensure_ascii=False))
        return
    if not posts:
        print("No posts found in r/%s (%s)." % (args.subreddit, args.sort))
        return
    print("r/%s — %s (%d)" % (args.subreddit, args.sort, len(posts)))
    _print_table(posts, [
        ("id", "id", 12, None),
        ("score", "score", 6, None),
        ("comments", "cmts", 5, None),
        ("age_h", "age(h)", 7, lambda v: "%.1f" % v if v is not None else ""),
        ("title", "title", 60, None),
    ])


def cmd_rules(args):
    data = with_reddit_tab(lambda: op_rules(args.subreddit))
    if args.json:
        print(json.dumps(data, ensure_ascii=False))
        return
    flags = []
    if data.get("restrict_commenting"):
        flags.append("restrict_commenting=TRUE (new/low-karma may be blocked)")
    if data.get("restrict_posting"):
        flags.append("restrict_posting=TRUE")
    print("r/%s — %s subscribers" % (data["sub"], data.get("subscribers", "?")))
    if flags:
        print("⚠ " + " | ".join(flags))
    for r in data.get("rules", []):
        applies = (" [%s]" % r["applies_to"]) if r.get("applies_to") else ""
        print("  %d. %s%s" % (r["n"], r["name"], applies))
        if r.get("desc"):
            print("     %s" % r["desc"])


def cmd_top(args):
    rows = with_reddit_tab(
        lambda: op_top_comments(args.subreddit, args.post_id, args.limit))
    if args.json:
        print(json.dumps(rows, ensure_ascii=False))
        return
    if not rows:
        print("No comments found.")
        return
    print("Top comments — r/%s post %s (reply target = id column)"
          % (args.subreddit, args.post_id))
    _print_table(rows, [
        ("id", "id (t1_)", 14, None),
        ("score", "score", 6, None),
        ("replies", "repl", 5, None),
        ("author", "author", 16, None),
        ("body", "body", 60, None),
    ])


def cmd_comment(args):
    check_daily_limit("comment")
    print("Reply target: %s" % args.thing_id)
    print("Text: %s" % args.text)
    if not args.yes and not _confirm("Post this comment? (yes/no) "):
        raise RedditCliError("Cancelled (pass --yes to post non-interactively).")
    enforce_gap("comment")
    res = with_reddit_tab(lambda: op_comment(args.thing_id, args.text))
    _report_errors(res.get("errors"))
    record_action("comment")
    state = load_state()
    print("Comment posted. %s" % (res.get("permalink") or res.get("id") or ""))
    print("Daily count: %d/%d comments." % (state["comments"], MAX_COMMENTS_PER_DAY))


def cmd_post(args):
    if bool(args.text) == bool(args.url):
        raise RedditCliError("Provide exactly one of --text (self post) or --url (link post).")
    kind = "self" if args.text else "link"
    check_daily_limit("post")
    print("Post Preview")
    print("─" * 40)
    print("Subreddit: r/%s" % args.subreddit)
    print("Kind: %s" % ("text post" if kind == "self" else "link post"))
    print("Title: %s" % args.title)
    print("Body:  %s" % (args.text if kind == "self" else args.url))
    print("─" * 40)
    if not args.yes and not _confirm("Submit this post? (yes/no) "):
        raise RedditCliError("Cancelled (pass --yes to post non-interactively).")
    enforce_gap("post")
    res = with_reddit_tab(
        lambda: op_submit(args.subreddit, kind, args.title, args.text, args.url))
    _report_errors(res.get("errors"))
    record_action("post")
    print("Post submitted: %s" % (res.get("url") or res.get("name") or "(no url returned)"))


def cmd_inbox(args):
    rows = with_reddit_tab(lambda: op_inbox(args.limit))
    if args.json:
        print(json.dumps(rows, ensure_ascii=False))
        return
    if not rows:
        print("Inbox: no comment replies.")
        return
    print("Inbox — %d comment repl%s" % (len(rows), "y" if len(rows) == 1 else "ies"))
    _print_table(rows, [
        ("isnew", "new", 3, lambda v: "*" if v else ""),
        ("from", "from", 16, lambda v: "u/" + v if v else ""),
        ("sub", "sub", 18, None),
        ("score", "score", 6, None),
        ("body", "body", 55, None),
    ])


def cmd_roi(args):
    user = args.user
    if not user:
        me = with_reddit_tab(op_me)
        user = me["name"]
        data = with_reddit_tab(lambda: op_roi(user, args.limit))
    else:
        data = with_reddit_tab(lambda: op_roi(user, args.limit))
    if args.json:
        print(json.dumps(data, ensure_ascii=False))
        return
    subs = data.get("subs", {})
    rows = []
    for name, s in subs.items():
        avg = s["total"] / s["count"] if s["count"] else 0
        rows.append({"sub": name, "count": s["count"], "total": s["total"],
                     "avg": avg, "max": s["max"]})
    rows.sort(key=lambda r: r["avg"], reverse=True)
    print("ROI — u/%s, last %d comments" % (user, data.get("n", 0)))
    _print_table(rows, [
        ("sub", "subreddit", 24, None),
        ("count", "n", 4, None),
        ("total", "total", 6, None),
        ("avg", "avg", 6, lambda v: "%.1f" % v),
        ("max", "max", 5, None),
    ])


# --------------------------------------------------------------------------
# CLI wiring
# --------------------------------------------------------------------------

def build_parser():
    p = argparse.ArgumentParser(
        prog="reddit-cli",
        description="Backend CLI for the Reddit Karma Skill Pack "
                    "(drives logged-in Chrome via AppleScript; macOS only).")
    sub = p.add_subparsers(dest="command", required=True)

    def add_json(sp):
        sp.add_argument("--json", action="store_true", help="machine-readable JSON output")

    sp = sub.add_parser("karma", help="show account karma / login status")
    add_json(sp)
    sp.set_defaults(func=cmd_karma)

    sp = sub.add_parser("scan", help="list posts in a subreddit")
    sp.add_argument("subreddit")
    sp.add_argument("--sort", default="rising",
                    choices=["rising", "hot", "new", "top"])
    sp.add_argument("--limit", type=int, default=10)
    add_json(sp)
    sp.set_defaults(func=cmd_scan)

    sp = sub.add_parser("rules", help="show a subreddit's rules + posting restrictions")
    sp.add_argument("subreddit")
    add_json(sp)
    sp.set_defaults(func=cmd_rules)

    sp = sub.add_parser("top", help="list top comments of a post (for t1_ replies)")
    sp.add_argument("subreddit")
    sp.add_argument("post_id", help="post id without the t3_ prefix, e.g. 1saopui")
    sp.add_argument("--limit", type=int, default=5)
    add_json(sp)
    sp.set_defaults(func=cmd_top)

    sp = sub.add_parser("comment", help="post a comment (t3_ post or t1_ comment)")
    sp.add_argument("thing_id", help="fullname to reply to, e.g. t3_abc123 or t1_def456")
    sp.add_argument("text")
    sp.add_argument("--yes", action="store_true", help="skip confirmation prompt")
    sp.set_defaults(func=cmd_comment)

    sp = sub.add_parser("post", help="submit a text or link post")
    sp.add_argument("subreddit")
    sp.add_argument("--title", required=True)
    sp.add_argument("--text", help="self-post body (markdown)")
    sp.add_argument("--url", help="link-post URL")
    sp.add_argument("--yes", action="store_true", help="skip confirmation prompt")
    sp.set_defaults(func=cmd_post)

    sp = sub.add_parser("inbox", help="show comment replies in the inbox")
    sp.add_argument("--limit", type=int, default=25)
    add_json(sp)
    sp.set_defaults(func=cmd_inbox)

    sp = sub.add_parser("roi", help="aggregate recent comment scores by subreddit")
    sp.add_argument("--user", help="username (default: logged-in account)")
    sp.add_argument("--limit", type=int, default=25)
    add_json(sp)
    sp.set_defaults(func=cmd_roi)

    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        args.func(args)
    except RedditCliError as exc:
        print("error: %s" % exc, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
