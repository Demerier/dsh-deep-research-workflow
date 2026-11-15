# dsh-deep-research-workflow

[![test](https://github.com/Demerier/dsh-deep-research-workflow/actions/workflows/test.yml/badge.svg)](https://github.com/Demerier/dsh-deep-research-workflow/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/dsh-deep-research-workflow.svg)](https://www.npmjs.com/package/dsh-deep-research-workflow)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

DeepSeek Harness 的六相深度研究工作流：**Brief → Plan → Research → Reflect → Write → Review**，产出带引用的 `REPORT.md` 与可复核的 `REVIEW.md`。

移植自 **MiMo Code** 内置工作流 `deep-research`（MIT，小米）。设计、预算数值与提示词结构来自上游；本仓库做的是宿主适配与工程加固。授权与逐项出处见 [NOTICE.md](NOTICE.md)，工程映射见 [CREDITS.md](CREDITS.md)。

---

## 这是什么 / 不是什么

**是**：一个把"深挖一个宽问题"变成可复现流程的 DSH 插件。硬上限由代码执行，产物落盘可断点续跑。

**不是**：不是通用搜索，也不是事实核查的替代品。单次查证不要用它（一次 `web_search` 就够）；要核对具体断言请用 `deep_research_jury` 或专门的 fact-check 流程。

## 安装

从 npm 安装（已发布 `0.1.0`）：

```bash
dsh plugin --profile <你的profile> add dsh-deep-research-workflow
```

开发时用本地链接：

```bash
dsh plugin --profile <你的profile> add link:/abs/path/to/dsh-deep-research-workflow
```

两种方式都会读取插件自带的 `cordis.patch.yml`，只插入自己的 host 行。重启 DSH 后九个 `deep_research_*` 工具与工作流提示词段生效。

## 六相流程

| 相 | 工具 | 落盘产物 | 检查点 |
|---|---|---|---|
| Brief | `deep_research_start` | `run.json`、`brief.prompt.txt` | 目录存在即视为已开始 |
| Plan | `deep_research_plan` + `deep_research_record` | `plan.json` | 角度数被硬性截断并记 `trimmed` |
| Research | `deep_research_angle` + `deep_research_record` | `findings/F{n}.md` | 已有文件的角度不再重派 |
| Reflect | `deep_research_reflect` + `deep_research_record` | `reflect.json` | delta 角度被硬性截断 |
| Write | `deep_research_write` + `deep_research_record` | `REPORT.md` | 单一写手，禁止重新检索 |
| Review | `deep_research_review` | `REVIEW.md` | 机器审计 + 冷评审提示词 |

辅助工具：

| 工具 | 用途 |
|---|---|
| `deep_research_status` | 相进度、预算使用、缺口、审计结论 |
| `deep_research_jury` | 3 票制投票，2 票否决即删，有效票不足 2 票不作数 |

## 快速用法

```text
1. deep_research_start({ question, depth: "standard" })        -> runId + Brief 提示词
2. deep_research_record({ runId, slot: "brief", markdown })     -> brief.md
3. deep_research_plan({ runId })                                -> Plan 提示词 + 角度上限
4. deep_research_record({ runId, slot: "plan", markdown: '{"briefContext":"…","angles":[…] }' })
5. deep_research_angle({ runId })                               -> 每个角度的锁定提示词
6. deep_research_record({ runId, slot: "finding", n: 1, markdown })   -> findings/F1.md
7. deep_research_reflect({ runId }) + record(slot="reflect")
8. deep_research_write({ runId })   + record(slot="report")
9. deep_research_review({ runId })                              -> REVIEW.md
```

第 5 步的提示词用宿主 `subagent` 并行派发；回收后统一在第 6 步入库。

## 硬上限（由代码执行）

| depth | 角度数 | 每角度查询 | delta 角度 | 来源上限 |
|---|---|---|---|---|
| `quick` | 3 | 4 | 0 | 8 |
| `standard` | 5 | 6 | 3 | 15 |
| `deep` | 8 | 8 | 4 | 25 |

超出部分截断并记入 `run.json` 的 `trimmed`，不静默丢弃。这套数值与上游一致。

## findings 文件格式

```markdown
# F1: <角度>

## Findings

### [1] <一句话结论>
- quote: "<支撑原文>"
- url: <来源 URL>
- source_type: primary | secondary | community
- published: <日期或 unknown>
- confidence: high | medium | low

## Dead ends
- <白试的查询或来源，一行一条>

## Suggested follow-ups
- <最多 3 条更窄的问题，或 none>
```

`deep_research_record(slot="finding")` 会严格校验：缺 `url`、`source_type` 不在枚举内、`confidence` 缺失、缺 `Dead ends` 段，一律拒收并返回具体错误。

## 引用审计

`deep_research_review` 做机器可判定的部分：

1. 正文每个 `[n]` 必须在 `## Sources` 有对应条目；
2. `## Sources` 每条 URL 必须出现在某个 `findings/F*.md` 里；
3. 统计单源结论数，供 `[single source]` 标注使用。

虚构引用、指向未读来源、缺 Sources 段都会计入 `critical`，并给出 fix pass 提示词。

## 与上游的差异

| 维度 | MiMo Code | 本仓库 |
|---|---|---|
| 编排 | 沙箱 JS 脚本，`agent()`/`parallel()` 直接派子 agent | 工具序列 + 文件检查点，子 agent 由宿主 `subagent` 派发 |
| 硬上限 | 脚本常量 | 同数值，集中在 `lib/budget.js` |
| findings 校验 | 提示词约束 | 代码严格校验，不合规拒收 |
| 引用审计 | 冷评审 agent 抽查 | 机器集合比对 + 评审提示词 |
| 结构化输出 | `agent(prompt, {schema})` | 工具参数与返回的 JSON schema |

## 运行目录

```text
~/.dsh/deep-research/
├── log.jsonl
└── runs/<runId>/
    ├── run.json            # 元信息、相状态、trimmed 记录
    ├── brief.md
    ├── plan.json
    ├── angles.pending.json
    ├── findings/F1.md …
    ├── reflect.json
    ├── REPORT.md
    └── REVIEW.md
```

## 开发与测试

```bash
node test/run.mjs     # 15 项离线回归，零网络
```

CI 在 Node 20 / 22 / 24 矩阵上跑同一套用例（`.github/workflows/test.yml`）。

## 发布

npm 包名 `dsh-deep-research-workflow`。发布流程、token 现状与 OIDC 迁移见 [docs/publishing.md](docs/publishing.md)。

当前状态：`0.1.0` 已发布（2026-11-15）。仓库已转公开，后续版本会自动附带 npm provenance。

## 文档索引

| 文件 | 内容 |
|---|---|
| [NOTICE.md](NOTICE.md) | 上游来源、许可、逐项借用范围、未借用项 |
| [CREDITS.md](CREDITS.md) | 上游代码与本仓库文件的逐相映射 |
| [docs/design.md](docs/design.md) | 设计取舍：为什么拆成工具、检查点如何工作 |
| [docs/publishing.md](docs/publishing.md) | npm 发布：工作流、权限现状、排错 |

## 许可

MIT，见 [LICENSE](LICENSE)。上游 MiMo Code 同为 MIT，Copyright (c) 2026 Xiaomi。