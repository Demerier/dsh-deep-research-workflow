# CREDITS

上游代码与本仓库文件的逐项映射，便于核对来源与改动。本文件管**映射与术语**；来源、许可与借用边界在 [NOTICE.md](NOTICE.md)，章节序号与本文件对齐（1 上游 / 2 许可与归属 / 6 核对方式 / 7 免责）。

## 1. 上游

| 项 | 值 |
|---|---|
| 项目 | MiMo Code |
| 仓库 | https://github.com/XiaomiMiMo/MiMo-Code |
| 被移植文件 | `packages/cli/src/workflow/builtin/deep-research.js`（11,723 字节） |
| 相关文件 | `fact-check.js`（陪审团与预算）、`workflow/builtin.ts`（内置工作流注册表） |
| 默认分支 | `main` |
| 取用日期 | 2026-11-15 |

## 2. 许可与归属

| 项 | 值 |
|---|---|
| 上游许可 | MIT，Copyright (c) 2026 Xiaomi |
| 本仓库许可 | MIT，见 [LICENSE](LICENSE) |
| 归属要求 | 保留上游版权声明与许可全文；衍生作品需说明改动 |

## 3. 逐相映射

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

## 4. 术语对照

| 上游 | 本仓库 |
|---|---|
| `agent(prompt)` | 宿主 `subagent` 工具 + 本仓库返回的锁定提示词 |
| `parallel([...])` | 调用方并行派发多个 `deep_research_angle` 结果 |
| `phase("X")` | `markPhase()` + `phaseTable()` |
| `exists()/readFile()/writeFile()/glob()` | `lib/workspace.js` 同名语义函数 |
| `agent(prompt, { schema })` | 工具参数与返回的 JSON schema |

## 5. 上游原话（供核对）

```text
description: "Deep research report generator — brief → plan angles → parallel
sub-agents → reflect → single-writer cited report → cold review.
Convergent (resumable via file checkpoints)."

whenToUse: "Use when the user wants a comprehensive, multi-source investigation
written as a cited Markdown report. Best for broad research questions ... NOT for
simple lookups (single websearch suffices) and NOT for precise fact-checking."
```

## 6. 核对方式

```bash
curl -s https://api.github.com/repos/XiaomiMiMo/MiMo-Code/contents/packages/cli/src/workflow/builtin/deep-research.js \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Buffer.from(JSON.parse(s).content,'base64').toString()))" \
  | head -40
```

## 7. 免责

本仓库与小米、MiMo 团队无任何关联，也未获其背书。
