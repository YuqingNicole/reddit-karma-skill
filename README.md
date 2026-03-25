# Reddit Karma Skill Pack

> Nicole 的 Reddit 养号工具包 — 三个 skill 合集

---

## 包含内容

| Skill | 说明 | 文件 |
|-------|------|------|
| 📈 Reddit Cultivate | 用真实 Chrome 控制发评论，AppleScript 方案，绕过反爬 | [skills/reddit-cultivate.md](skills/reddit-cultivate.md) |
| 📊 Reddit Performance | 基于真实数据的 subreddit 表现复盘 + 选帖策略 | [skills/reddit-performance.md](skills/reddit-performance.md) |

---

## 快速上手

### 1. 发评论（推荐方式）

浏览器登录 Reddit 后，用浏览器内 API 发：

```javascript
// 获取 modhash
const me = await fetch('/api/me.json', {credentials: 'include'}).then(r => r.json());
const modhash = me.data.modhash;

// 发评论
const form = new URLSearchParams({
  api_type: 'json',
  thing_id: 't3_POST_ID',
  text: '你的评论内容',
  uh: modhash,
});
const resp = await fetch('/api/comment', {
  method: 'POST', credentials: 'include',
  headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-Modhash': modhash},
  body: form.toString()
});
const data = await resp.json();
console.log(data.json.data.things[0].data.id); // comment id
```

### 2. 选帖标准

```
✅ 帖子年龄 < 8h
✅ score > 50
✅ 评论数 < 300
✅ 有情感/故事性 或 争议性观点
```

### 3. 优先 subreddit（按 avg karma 排序）

| Subreddit | avg score | 策略 |
|-----------|-----------|------|
| r/AskReddit | **7.7** | 第一人称体验 + 反转结尾 |
| r/technology | **3.7** | 反驳主流叙事，有具体论据 |
| r/todayilearned | **3.3** | 补充第二层冷知识 |
| r/Showerthoughts | 1.5 | 精准的洞察句 |
| r/cats / r/aww | 1.1 | 量大，适合养号 |

---

## Karma 进度

| 日期 | karma | 里程碑 |
|------|-------|--------|
| 2026-03-22 | 4 | 启动 |
| 2026-03-23 | 13 | 首个爆款 +65（AskReddit） |
| 2026-03-24 | 98 | 快速增长 |
| 2026-03-25 | 101+ | 破百 ✅ |

---

*账号：Puzzled-Hedgehog4984 | 目标：karma 1000+*
