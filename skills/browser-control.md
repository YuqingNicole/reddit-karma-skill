---
name: browser-control
description: macOS Chrome browser automation via AppleScript and JXA. Controls real Chrome to execute JavaScript, read results, and manage tabs — without Playwright/Selenium detection. Use this as the browser layer for any skill that needs to operate a logged-in browser session (Reddit, Twitter, any web app).
---

# Browser Control (AppleScript + JXA)

Generic browser automation layer for macOS. Used by reddit-cultivate, reddit-post, and any other skill that needs to run JavaScript inside a real logged-in Chrome session.

---

## How It Works

```
Claude Code → osascript → Chrome (real browser, logged in) → Any website
```

- AppleScript executes JavaScript in Chrome tabs
- Chrome is already logged in → cookies sent automatically
- Same-origin fetch → no CORS, no detection, no IP blocks
- Websites cannot distinguish this from human browsing

---

## Prerequisites

- **macOS only** (AppleScript is macOS-native)
- Chrome: **View → Developer → Allow JavaScript from Apple Events ✓** (restart Chrome after enabling)
- User must be logged into the target site in Chrome

---

## Tab Management (Golden Rule)

> **Never replace the user's current tab.** Always open a new tab, operate on it, close when done.

```bash
# 1. Open new tab at target URL
osascript -e 'tell application "Google Chrome" to tell window 1 to make new tab with properties {URL:"https://example.com"}'
sleep 3

# 2. Operate on last tab (not active tab)
# ... see methods below ...

# 3. Close when done
osascript -e 'tell application "Google Chrome" to close last tab of window 1'
```

---

## Method Detection (Run First Every Session)

Chrome multi-profile can cause AppleScript to not see windows. Always detect before choosing a method:

```bash
WINDOWS=$(osascript -e 'tell application "Google Chrome" to return count of windows' 2>/dev/null)
if [ "$WINDOWS" = "0" ] || [ -z "$WINDOWS" ]; then
    echo "Use Method 2 (System Events + Console)"
else
    echo "Use Method 1 (execute javascript) | Windows: $WINDOWS"
fi
```

---

## Method 1: AppleScript Execute JavaScript (Preferred)

Works when `count of windows > 0`.

### Execute JS & Read Result via document.title

```bash
# Write result to document.title
osascript -e 'tell application "Google Chrome" to tell last tab of window 1 to execute javascript "
fetch(\"/api/me.json\", {credentials: \"include\"})
  .then(r => r.json())
  .then(d => { document.title = \"RESULT:\" + JSON.stringify(d.data) })
"'

# Wait for async to resolve, then read
sleep 3
osascript -e 'tell application "Google Chrome" to return title of last tab of window 1'
```

> **Why document.title?** AppleScript can only read the tab title synchronously. Writing async results there is the cleanest bridge.

### JXA for Complex JS (avoids shell escaping hell)

When JS contains quotes, backticks, or multiline logic, use JXA instead of AppleScript:

```bash
osascript -l JavaScript -e '
var chrome = Application("Google Chrome");
var tab = chrome.windows[0].tabs[chrome.windows[0].tabs.length - 1]; // last tab
tab.execute({javascript: "(function() {
    // Complex JS here — no shell escaping needed
    fetch("/r/rising.json?limit=10", {credentials: "include"})
        .then(r => r.json())
        .then(d => {
            document.title = "DATA:" + JSON.stringify(d.data.children.slice(0,5));
        });
})()"});
'
sleep 4
osascript -e 'tell application "Google Chrome" to return title of last tab of window 1'
```

### python3 + pbcopy for Strings with Special Characters

When JS contains single quotes, apostrophes, or complex data:

```bash
python3 << 'EOF'
import subprocess
js = """(async function() {
    var body = new URLSearchParams({
        thing_id: "t3_xxxxx",
        text: "It's a comment with 'quotes' and special chars",
        uh: "modhash_here",
        api_type: "json"
    });
    var resp = await fetch("/api/comment", {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString()
    });
    var d = await resp.json();
    document.title = "DONE:" + JSON.stringify({errors: d.json.errors});
})()"""
subprocess.run(['pbcopy'], input=js.encode(), check=True)
print("Copied to clipboard")
EOF
```

Then paste via Method 2 keyboard automation.

---

## Method 2: System Events + Console (Multi-Profile Fallback)

When AppleScript can't see Chrome windows (multi-profile bug), use keyboard automation to paste JS into Chrome's DevTools console.

### Step 1: Copy JS to clipboard

```bash
python3 -c "
import subprocess
js = '''(async () => {
    // your JS here
    document.title = 'RESULT:done';
})()'''
subprocess.run(['pbcopy'], input=js.encode(), check=True)
"
```

### Step 2: Paste and execute via keyboard

```bash
osascript -e '
tell application "System Events"
    tell process "Google Chrome"
        set frontmost to true
        delay 0.3
        -- Cmd+Option+J = open/close DevTools Console
        key code 38 using {command down, option down}
        delay 1.5
        -- Select all existing text, paste new JS, execute
        keystroke "a" using {command down}
        delay 0.2
        keystroke "v" using {command down}
        delay 0.5
        key code 36
        delay 0.3
        -- Close Console
        key code 38 using {command down, option down}
    end tell
end tell'
```

### Step 3: Read result via System Events

```bash
sleep 3
osascript -e '
tell application "System Events"
    tell process "Google Chrome"
        return name of window 1
    end tell
end tell'
```

---

## Reading Multi-Part Results

When JS produces large output (post lists, comment data), split into chunks if needed:

```javascript
// Write paginated results
var part1 = results.slice(0, 5);
var part2 = results.slice(5, 10);
document.title = "PART1:" + JSON.stringify(part1);
// Read part1, then run again with part2
```

---

## Common Patterns

### Fetch + write result

```javascript
(function() {
    fetch("/api/me.json", {credentials: "include"})
        .then(r => r.json())
        .then(d => { document.title = "ME:" + JSON.stringify(d.data) });
})()
```

### POST request

```javascript
(function() {
    var body = new URLSearchParams({
        key: "value",
        uh: "modhash",
        api_type: "json"
    });
    fetch("/api/endpoint", {
        method: "POST",
        credentials: "include",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: body.toString()
    }).then(r => r.json()).then(d => {
        document.title = "RESP:" + JSON.stringify({errors: d.json && d.json.errors});
    });
})()
```

### Parallel fetches

```javascript
(function() {
    Promise.all([
        fetch("/endpoint1", {credentials: "include"}).then(r => r.json()),
        fetch("/endpoint2", {credentials: "include"}).then(r => r.json())
    ]).then(([d1, d2]) => {
        document.title = "BOTH:" + JSON.stringify({a: d1.data, b: d2.data});
    });
})()
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `count of windows` = 0 | Multi-profile bug → use Method 2 |
| "Allow JavaScript from Apple Events" not working | Restart Chrome after enabling |
| title not updating after JS runs | Async not resolved yet — increase `sleep` |
| JXA `Can't get object` error | Tab index issue — use `tabs.length - 1` not `activeTab` |
| Special chars breaking shell string | Use python3 + pbcopy instead |
| 403 on fetch | Session expired or rate limited — re-login or wait 5min |

---

## Extending to Other Browsers / Sites

This pattern works for any site Chrome is logged into:

1. Open new tab at the site's domain
2. JS has same-origin access to all cookies/session
3. Use fetch() with `credentials: "include"` for API calls
4. Write results to `document.title`, read via AppleScript
5. Close tab when done

Works for: Reddit, Twitter/X, LinkedIn, GitHub, any web app with a JSON API.

---

## Alternative Approaches (Tested 2026-04-03)

### undetected-chromedriver (Python)

**What it is:** ChromeDriver with `navigator.webdriver` patched — bypasses basic bot detection.

**Test result:**
- ✅ Installs and launches correctly on macOS (Chrome 146 + uc 3.5.5)
- ✅ `navigator.webdriver` returns `None` (detection bypassed)
- ❌ **Fatal limitation:** Launches a fresh Chrome instance with no existing session cookies
- ❌ Cannot share login state with your already-open Chrome without closing it first
- ❌ Using `--user-data-dir` to share profile causes lock conflict if Chrome is already running

**Verdict:** Only viable if you maintain a **dedicated Chrome profile exclusively for automation** (never open it manually). Too much friction for daily use. Useful as a fallback on Windows/Linux where AppleScript is unavailable.

**Setup if you need it:**
```python
import undetected_chromedriver as uc

options = uc.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--proxy-server=http://127.0.0.1:7890")  # adjust for your proxy
# Use a dedicated profile dir (not your main Chrome profile)
options.add_argument("--user-data-dir=/path/to/dedicated/chrome/profile")

driver = uc.Chrome(options=options, headless=False, version_main=146)
driver.get("https://www.reddit.com")
# Log in manually on first run, then sessions will persist
```

---

### MoreLogin (Anti-Detection Browser)

**What it is:** A separate browser app that creates isolated profiles, each with unique Canvas fingerprint, WebGL, fonts, UA, timezone. Exposes a local API at `http://127.0.0.1:40000`.

**Architecture:**
```
Python/Node → MoreLogin Local API (port 40000) → start profile → get debug port → Selenium/Playwright connects
```

**Key API calls:**
```bash
# List profiles
curl -X POST http://127.0.0.1:40000/api/env/page \
  -H "Content-Type: application/json" \
  -d '{"pageNo": 1, "pageSize": 10}'

# Start a profile — returns debugPort for Selenium
curl -X POST http://127.0.0.1:40000/api/env/start \
  -H "Content-Type: application/json" \
  -d '{"envId": "YOUR_ENV_ID"}'
# Returns: {"debugPort": 9222, "webdriver": "/path/to/chromedriver"}

# Connect Selenium to running profile
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
driver = webdriver.Chrome(executable_path="/path/to/chromedriver", options=options)
# Now drive the logged-in MoreLogin profile
```

**Test result:** Not tested live (requires MoreLogin app installed + account). API pattern confirmed from official docs.

**Verdict:**
- ✅ Best option for **multi-account matrix** (each profile has different fingerprint + IP)
- ✅ Profiles persist login state — reconnect without re-logging in
- ✅ Selenium connects to running profile (same pattern as `--remote-debugging-port`)
- ❌ Overkill for single-account use — adds dependency on MoreLogin app running
- ❌ Not free at scale (paid tiers for multiple profiles)

**When to use:** When you need 3+ Reddit accounts, each with isolated identity. Current stage (single account): skip.

---

### Comparison Table

| Method | macOS | Win/Linux | Shares login | Multi-account | Complexity | Reddit safety |
|--------|-------|-----------|-------------|---------------|------------|--------------|
| **AppleScript** (current) | ✅ | ❌ | ✅ native | ❌ | Low | ✅ Highest |
| **undetected-chromedriver** | ✅ | ✅ | ⚠️ dedicated profile | ❌ | Medium | ⚠️ Medium |
| **MoreLogin + Selenium** | ✅ | ✅ | ✅ per profile | ✅ | High | ✅ High |
| **Playwright + stealth** | ✅ | ✅ | ❌ | ❌ | Medium | ❌ Detected |
