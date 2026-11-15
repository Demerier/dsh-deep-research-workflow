# CREDITS

逐相记录本仓库内容来自哪里，便于核对与追责。

## 上游来源

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/XiaomiMiMo/MiMo-Code |
| 文件 | `packages/cli/src/workflow/builtin/deep-research.js`（11,723 字节） |
| 辅助文件 | `packages/cli/src/workflow/builtin/fact-check.js`（陪审团）、`packages/cli/src/workflow/builtin.ts`（注册表） |
| 许可 | MIT，Copyright (c) 2026 Xiaomi |
| 取用 | 2026-11-15，仓库默认分支 `main` |
| 设计说明 | https://mimo.xiaomi.com/blog/mimo-code-long-horizon |

## 逐相映射

| 上游代码 | 本仓库文件 | 保留 | 改动 |
|---|---|---|---|
| `meta.phases` 六相定义 | `lib/budget.js` 的 `PHASES`、`lib/phases.js` | 相名与顺序 | 增加文件检查点判定与跳相拦截 |
| `DEPTH` 常量 | `lib/budget.js` `DEPTHS` | 四个数值逐字一致 | 增加 token 口径与越界统计 |
| `subagentPrompt()` 锁定提示词 | `lib/prompts.js` `anglePrompt()` | 规则 1–7、findings 格式、Dead ends、Suggested follow-ups、"6 条扎实胜过 15 条含糊" | 工具名换成 DSH 的 web_search / web_fetch；末尾改为调用 record 工具 |
| Brief 相提示词 | `lib/prompts.js` `briefPrompt()` | 不让提问、写假设、四个小节 | 增加"用 record 落盘"一行 |
| Plan 相提示词与 schema | `lib/prompts.js` `planPrompt()`、`lib/budget.js` `clampAngles` | 7 类视角清单、briefContext 压缩、角度硬截断 | schema 改为 JSON 文本约定 |
| 并行研究 `parallel(...)` | `lib/tools.js` `deep_research_angle` | 只派没有 findings 文件的角度（断点续跑） | 由宿主 subagent 并行 |
| Reflect 相 | `lib/prompts.js` `reflectPrompt()`、`clampDelta` | 三类缺口、delta 上限、openQuestions | 同上 |
| Write 相 | `lib/prompts.js` `writePrompt()` | 单一写手、按主题组织、`[n]` 引用、冲突并列、`[single source]`/`[speculative]`、不重新检索 | 去掉 workspace 路径拼接，改由运行目录决定 |
| Review 相 | `lib/cite.js`、`lib/prompts.js` `reviewPrompt()` | 无上下文 reviewer、抽查 5 条、critical 计数、fix pass | 引用核对改为代码集合比对 |
| `fact-check.js` 投票 | `lib/jury.js` | `JURY_SIZE 3`、`REJECT_QUORUM 2`、有效票不足不作数 | 只取聚合逻辑，未移植抽取与分组 |

## 未借用的部分

- Max Mode（并行采样 + judge）、Goal（独立验收）、Dynamic Workflow 运行时本身、Memory 的 FTS 实现、MiMo 专有工具语法。这些属于宿主能力，不属于本工作流。
- 上游任何源代码文本、logo、商标。

## 本仓库新增

| 文件 | 新增内容 |
|---|---|
| `lib/findings.js` | 严格解析与校验（缺字段直接拒收）、渲染回环 |
| `lib/cite.js` | 机器引用审计：`[n]` ↔ Sources ↔ findings URL 集合比对，单源统计 |
| `lib/workspace.js` | 运行目录隔离、检查点判定、保留策略 `maxRuns` |
| `lib/tools.js` | 九个工具的 DSH 封装、相前置条件、预算汇总 |
| `test/run.mjs` | 15 项离线回归（含虚构引用检出、越界截断、跳相拦截） |
