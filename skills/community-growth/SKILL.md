---
name: reddit
description: |
  Reddit 社区增长 + 产品推广两套工作流。
 养号：根据 subreddit 表现数据写高质量评论，建立可信贡献历史。
 推广：为 deckcleaner / linkertube 等产品起草透明、规则合规的价值型帖子。
 含规则核验、选帖标准、高分规律、发帖时机、披露与安全 checklist。

  USE WHEN:
  - "帮我写条 Reddit 评论" / "write a Reddit comment"
  - "帮我发个产品帖" / "draft a Reddit post for [product]"
  - "今天发哪些 sub" / "check which subs to post in"
  - "更新 karma 数据" / "karma 现在多少了"
  - "deckcleaner 推广" / "linkertube 发帖"

  DON'T USE WHEN:
  - 用 Reddit 搜索信息 → 用 agent-reach skill
  - 查看某个 sub 的话题趋势 → web_search 直接查
  - 写 Reddit 以外平台的内容 → content-creation skill
---

# Reddit Skill

两个操作：**社区参与**（写有价值的评论，建立可信历史）和**推广**（发透明、规则合规的产品帖）。

## 不可突破的边界

- Reddit 是研究和关系渠道，不是广告分发渠道；先给具体价值、建立信任，再让产品兴趣自然出现。
- 不做马甲、虚构用户故事/成绩、身份伪装、刷票/刷 karma、brigading、ban evasion、批量私信或自动化评论。
- 只使用真实、负责的账号；不以绕过版规或过滤条件为目标。
- 每次推荐 subreddit、评论或发帖前，都要核验**当前**社区规则、置顶帖和 moderator 指引是否允许该内容类型。规则不清、禁止或仅限审批时，明确列为“不可发”，而不是猜测可行角度。
- 推广内容必须真实披露与产品的关系；不能把产品/公司名删除后仍不成立的内容，不应发布。

---

## Operation Routing

| 请求 | 操作 |
|------|------|
| "写条评论" / "帮我回这个帖" | → `cultivate` |
| "帮我写产品帖" / "[产品名] 推广" | → `promote` |
| "今天应该发哪些 sub" / "选帖" | → `cultivate` → 选帖标准 |
| "更新 karma" / "记录一下数据" | → 更新 `references/cultivate.md` 数据表 |

---

## Operation: `cultivate`

目标：为真实问题提供独立成立的具体帮助，逐步建立可信贡献历史；karma 只是副产物，不是 KPI。

**开始前必查：**
1. 核验该 subreddit 对评论、链接、自我推广和 AI 辅助内容的当前规则。
2. 核验帖子/评论区是否有额外限制或 moderator 指示。
3. 若不确定，停止推荐该机会，标记为“规则待人工确认”。

**选帖标准（快查）：**
- 帖子年龄 < 8h
- score > 50
- 评论数 30–500
- 有情感/故事性 或 争议性观点 或 知识性内容

**优先 sub（按 avg score 排序）：** r/AskReddit > r/technology > r/todayilearned > r/interestingasfuck > r/explainlikeimfive

详细 subreddit 数据、写评论技巧、每日上限 → `references/cultivate.md`

---

## Operation: `promote`

目标：为 deckcleaner、linkertube 或新产品起草价值优先、透明披露且经规则核验的产品帖。

**推广前检查（硬性）：**
- [ ] 当前 subreddit 明确允许该内容类型；已记录规则链接/检查时间
- [ ] 标题、正文及评论中如实披露作者与产品的关系
- [ ] 目标 sub 有过非广告评论
- [ ] 删除所有产品/公司提及后，正文仍是完整、有用的贡献（deletion test）
- [ ] 所有数字、案例和体验均可证明；没有虚构用户、结果或故事
- [ ] 发后有时间真诚回复评论

产品帖公式、6 大高分特征、各产品标题模板、发帖时机 → `references/promote.md`

产品具体推广脚本（deckcleaner / linkertube）→ `references/products.md`

---

## 当前状态

| 项目 | 数值 | 更新时间 |
|------|------|---------|
| 账号指标 | 按需实时查询 | 不在 skill 内维护易过期数据 |
| 产品帖状态 | 按产品/社区单独核验 | 不以历史状态替代当前规则 |
