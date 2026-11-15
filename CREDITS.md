# CREDITS

上游代码与本仓库文件的逐项对应，便于核对来源与改动。

## 相与文件

| 上游 | 本仓库 | 保留 | 改动 |
|---|---|---|---|
| `meta.phases` 六相定义 | `lib/budget.js` `PHASES`、`lib/phases.js` | 相名与顺序 | 增文件检查点判定、跳相拦截 |
| `DEPTH` 常量 | `lib/budget.js` `DEPTHS` | 四个数值逐字一致 | 增越界统计 |
| Brief 相提示词 | `lib/prompts.js` `briefPrompt()` | 不让提问、写假设、四小节 | 末尾改为调用 record 工具 |
| Plan 相与 schema | `lib/prompts.js` `planPrompt()`、`clampAngles` | 七类视角、briefContext、角度硬截断 | schema 改为 JSON 文本约定 |
| `subagentPrompt()` | `lib/prompts.js` `anglePrompt()` | 规则 1–7、findings 格式、Dead ends、follow-ups、"6 条扎实胜过 15 条含糊" | 工具名换成 DSH 的 web_search / web_fetch |
| `parallel(...)` 派发 | `lib/tools.js` `deep_research_angle` | 只派缺 findings 的角度（断点续跑） | 并行由宿主 subagent 执行 |
| Reflect 相 | `lib/prompts.js` `reflectPrompt()`、`clampDelta` | 三类缺口、delta 上限、openQuestions | 同上 |
| Write 相 | `lib/prompts.js` `writePrompt()` | 单一写手、按主题、`[n]` 引用、冲突并列、单源与推测标注、不重新检索 | 去掉 workspace 路径拼接 |
| Review 相 | `lib/cite.js`、`reviewPrompt()` | 无上下文 reviewer、抽查 5 条、critical 计数、fix pass | 引用核对改为代码集合比对 |
| `fact-check.js` 投票 | `lib/jury.js` | `JURY_SIZE 3`、`REJECT_QUORUM 2`、有效票不足不作数 | 仅取聚合，未移植抽取与分组 |

## 术语对照

| 上游 | 本仓库 |
|---|---|
| `agent(prompt)` | 宿主 `subagent` 工具 + 本仓库返回的锁定提示词 |
| `parallel([...])` | 调用方并行派发多个 `deep_research_angle` 结果 |
| `phase("X")` | `markPhase()` + `phaseTable()` |
| `exists()/readFile()/writeFile()/glob()` | `lib/workspace.js` 同名语义函数 |
| `agent(prompt, { schema })` | 工具参数与返回的 JSON schema |

## 上游原话（供核对）

```text
description: "Deep research report generator — brief → plan angles → parallel
sub-agents → reflect → single-writer cited report → cold review.
Convergent (resumable via file checkpoints)."

whenToUse: "Use when the user wants a comprehensive, multi-source investigation
written as a cited Markdown report. Best for broad research questions ... NOT for
simple lookups (single websearch suffices) and NOT for precise fact-checking."
```
