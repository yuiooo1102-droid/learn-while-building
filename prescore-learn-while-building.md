# PreScore: 非程序员的 AI 编程助手实时教学模式

📊 **评分日期:** 2026-03-30

## 总分

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🟡 71/100 — 市场有空间，需要清晰的差异化定位    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

| 维度 | 分数 | 摘要 |
|------|------|------|
| 竞品密度 | 14/20 | 精确赛道竞品极少，但邻近赛道(AI tutor/code explainer)较多 |
| 竞品热度 | 14/20 | 现有竞品规模偏小，无巨头垄断 |
| 市场空白 | 20/25 | "实时边开发边教学"几乎无人做，痛点明确集中 |
| 用户画像 | 10/15 | Vibe coder群体庞大且快速增长，但付费意愿待验证 |
| 差异化潜力 | 13/20 | 实时教学是独特卖点，但大厂可快速跟进 |

---

## 竞品清单

| 名称 | 平台 | 热度 | 一句话总结 |
|------|------|------|-----------|
| [codebase-to-course](https://github.com/zarazhangrui/codebase-to-course) | GitHub (Claude Code skill) | 新项目 | 把代码库变成交互式HTML教程，事后教学，非实时 |
| [GPTutor](https://marketplace.visualstudio.com/items?itemName=gptutor.gptutor) | VS Code Marketplace | 开源，学术论文支持 | AI代码解释工具，hover显示解释，面向开发者 |
| [AI Tutor (VS Code)](https://marketplace.visualstudio.com/items?itemName=LEIUCSD.ai-tutor) | VS Code Marketplace | 小众 | 内联代码注释和解释，面向学习者 |
| [Codebay](https://www.producthunt.com/products/chatcoding) | Product Hunt / 移动端 | 小型创业公司 | 手机上的Python AI tutoring，聊天式学习 |
| [Codelita](https://www.producthunt.com/products/codelita) | Product Hunt / Web | 小型创业公司 | "边做边学"理念，AI个性化反馈，独立平台 |
| [CodeKidz](https://producthunt.com/posts/codekidz) | Product Hunt / Web | 小型创业公司 | AI教师+游戏化编程课，面向儿童 |
| [AI Code Mentor](https://www.producthunt.com/p/ai-code-mentor/ai-code-mentor) | Product Hunt | 小众 | 支持JS/Python/HTML的初学者代码指导 |
| [Cursor](https://cursor.com/) | 桌面端 | 非常热门 | AI编程编辑器，有解释功能但无专门教学模式 |
| [Khanmigo](https://www.khanacademy.org/) | Web | 大平台 | Khan Academy的AI导师，苏格拉底式教学，非编程专用 |
| [CreatiCode XO](https://forum.creaticode.com/topic/1093/creaticode-xo-ai-assistant-explain-to-me) | Web / Scratch | 小众 | Scratch平台的苏格拉底式AI教学助手 |
| [Show HN: AI Assistant Who Won't Write Code](https://news.ycombinator.com/item?id=45070506) | Hacker News | 讨论热度高 | 只给提示不写代码的AI编程助手概念 |

## 用户痛点摘要

- **Reddit**: 非程序员使用AI编程后，无法理解/维护生成的代码；初学者在"完全依赖AI"和"独立学习"之间找不到平衡点；AI生成代码出错时无法debug
- **Hacker News**: "70%问题" — AI能完成70%的工作但剩下的30%需要编程知识；多数开发者认为初学者不应完全依赖AI学习编程；有人呼吁"先学基础再用AI"
- **Product Hunt**: 用户希望"边做边学"而非传统的先理论后实践；对AI tutor的个性化反馈需求强烈
- **VS Code Marketplace**: 开发者希望在IDE内获得代码解释，而非切换到外部工具

## 用户画像分析

- **目标人群**: Vibe coder（非传统程序员，使用AI编程工具构建项目的人群）。包括创业者、产品经理、设计师、学生等
- **使用场景**: 在使用Claude Code/Cursor等AI工具开发项目时，想要理解AI正在做什么、为什么这样做，以便能维护和迭代自己的项目
- **付费意愿**: 中等。学习工具市场竞争激烈，很多免费替代品，但如果能证明"学会后能独立维护项目"的价值，付费意愿会提升
- **市场规模**: 2026年美国92%的开发者使用某种形式的vibe coding；全球AI辅助编程工具市场预计达85亿美元；非程序员使用AI编程的人群正在爆发式增长

## 差异化建议

1. **实时教学面板（核心差异化）** — 在Claude Code开发的同时，在旁边/下方展示"正在做什么"的教学内容。不是事后解释，而是实时同步。这是目前**没有任何产品在做的事情**。具体可以包括：当前步骤的通俗解释、代码概念可视化、"为什么选择这个方案"的决策解释。

2. **渐进式学习路径** — 根据用户的理解程度自适应教学深度。第一次用时解释"什么是变量"，第十次用时解释"为什么用这个设计模式"。跟踪用户的知识图谱，避免重复教学已掌握的内容。

3. **"我来试试"交互模式** — 在AI完成一个步骤后，暂停并给用户一个小挑战：让用户尝试修改某个参数、预测下一步会发生什么、或者在AI给出的选项中做选择。这种交互式学习比被动观看效果好得多，也是与纯AI编程工具的关键差异。

---

Sources:
- [Coursera: Learn to Code with AI](https://www.coursera.org/learn/learn-to-code-with-ai)
- [AI gives nonprogrammers a boost](https://theconversation.com/ai-gives-nonprogrammers-a-boost-in-writing-computer-code-242256)
- [Vibe Coding Explained (Google Cloud)](https://cloud.google.com/discover/what-is-vibe-coding)
- [codebase-to-course (GitHub)](https://github.com/zarazhangrui/codebase-to-course)
- [GPTutor paper](https://arxiv.org/abs/2305.01863)
- [GPTutor VS Code](https://marketplace.visualstudio.com/items?itemName=gptutor.gptutor)
- [AI Tutor VS Code](https://marketplace.visualstudio.com/items?itemName=LEIUCSD.ai-tutor)
- [Codebay (Product Hunt)](https://www.producthunt.com/products/chatcoding)
- [Codelita (Product Hunt)](https://www.producthunt.com/products/codelita)
- [HN: AI Assistant Who Won't Write Code](https://news.ycombinator.com/item?id=45070506)
- [HN: Learn coding in AI era](https://news.ycombinator.com/item?id=46866165)
- [Cursor: The best way to code with AI](https://cursor.com/)
- [Vibe Coding in 2026 (DEV)](https://dev.to/pockit_tools/vibe-coding-in-2026-the-complete-guide-to-ai-pair-programming-that-actually-works-42de)
- [Vibe Coding Bootcamp (ZTM)](https://zerotomastery.io/courses/learn-vibe-coding/)
