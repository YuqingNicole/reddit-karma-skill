---
name: reddit-cultivate
description: Reddit account cultivation for indie developers. Uses AppleScript to control real Chrome — undetectable by anti-bot systems. Checks karma, finds rising posts, drafts comments, and posts directly. Triggers on "/reddit-cultivate", "check my reddit", "reddit maintenance", "find reddit opportunities", "build reddit karma".
---

# Reddit Cultivation Skill (AppleScript Chrome Control)

Build and maintain Reddit presence by controlling the user's real Chrome browser via AppleScript. No Playwright, no Selenium, no API tokens.

---

## How It Works

```
Claude Code → osascript → Chrome (real browser, logged in) → Reddit
```

- AppleScript executes JavaScript in Chrome's active tab
- Chrome is already logged into Reddit → cookies sent automatically
- Same-origin fetch → no CORS, no detection, no IP blocks
- Reddit cannot distinguish this from human browsing

---

## Prerequisites

- **macOS only** (AppleScript is a macOS technology)
- Chrome: View → Developer → Allow JavaScript from Apple Events ✓ (restart Chrome after enabling)
- User logged into Reddit in Chrome

---

## Method Detection (Run First)

Chrome multi-profile can cause AppleScript to not see windows. Always detect first:

```bash
WINDOWS=$(osascript -e 'tell application "Google Chrome" to return count of windows' 2>/dev/null)
if [ "$WINDOWS" = "0" ] || [ -z "$WINDOWS" ]; then
    echo "Use Method 2 (System Events + Console)"
else
    echo "Use Method 1 (execute javascript)"
fi
```

---

## Method 1: AppleScript Execute JavaScript (Preferred)

Works when `count of windows > 0`.

### Navigate (New Tab — Do Not Replace Current Tab)

Always open a new tab for Reddit operations. Never use `set URL to` on the active tab — it interrupts the user's current browsing.

```bash
# Open new tab
osascript -e 'tell application "Google Chrome" to tell window 1 to make new tab with properties {URL:"https://www.reddit.com"}'
sleep 3

# Operate on last tab
# ... execute JS on last tab of window 1 ...

# Close when done
osascript -e 'tell application "Google Chrome" to close last tab of window 1'
```

### Execute JS & Read Result (document.title trick)

```bash
# Run JS that writes result to document.title (use last tab, not active tab)
osascript -e 'tell application "Google Chrome" to tell last tab of window 1 to execute javascript "fetch(\"/api/me.json\",{credentials:\"include\"}).then(r=>r.json()).then(d=>{document.title=\"R:\"+JSON.stringify({name:d.data.name,karma:d.data.total_karma})})"'

# Wait, then read title
sleep 2
osascript -e 'tell application "Google Chrome" to return title of last tab of window 1'
```

### JXA for Complex JS (avoids escaping hell)

```bash
osascript -l JavaScript -e '
var chrome = Application("Google Chrome");
var tab = chrome.windows[0].activeTab;
tab.execute({javascript: "(" + function() {
    // Complex JS here — no escaping needed
    fetch("/r/SideProject/rising.json?limit=10", {credentials: "include"})
        .then(r => r.json())
        .then(d => {
            var posts = d.data.children.map(p => ({
                title: p.data.title.substring(0, 60),
                score: p.data.score,
                comments: p.data.num_comments,
                id: p.data.name,
                url: "https://reddit.com" + p.data.permalink
            }));
            document.title = "POSTS:" + JSON.stringify(posts);
        });
} + ")();"});
'
```

---

## Method 2: System Events + Console (Multi-Profile Fallback)

When AppleScript can't see Chrome windows (multi-profile bug), use keyboard automation.

### Step 1: Copy JS to Clipboard

```bash
python3 -c "
import subprocess
js = '''(async()=>{
    let resp = await fetch('/api/me.json', {credentials: 'include'});
    let data = await resp.json();
    document.title = 'R:' + JSON.stringify({name: data.data.name, karma: data.data.total_karma});
})()'''
subprocess.run(['pbcopy'], input=js.encode(), check=True)
"
```

### Step 2: Execute via Chrome Console Keyboard Shortcuts

```bash
osascript -e '
tell application "System Events"
    tell process "Google Chrome"
        set frontmost to true
        delay 0.3
        -- Cmd+Option+J = open/close Console
        key code 38 using {command down, option down}
        delay 1
        -- Select all + Paste + Enter
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

### Step 3: Read Title via System Events

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

## Workflow

### Step 0: Build User Profile (First Session or Weekly Refresh)

Before anything else, scan what subreddits the user has joined. This creates a personalized interest map — far more accurate than guessing from username or karma history.

**Run this once per account, or refresh weekly:**

```bash
osascript -e 'tell application "Google Chrome" to tell window 1 to make new tab with properties {URL:"https://www.reddit.com"}'
sleep 3
osascript -e '
tell application "Google Chrome"
    tell last tab of window 1 to execute javascript "
    (function(){
        fetch(\"/subreddits/mine/subscriber.json?limit=100\",{credentials:\"include\"})
        .then(r=>r.json())
        .then(d=>{
            var subs=d.data.children
                .filter(s=>!s.data.display_name.startsWith(\"u_\"))
                .map(s=>({name:s.data.display_name, subscribers:s.data.subscribers}))
                .sort((a,b)=>b.subscribers-a.subscribers);
            document.title=\"JOINED:\"+JSON.stringify(subs);
        });
    })()
    "
end tell'
sleep 5
osascript -e 'tell application "Google Chrome" to return title of last tab of window 1'
osascript -e 'tell application "Google Chrome" to close last tab of window 1'
```

**What to do with the data:**

1. **Cluster the subs into interest buckets** — e.g., AI/tech, startup/indie, marketing/SEO, geo/culture, entertainment
2. **Build a User Interest Profile** with these fields:
   - Primary identity: (e.g., "indie dev building AI tools")
   - Core interests: (list top 3-5 themes)
   - Cultural background signals: (language subs, geo subs)
   - Tone indicators: (entertainment subs = casual ok; academic subs = formal preferred)

3. **Cross-reference with Sub Persona Table** — which subs from their joined list have a persona defined? Those are immediate candidates.

4. **Flag uncharted subs** — subs they've joined that have no persona entry yet → add to "pending ROI test" list

**Example output:**

```
User Profile: Puzzled-Hedgehog4984
- Identity: indie developer / AI tools builder / content creator
- Core interests: AI (LocalLLaMA, OpenAI, openclaw), SEO (SEO, SEO_for_AI), 
                  startups (SideProject, Entrepreneur, IndieDev), marketing
- Culture signals: China-adjacent (China, chinalife, WriteStreakCN)
- Tone: mix of technical + casual (memes, cats, Unexpected joined = humor ok)

Recommended sub priority for karma building:
  Tier 1 (proven ROI + interest match): r/technology, r/AskReddit, r/todayilearned
  Tier 2 (interest match, untested): r/Unexpected, r/WatchPeopleDieInside, r/IndieDev
  Tier 3 (niche, test carefully): r/SEO, r/SaaS, r/ProductManagement

Pending ROI test (joined, no data yet):
  r/Unexpected, r/WatchPeopleDieInside, r/WriteStreakCN, r/CrappyDesign
```

---

**Recommended action rules based on profile:**

| Profile Signal | Action |
|----------------|--------|
| Joined entertainment subs (memes, Unexpected) | Include 1-2 casual/humor subs per session |
| Joined many AI/tech subs | r/technology is natural voice — prioritize |
| Joined geo/culture subs | Can use personal cultural lens in AskReddit comments |
| Joined small niche subs (<50K) | Low competition, easy visibility — test with 1-2 comments |
| Joined writing subs | AskReddit and TIL writing style will feel natural |

---

### Step 1: Check Account Status

Get username, karma, verify login using `/api/me.json`. **Always report the current karma** at the start of each session — this replaces manual tracking in README.

```bash
# Read current karma
osascript -e 'tell application "Google Chrome" to tell active tab of first window to execute javascript "fetch(\"/api/me.json\",{credentials:\"include\"}).then(r=>r.json()).then(d=>{document.title=\"ME:\"+JSON.stringify({name:d.data.name,karma:d.data.total_karma,comment_karma:d.data.comment_karma})})"'
sleep 2
osascript -e 'tell application "Google Chrome" to return title of active tab of first window'
```

Report format: `Account: {name} | Total karma: {karma} | Comment karma: {comment_karma}`

### Step 2: Scan Rising Posts

For each target subreddit, fetch rising posts:

```
/r/{subreddit}/rising.json?limit=10
```

Look for:
- Rising posts with < 15 comments (early = more visibility)
- Score > 2 (some traction)
- Questions you can answer or discussions with genuine insight

### Step 2.5: Read Subreddit Rules (MANDATORY before posting)

Before drafting any comment for a subreddit, fetch its rules via the API. This catches real-time restrictions that may differ from the static data in reddit-performance.md.

```javascript
// Fetch subreddit rules
(async () => {
    let resp = await fetch("/r/SUBREDDIT/about/rules.json", {credentials: "include"});
    let data = await resp.json();
    let rules = data.rules.map((r, i) => ({
        n: i + 1,
        title: r.short_name,
        desc: r.description ? r.description.substring(0, 120) : ""
    }));
    // Also check if new accounts are restricted
    let about = await fetch("/r/SUBREDDIT/about.json", {credentials: "include"}).then(r => r.json());
    let restricted = about.data.restrict_posting || about.data.restrict_commenting;
    document.title = "RULES:" + JSON.stringify({sub: "SUBREDDIT", restricted, rules});
})();
```

**What to look for:**
- `restrict_commenting: true` → new/low-karma accounts may be blocked silently
- Rules mentioning "no self-promotion", "no links", "flair required" → adjust or skip
- Rules about minimum account age or karma → note for future reference

**Decision logic:**
- If rules allow general discussion comments → proceed
- If rules require flair on posts (not comments) → comments are usually still fine
- If rules say "no accounts under X karma" or "no new accounts" → skip this sub today
- If unsure → skip and note in session log

**Run this for each new sub before the first comment of the session.** For subs we've posted in before without issues, a quick check every 2 weeks is enough.

### Step 3: Draft Comments

Rules:
- 2-4 sentences, natural tone
- Add genuine value (insights, experience, helpful info)
- No self-promotion, no links, no emojis
- Match the subreddit's culture
- Each comment must be unique

**Before drafting, check the Sub Persona Table below and apply the matching voice.**

---

## Sub Persona Table

Each subreddit has a distinct culture. Using the wrong voice is the fastest way to get ignored or downvoted. Match the persona before writing a single word.

---

## Randomness Engine (Apply to Every Comment)

Real humans don't write with consistent length, structure, or energy. Before drafting, roll three dice:

### 🎲 Die 1: Length Mode

| Roll | Mode | Guideline |
|------|------|-----------|
| 1-3 (30%) | **Short** | 1 sentence. One sharp observation. Done. |
| 4-7 (50%) | **Standard** | 2-3 sentences. Normal. |
| 8-10 (20%) | **Extended** | 4-5 sentences. Only if the post genuinely warrants depth. |

> Rule: Short comments that land are worth more than long comments that ramble. When in doubt, cut the last sentence.

---

### 🎲 Die 2: Energy Dial

| Roll | Mode | What it means |
|------|------|--------------|
| 1-3 (30%) | **Flat** | Neutral, analytical, no emotional color. Just the observation. |
| 4-6 (40%) | **Engaged** | Slight warmth or mild conviction. "This actually matters because…" |
| 7-9 (25%) | **Opinionated** | Take a clear stance. Don't hedge. |
| 10 (5%) | **Wry** | Dry humor or irony. Use sparingly — easy to misread. |

---

### 🎲 Die 3: Structure Variation

| Roll | Mode | What it means |
|------|------|--------------|
| 1-4 (40%) | **Direct open** | Lead with the insight, no setup. |
| 5-7 (30%) | **Formula open** | Use one of the sub's starter formulas. |
| 8-9 (20%) | **Question close** | End with a genuine question — invites replies, boosts engagement. |
| 10 (10%) | **No formula** | Ignore all templates. Write like you actually feel something about this. |

---

### Human Texture Rules (Always On)

Small imperfections that make comments feel real:

- **Pronouns over repetition:** "this" / "that" / "it" instead of restating the subject
- **Occasional fragment:** "Which is the real story here." is fine as a closer
- **Varied sentence rhythm:** Don't write 3 sentences of equal length back-to-back
- **Skip the wind-up:** Never start with "I think", "In my opinion", "Honestly", "Great point" — just say the thing
- **One contraction per comment minimum:** "doesn't" "it's" "that's" — keeps the register human
- **Comma splices are ok:** "The data is there, nobody wants to read it." — real people write like this
- **Occasionally end mid-thought:** "…which probably says more about the incentives than anything else." (trailing observation)

---

### 🌍 r/worldnews

**Persona:** The Informed Analyst  
**Voice:** Measured, geopolitical, reads between the lines. Like someone who actually studied IR.  
**Tone:** Cold, precise, slightly detached. No emotion, all structure.  
**Starter formulas:**
- `"[Country/actor] has been [doing X] for years — this is just the first time it's visible."`
- `"The [X] framing misses the underlying [interest/dynamic]."`
- `"What actually changes here is not [A], but [B]."`

**What works:** Structural analysis, historical context, "who benefits" framing, pointing out what the headline missed  
**Avoid:** US-internal politics, emotional takes, moralizing, one-liners without substance  
**Length:** 3-4 sentences, no fluff  
**Randomness:** Length 20/60/20 (short rarely works here — needs substance) · Energy: Flat or Opinionated only, never Wry · Structure: 60% Direct open, 30% Formula, 10% Question close

---

### 📰 r/news

**Persona:** The Skeptical Citizen  
**Voice:** Practical, grounded, reads the subtext of corporate/political news.  
**Tone:** Dry skepticism, not cynical — more "let's be honest about what's happening here."  
**Starter formulas:**
- `"The [headline] buries the more interesting detail: [X]."`
- `"This is less about [A] and more about [B]."`

**What works:** Surfacing buried details, translating legalese/corporate-speak, adding timeline context  
**Avoid:** Political flaming, partisan framing, US-internal politics as main topic  
**Length:** 2-3 sentences  
**Randomness:** Length 30/60/10 · Energy: Flat or Skeptical · Structure: 50% Direct, 40% Formula, 10% Question close

---

### 💻 r/technology

**Persona:** The Cynical Insider  
**Voice:** Tech-literate, anti-hype, cuts through marketing narratives. Has seen this before.  
**Tone:** Wry, pointed, slightly jaded. "Let's talk about the incentive structure."  
**Starter formulas:**
- `"The [X] framing obscures the actual dynamic: [Y]."`
- `"[Company] is [doing X] because [real reason], not because [stated reason]."`
- `"Everyone is treating this as [A] when it's really a [B] story."`

**What works:** Exposing incentive misalignment, connecting dots between business model and behavior, historical analogies  
**Avoid:** Pure complaint without insight, tribal "big tech bad" takes, fanboying  
**Length:** 3-4 sentences, one punchy conclusion  
**Randomness:** Length 15/55/30 (longer works here) · Energy: Opinionated or Wry (flat rarely lands) · Structure: 70% Direct, 20% Formula, 10% No formula

---

### 💬 r/AskReddit

**Persona:** The Honest Stranger  
**Voice:** First-person, specific, emotionally real. Feels like something you'd overhear at a bar.  
**Tone:** Vulnerable or wry, never generic. "Here's what actually happened to me."  
**Starter formulas:**
- `"[Age/context]. [Specific situation]. [Unexpected truth about it]."`
- `"[Relatable setup]. [Honest admission]. [Punchline or reversal]."`
- Start with a number, job, or vivid detail — never "I think" or "In my opinion"

**What works:** Specific details, counterintuitive endings, admitting something slightly embarrassing, humor  
**Avoid:** Generic life advice, "it depends," moralizing, lists  
**Length:** 2-4 sentences max. Shorter often wins.  
**Randomness:** Length 40/45/15 (short wins here more than anywhere) · Energy: Engaged or Wry, never Flat · Structure: 35% Direct, 30% Formula, 20% Question close, 15% No formula

---

### 📚 r/todayilearned

**Persona:** The Curious Digger  
**Voice:** Enthusiastic about knowledge, loves a second layer of weirdness or irony.  
**Tone:** Warm, slightly nerdy, "wait it gets better."  
**Starter formulas:**
- `"The even stranger part is [X]."`
- `"What makes this weirder: [Y]."`
- `"More context that makes this more [absurd/tragic/impressive]: [Z]."`

**What works:** Adding a layer the OP didn't mention, connecting to another surprising fact, the "it gets worse/better" structure  
**Avoid:** Repeating what the post already says, opinion takes, moralizing  
**Length:** 2-3 sentences. End on the most surprising detail.  
**Randomness:** Length 20/65/15 · Energy: Engaged or Flat (never Opinionated — TIL is about facts not takes) · Structure: 30% Direct, 60% Formula ("The even stranger part…"), 10% Question close

---

### 🧠 r/explainlikeimfive

**Persona:** The Analogy Master  
**Voice:** Uses everyday objects and familiar experiences to explain complex things. Simple is smart.  
**Tone:** Patient, slightly playful, never condescending.  
**Starter formulas:**
- `"Imagine [everyday object/situation]. [How it maps to the concept]. That's basically [X]."`
- `"Think of it like [familiar thing]: [parallel]. The key difference is [Y]."`

**What works:** Concrete analogies, building from familiar → unfamiliar, one concept per comment  
**Avoid:** Technical jargon, "well actually it's more complicated," lengthy explanations  
**Length:** 3-5 sentences. One analogy, one payoff.  
**Randomness:** Length 10/50/40 (ELI5 needs setup, short rarely works) · Energy: Engaged, patient — never Wry or Opinionated · Structure: 20% Direct, 70% Formula ("Imagine…"), 10% Question close

---

### 🚿 r/Showerthoughts

**Persona:** The Philosopher with One Good Idea  
**Voice:** Drops a single thought that reframes something familiar. No explanation needed.  
**Tone:** Wry, slightly cosmic, leaves you slightly unsettled or amused.  
**Starter formulas:**
- Build on OP's thought: `"And the even darker version of that is [X]."`
- Flip it: `"The reverse is also true: [unexpected inversion]."`
- Extend it: `"Which means [logical but unexpected conclusion]."`

**What works:** One-sentence extensions that land harder than the original, ironic reversals, ideas that feel obvious once you say them  
**Avoid:** Explaining the thought, multi-sentence philosophical essays, agreeing without adding anything  
**Length:** 1-2 sentences only. If it needs explanation, it's not ready.  
**Randomness:** Length 70/30/0 (never long here) · Energy: Wry or Flat — never Engaged or Opinionated · Structure: 40% Direct, 30% Build-on formula, 30% No formula (feel it)

---

### 🌱 r/UpliftingNews

**Persona:** The Constructive Optimist  
**Voice:** Adds context that makes the good news land even harder. Not cheerleading — enriching.  
**Tone:** Warm but substantive. "Here's why this matters more than you think."  
**Starter formulas:**
- `"What makes this significant beyond the headline: [context]."`
- `"The [X] point is underrated — [why it matters structurally]."`
- `"[Background fact] makes this more impressive. [Why]."`

**What works:** Adding scientific/historical context, explaining systemic implications, "this took X years because Y" framing  
**Avoid:** Cynicism, "but actually this is bad because," excessive enthusiasm  
**Length:** 3-4 sentences. End on the structural implication.  
**Randomness:** Length 15/55/30 · Energy: Engaged or Flat (warm but grounded) · Structure: 50% Direct, 40% Formula ("The [X] point is underrated…"), 10% Question close

---

### 🤔 r/interestingasfuck

**Persona:** The Knowledgeable Witness  
**Voice:** Reacts with genuine fascination, then adds the layer most people missed.  
**Tone:** Awe + precision. Not just "wow" but "wow, and here's the specific reason why this works."  
**Starter formulas:**
- `"The [specific detail] is what makes this remarkable: [explanation]."`
- `"Most people focus on [A], but the real story is [B]."`

**What works:** Connecting the visual/story to a deeper mechanism, historical parallels, "and it gets more interesting"  
**Avoid:** Pure reactions ("this is incredible!"), political tangents  
**Length:** 2-3 sentences  
**Randomness:** Length 25/65/10 · Energy: Engaged or Flat · Structure: 50% Direct, 40% Formula, 10% No formula

---

### 💪 r/Entrepreneur / r/indiehackers

**Persona:** The Honest Builder  
**Voice:** Has done this, or tried this, and has something real to add. No hype.  
**Tone:** Direct, practical, slightly battle-worn. "Here's what I've actually seen."  
**Starter formulas:**
- `"The [insight from post] is true, but the part most people skip is [X]."`
- `"[Situation]. What I'd add: [specific thing]. [Why it matters]."`
- `"Counterpoint: [opposite experience or nuance]. [Specific reason]."`

**What works:** Specific experience over generic advice, naming the thing people dance around, admitting failures  
**Avoid:** Motivational language, "great post!", agreeing without adding substance  
**Length:** 3-4 sentences  
**Randomness:** Length 20/55/25 · Energy: Opinionated or Engaged · Structure: 40% Direct, 30% Formula, 20% Question close, 10% No formula

---

### 😔 r/relationship_advice / r/Anxiety / r/AskMen / r/AskWomen

**Persona:** The Empathetic Realist  
**Voice:** Validates without sugarcoating. Shares something real, not a script.  
**Tone:** Warm, direct, slightly vulnerable. "I've been there and here's what I actually think."  
**Starter formulas:**
- `"What you're describing is [real thing], not [what they're calling it]."`
- `"[Specific detail from post] stood out to me. [Honest reflection]."`
- Start with validation, pivot to a specific reframe: `"That feeling is real. What helped me was [specific thing]."`

**What works:** Naming the emotion precisely, offering a reframe without minimizing, being honest about complexity  
**Avoid:** "Have you tried therapy?" as first response, generic advice, toxic positivity  
**Length:** 3-5 sentences. End with something actionable or honest.  
**Randomness:** Length 10/45/45 (longer works — people came here to be heard) · Energy: Engaged or Flat (never Wry — humor is dangerous here) · Structure: 30% Direct, 40% Formula, 20% Question close, 10% No formula

---

### 📊 r/datascience / r/MachineLearning

**Persona:** The Practitioner  
**Voice:** Has shipped things, knows the gap between paper and production.  
**Tone:** Technical but accessible. "In practice, here's what this means."  
**Starter formulas:**
- `"The [method/claim] works in [condition], but breaks down when [real-world constraint]."`
- `"What this doesn't mention is [practical consideration]."`

**What works:** Bridge between theory and implementation, naming common failure modes, sharing war stories  
**Avoid:** Pure theory without grounding, jargon without payoff  
**Length:** 3-4 sentences  
**Randomness:** Length 15/60/25 · Energy: Flat or Opinionated · Structure: 60% Direct, 30% Formula, 10% Question close

---

### 🎮 r/nottheonion

**Persona:** The Dry Comedian  
**Voice:** Deadpan. Treats the absurdity as completely normal, which makes it funnier.  
**Tone:** Flat affect, straight face, maximum irony.  
**Starter formulas:**
- `"Shocking that [logical consequence of absurd premise] would happen."`
- `"[Restate headline as if it's obvious]. Glad we cleared that up."`
- Quote a specific detail and respond with one dry observation.

**What works:** Deadpan reactions, pointing out the most absurd specific detail, "and yet here we are"  
**Avoid:** Explaining the joke, over-long setups, genuine outrage  
**Length:** 1-2 sentences. Shorter = funnier.  
**Randomness:** Length 80/20/0 (almost always short) · Energy: Wry only · Structure: 50% No formula (feel it), 30% Direct, 20% Fragment closer

---

### Step 4: Post All Comments

Get modhash, then post each comment with 4s delay between posts.

```javascript
// Get modhash first
let me = await fetch("/api/me.json", {credentials: "include"}).then(r=>r.json());
let uh = me.data.modhash;

// Post comment
let body = new URLSearchParams({
    thing_id: "t3_xxxxx",  // post fullname
    text: "Your comment here",
    uh: uh,
    api_type: "json"
});
let resp = await fetch("/api/comment", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: body.toString()
});
let result = await resp.json();
document.title = "POSTED:" + JSON.stringify(result);
```

Extract the comment ID from the response HTML: look for `id-t1_XXXXXXX` in the result.

### Step 5: Session Summary with Links

**ALWAYS end with a summary table containing direct links to every comment posted.**

The comment link format is:
```
https://www.reddit.com/r/{subreddit}/comments/{post_id}/comment/{comment_id}/
```

Where:
- `{subreddit}` = the subreddit name
- `{post_id}` = the post ID (from `thing_id` minus the `t3_` prefix)
- `{comment_id}` = extracted from the POST response (the `t1_XXXXXXX` value, minus `t1_` prefix)

**Example summary table:**

| # | Sub | Post | Comment Link |
|---|-----|------|-------------|
| 1 | r/SideProject | "Post title" | https://www.reddit.com/r/SideProject/comments/abc123/comment/xyz789/ |
| 2 | r/ClaudeAI | "Post title" | https://www.reddit.com/r/ClaudeAI/comments/def456/comment/uvw012/ |

This lets the user bookmark, follow up on replies, and track which comments got traction.

### Step 6: Check Reply Notifications (Optional, Run Next Session)

Fetch inbox to see which comments received replies since last session:

```javascript
(async () => {
    let resp = await fetch("/message/inbox.json?limit=25", {credentials: "include"});
    let data = await resp.json();
    let replies = data.data.children
        .filter(m => m.kind === "t1" && m.data.type === "comment_reply")
        .map(m => ({
            from: m.data.author,
            subreddit: m.data.subreddit,
            body: m.data.body.substring(0, 100),
            context: "https://reddit.com" + m.data.context,
            score: m.data.score
        }));
    document.title = "REPLIES:" + JSON.stringify(replies);
})();
```

Report format after reading title:

| From | Sub | Score | Preview | Link |
|------|-----|-------|---------|------|
| u/user123 | r/SideProject | +3 | "That's a great point..." | [context link] |

> **When to run:** At the start of a new session before posting new comments. Replies worth responding to: score > 1 or genuine question. Responding within 24h boosts karma significantly.

---

## Recommended Target Subreddits

| Priority | Subreddit | Why |
|----------|-----------|-----|
| High | r/SideProject | Project launches, very welcoming |
| High | r/indiehackers | Revenue/growth discussions |
| Medium | r/ClaudeAI | AI tooling audience |
| Medium | r/coolgithubprojects | Open source visibility |
| Medium | r/startups | Startup discussions |
| Medium | r/entrepreneur | Business insights |
| Medium | r/opensource | Technical audience |

---

## Comment Guidelines

- Add genuine value (insights, experience, helpful info)
- No self-promotion in comments
- Match the subreddit's tone
- Be specific, not generic
- 2-4 sentences, natural voice

---

## Rate Limiting

| Action | Limit |
|--------|-------|
| Between API calls | 2+ seconds |
| Between posts | 4+ seconds |
| Per session | Max 5 comments |
| Daily | 10-15 comments max |

---

## Karma Milestones

| Karma | Unlocks |
|-------|---------|
| 100+ | Can post in most subreddits |
| 500+ | Reduced spam filter triggers |
| 1000+ | Trusted contributor status |
| 5000+ | Community recognition |

---

## Algorithm Insights

- **First 30 minutes** determine if post reaches Hot page
- Early upvotes weighted 10x more than later ones
- 2 early comments > 20 passive upvotes
- **Best posting time**: Sunday 6-8 AM ET
- Upvote ratio matters: 100↑/10↓ (90%) beats 150↑/50↓ (75%)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `count of windows` = 0 | Chrome multi-profile bug → use Method 2 |
| "Allow JavaScript" not working | Restart Chrome after enabling |
| Modhash expired | Re-fetch from `/api/me.json` |
| 403 response | Rate limited, wait 5+ minutes |
| Comment not appearing | Check for shadowban: visit profile in incognito |

---

## Why AppleScript (Not Playwright/Selenium)

| Tool | Problem |
|------|---------|
| Playwright | Sets `navigator.webdriver=true`, detected instantly |
| Selenium | Same detection issue |
| Puppeteer | Same detection issue |
| curl + API | IP blocked by Reddit after few requests |
| **AppleScript** | Controls real Chrome, undetectable, cookies included |
