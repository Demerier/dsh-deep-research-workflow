# NOTICE

本仓库是对 **MiMo Code** 内置工作流 `deep-research` 的移植，不是原创设计。

## 上游

| 项 | 内容 |
|---|---|
| 项目 | MiMo Code |
| 仓库 | https://github.com/XiaomiMiMo/MiMo-Code |
| 被移植文件 | `packages/cli/src/workflow/builtin/deep-research.js`（11,723 字节，MIT） |
| 同一套机制的其他文件 | `fact-check.js`（陪审团与预算，部分借鉴）、`workflow/builtin.ts`（内置工作流注册表） |
| 许可 | MIT，Copyright (c) 2026 Xiaomi |
| 设计说明 | https://mimo.xiaomi.com/blog/mimo-code-long-horizon（第 2 节 computation / memory / evolution） |
| 官方文档 | https://mimo.xiaomi.com/zh/mimocode/commands |
| 取用时间 | 2026-11-15 |

## 借用范围（逐项）

| 上游内容 | 本仓库对应 | 改动 |
|---|---|---|
| 六相流程 Brief / Plan / Research / Reflect / Write / Review | `lib/phases.js` 的状态机与提示词 | 编排从沙箱 JS 脚本改为 DSH 工具序列，阶段语义保留 |
| `DEPTH` 预算表（angles / queryBudget / deltaAngles / sources） | `lib/budget.js` 常量 | 数值原样保留，另加 token 口径换算 |
| 子 agent 的锁定提示词结构（查询预算、抓 3–6 页、来源分级、findings 格式、Dead ends、Suggested follow-ups） | `lib/prompts.js` | 保留结构与字段，去掉 MiMo 专有工具名，改为 DSH 的 web_search / web_fetch |
| findings/F{n}.md 文件格式与落盘检查点 | `lib/findings.js` | 增加严格解析与校验，格式不合规直接拒绝写入 |
| plan.json / reflect.json / REVIEW.md 的落盘与断点续跑 | `lib/workspace.js` | 保留 |
| 报告规则（单一写手、按主题而非按文件组织、[n] 引用、冲突并列、[single source] / [speculative] 标注） | `lib/prompts.js` 的 write 段 | 保留 |
| 冷评审（无上下文 reviewer、抽查 5 条引用、critical 计数、fix pass） | `lib/cite.js` 的确定性审计 + reviewer 提示词 | 引用核对改为代码可复算，判断部分仍交给模型 |
| `fact-check.js` 的陪审团（JURY_SIZE 3 / REJECT_QUORUM 2） | `lib/jury.js` | 仅取投票聚合，未移植其抽取与分组 |

## 本仓库新增（上游没有）

- 确定性引用审计：把 REPORT.md 的 [n] 与 findings 里的 URL 集合做集合比对，虚构引用可被机器判定。
- findings 严格校验：字段缺失、来源类型非法、无 URL 的条目直接拒收。
- 双成本口径（分钟 / token）与运行状态汇总。
- 运行目录隔离与保留策略（maxRuns）。

## 不做的事

- 不复制 MiMo Code 的任何源代码文本，只移植流程、预算数值与提示词结构。
- 不包含 MiMo Code 的商标、logo 或其他资产。
- 不声称与小米或 MiMo 团队有任何关联或背书。

## 上游原话（供核对）

```
description: "Deep research report generator — brief → plan angles → parallel
sub-agents → reflect → single-writer cited report → cold review.
Convergent (resumable via file checkpoints)."
```
