# Agent 手册

面向调用本插件的模型，以及要改这个插件的开发者。**先读契约，再读实现。**

## 1 调用顺序

```text
deep_research_start          → runId
deep_research_record(brief)  → brief.md
deep_research_plan           → 规划提示词 + maxAngles
deep_research_record(plan)   → plan.json
deep_research_angle          → 待研究角度的锁定提示词（可多个，并行派发）
deep_research_record(finding, n) → findings/F{n}.md
deep_research_reflect        → 缺口检查提示词 + maxDelta
deep_research_record(reflect)→ reflect.json
deep_research_write          → 报告提示词（含 rules 与 gaps）
deep_research_record(report) → REPORT.md
deep_research_review         → 机器审计 + 评审提示词
```

跳步会被拒：`plan` 需要 `brief.md`，`finding` 需要 `plan.json`，`report` 需要至少一个 findings，`review` 需要 `REPORT.md`。

## 2 工具契约

### deep_research_start

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `question` | string | 是 | 用户原始问题，不要改写后传入 |
| `depth` | string | 否 | `quick` / `standard` / `deep`，默认取配置 |
| `context` | string | 否 | 额外背景，会进入 brief 提示词 |

返回 `{ runId, dir, depth, budget, briefPrompt, phases }`。副作用：创建运行目录、写 `run.json`、清理超出 `maxRuns` 的旧运行。

### deep_research_record

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `runId` | string | 是 | |
| `slot` | string | 是 | `brief` / `plan` / `finding` / `reflect` / `report` / `review` |
| `markdown` | string | 是 | `plan` 与 `reflect` 要求 JSON 字符串 |
| `n` | integer | `slot=finding` 时必填 | 角度序号，从 1 开始 |

返回 `{ ok, file, errors[], next, stats }`。**校验失败时 `ok=false`、不落盘**，`errors` 是逐条原因，修好后重调即可。

### deep_research_plan / angle / reflect / write / review

都只返回提示词与上限，不产生副作用（`review` 例外，会写 `REVIEW.md`）。拿到提示词后按其中的格式产出内容，再用 `record` 落盘。

| 工具 | 返回 | 注意 |
|---|---|---|
| `plan` | `{ prompt, maxAngles, next }` | 角度超出 `maxAngles` 会被截断 |
| `angle` | `{ angles:[{n, angle, prompt}], remaining }` | 已有 findings 的角度不返回 |
| `reflect` | `{ prompt, maxDelta, gaps }` | delta 角度超出上限会被截断 |
| `write` | `{ prompt, gaps, openQuestions }` | 提示词内含引用硬规则 |
| `review` | `{ ok, critical, audit, reviewerPrompt, fixPrompt }` | `ok=false` 时应先修报告 |

### deep_research_status

不带 `runId` 返回最近运行列表；带上则返回 `{ phases, next, budget, gaps, audit }`。

### deep_research_jury

输入 `claims: [{ claim, url, verdicts: ["keep"|"reject", …] }]`，返回逐条 `{ keep, reject, abstain, valid, decision }`。判定：2 票否决即 `reject`；有效票少于 2 票为 `insufficient`。

## 3 错误语义

| 现象 | 含义 | 处理 |
|---|---|---|
| 工具抛出 `先完成 Brief…` 一类错误 | 阶段前置条件不满足 | 补该阶段，别绕过 |
| `record` 返回 `ok=false` + `errors` | 产物格式不合规 | 按 `errors` 逐条修，不要改 `slot` 重试 |
| `review` 返回 `critical > 0` | 引用层有阻断问题 | 执行 `fixPrompt`，重新 `record(report)` 后再 `review` |
| `angle` 返回空数组 | 所有角度都已有 findings | 进 Reflect |

## 4 断点续跑

文件就是状态。重跑同一 `runId` 时：

- `brief.md` 存在 → 不重写；
- `plan.json` 存在 → 沿用角度；
- `findings/F{n}.md` 存在 → 该角度不再派发；
- `REPORT.md` 存在 → 报告阶段视为完成。

要重做某一相，删对应文件即可，不需要重建 run。

## 5 预算与截断

上限来自 `lib/budget.js`，由代码执行：

| depth | angles | queryBudget | deltaAngles | sources |
|---|---|---|---|---|
| quick | 3 | 4 | 0 | 8 |
| standard | 5 | 6 | 3 | 15 |
| deep | 8 | 8 | 4 | 25 |

截断不会静默：`record(plan)` 的 `stats.trimmed` 与 `run.json` 都会记录。

## 6 引用规则

1. 正文每个 `[n]` 必须在 `## Sources` 有编号相同的条目；
2. 该条目的 URL 必须出现在某个 `findings/F*.md` 中；
3. 只有单一来源支撑的结论标注 `[single source]`，推测标注 `[speculative]`；
4. 来源冲突要并列呈现，不自行裁决。

违反 1 或 2 会被审计判为阻断。

## 7 反模式

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| 跳过 Brief 直接规划 | 角度发散，后续全废 | 先写 brief |
| 用一次 `web_search` 冒充深挖 | 报告缺引用，审计必挂 | 按角度派 subagent |
| 编造 URL | 审计直接拦住 | 只引用真正抓取过的页面 |
| 手动改 findings 的字段名 | 校验拒收 | 用固定字段 |
| 只跑一轮就收工 | 单源结论扎堆 | 走 Reflect 补角度 |
| 在报告里重新检索 | 引用与 findings 脱节 | 写报告阶段禁止检索 |

## 8 最小可运行序列

```text
start({ question: "…", depth: "quick" })
record({ runId, slot: "brief", markdown: "# Research Brief\n## Question\n…" })
plan({ runId })
record({ runId, slot: "plan", markdown: '{"briefContext":"…","angles":["a","b","c"]}' })
angle({ runId })
└─ 对每个 angle 派 subagent，回收 markdown
record({ runId, slot: "finding", n: 1, markdown })
reflect({ runId })
record({ runId, slot: "reflect", markdown: '{"deltaAngles":[],"openQuestions":[]}' })
write({ runId })
record({ runId, slot: "report", markdown })
review({ runId })
```
