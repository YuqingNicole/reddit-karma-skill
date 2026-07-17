# Reddit Karma Skill Pack

> Nicole 的 Reddit 养号工具包 — 三个 skill 合集

---

## 包含内容

| Skill | 说明 | 文件 |
|-------|------|------|
| 📝 Reddit Post | 用真实 Chrome 发帖到任意 subreddit，支持文字/链接帖 | [skills/reddit-post.md](skills/reddit-post.md) |
| 📈 Reddit Cultivate | 自动找热帖发评论，AppleScript 方案，绕过反爬 | [skills/reddit-cultivate.md](skills/reddit-cultivate.md) |
| 📊 Reddit Performance | 基于真实数据的 subreddit 表现复盘 + 选帖策略 | [skills/reddit-performance.md](skills/reddit-performance.md) |
| 🖥️ Backend CLI | 把上面三个 skill 的操作固化成命令行工具，同样走真实 Chrome，自带限流 + 发帖预览 | [cli/README.md](cli/README.md) |

---

## 后端 CLI（cli/reddit_cli.py）

不想每次手动拼 `osascript`？用命令行工具，一条命令搞定。macOS + 已登录 Reddit 的 Chrome，纯 Python 标准库，无需 API token：

```bash
chmod +x cli/reddit_cli.py
ln -sf "$PWD/cli/reddit_cli.py" /usr/local/bin/reddit-cli   # 可选：加入 PATH

reddit-cli karma                                  # 查 karma + 登录检查
reddit-cli scan AskReddit --sort rising --limit 10 # 扫热帖（带 t3_ id）
reddit-cli rules AskReddit                        # 看发帖限制
reddit-cli top AskReddit 1saopui                  # 热评（带 t1_ id）
reddit-cli comment t3_POSTID "评论内容" --yes       # 发评论（默认先预览确认）
reddit-cli post SideProject --title "标题" --text "正文" --yes
reddit-cli inbox                                  # 回复通知
reddit-cli roi --limit 100                        # 各 sub ROI 复盘
```

限流内置：每天最多 15 条评论 / 1 条跨 sub 帖，评论间隔 ≥2s、发帖间隔 ≥4s，状态存在 `~/.reddit-cli/state.json`。写操作(comment/post)默认先打印预览再确认，非交互环境需显式 `--yes`。详见 [cli/README.md](cli/README.md)。

---

## 快速上手

### 发帖（reddit-post）

```javascript
// 在 reddit.com 页面的浏览器 console 里执行
const me = await fetch('/api/me.json', {credentials: 'include'}).then(r => r.json());
const uh = me.data.modhash;

const body = new URLSearchParams({
  sr: 'SideProject',      // subreddit（不含 r/）
  kind: 'self',           // 'self'=文字帖 'link'=链接帖
  title: '标题',
  text: '正文（支持 markdown）',
  uh, api_type: 'json', resubmit: 'true'
});
const resp = await fetch('/api/submit', {
  method: 'POST', credentials: 'include',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: body.toString()
});
const data = await resp.json();
console.log(data.json.data.url); // 帖子链接
```

### 发评论（reddit-cultivate）

```javascript
const me = await fetch('/api/me.json', {credentials: 'include'}).then(r => r.json());
const uh = me.data.modhash;

const form = new URLSearchParams({
  api_type: 'json', thing_id: 't3_POST_ID',
  text: '评论内容', uh,
});
const resp = await fetch('/api/comment', {
  method: 'POST', credentials: 'include',
  headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-Modhash': uh},
  body: form.toString()
});
```

---

## 选帖标准

```
✅ 帖子年龄 < 8h
✅ score > 50
✅ 评论数 < 300
✅ 有情感/故事性 或 争议性观点
❌ 避免纯技术问答（容易被专业人士秒杀）
❌ 避免新闻转发帖（同质化严重）
```

---

## Subreddit 优先级（按 avg karma 排序）

| Subreddit | avg score | 策略 |
|-----------|-----------|------|
| r/AskReddit | **7.7** | 第一人称体验 + 反转结尾，2-4句 |
| r/technology | **3.7** | 反驳主流叙事，有具体论据 |
| r/todayilearned | **3.3** | 补充第二层冷知识 |
| r/Showerthoughts | 1.5 | 精准的洞察句 |
| r/ClaudeAI | 1.0 | 只在有独特视角时发 |
| r/cats / r/aww | 1.1 | 量大，适合养号 |

**发帖首选**：r/SideProject、r/coolgithubprojects、r/indiehackers、r/opensource

---

## 写评论技巧（从高分复盘）

1. **第一人称 + 具体细节** > 抽象观点
2. **反转结尾** — 开头顺着说，结尾转
3. **一句话能站住脚** — 不展开也是完整观点
4. **不重复 OP 的话** — 加一层信息或角度
5. **控制 2-4 句** — 最高分评论都不长

---

## Karma 进度

| 日期 | karma | 里程碑 |
|------|-------|--------|
| 2026-03-22 | 4 | 启动 |
| 2026-03-23 | 13 | 首个爆款 +65（AskReddit bungee jumping） |
| 2026-03-24 | 98 | 快速增长 |
| 2026-03-25 | 101+ | 破百 ✅ |
| 目标 | 1000 | — |

---

*账号：YOUR_REDDIT_USERNAME*
