# dsh-deep-research-workflow

[![test](https://github.com/Demerier/dsh-deep-research-workflow/actions/workflows/test.yml/badge.svg)](https://github.com/Demerier/dsh-deep-research-workflow/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/dsh-deep-research-workflow.svg)](https://www.npmjs.com/package/dsh-deep-research-workflow)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

DeepSeek Harness 的六相深度研究工作流：**Brief → Plan → Research → Reflect → Write → Review**，产出带引用的 `REPORT.md` 与可复核的 `REVIEW.md`。

移植自 **MiMo Code** 内置工作流 `deep-research`（MIT，小米），做了宿主适配与工程加固。授权与逐项出处见 [NOTICE.md](NOTICE.md)，文件级映射见 [CREDITS.md](CREDITS.md)。

## 定位

**是**：把"深挖一个宽问题"变成可复现流程的 DSH 插件。硬上限由代码执行，产物落盘可断点续跑。

**不是**：不是通用搜索，也不是事实核查的替代品。单次查证不用它（一次 `web_search` 就够）；要核对具体断言请用 `deep_research_jury` 或专门的 fact-check 流程。

## 安装

从 npm 安装：

```bash
dsh plugin --profile <你的profile> add dsh-deep-research-workflow
```

开发时用本地链接：

```bash
dsh plugin --profile <你的profile> add link:/abs/path/to/dsh-deep-research-workflow
```

两种方式都读取插件自带的 `cordis.patch.yml`，只插入自己的 host 行。重启 DSH 后九个 `deep_research_*` 工具与工作流提示词段生效。

## 最短跑通

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

第 5 步的提示词用宿主 `subagent` 并行派发，回收后统一在第 6 步入库。相与产物的对应、findings 格式、引用审计规则见 [docs/design.md](docs/design.md)。

## 硬上限（由代码执行）

| depth | 角度数 | 每角度查询 | delta 角度 | 来源上限 |
|---|---|---|---|---|
| `quick` | 3 | 4 | 0 | 8 |
| `standard` | 5 | 6 | 3 | 15 |
| `deep` | 8 | 8 | 4 | 25 |

超出部分截断并记入 `run.json` 的 `trimmed`，不静默丢弃；数值集中在 `lib/budget.js`。

## 文档索引

| 文件 | 内容 |
|---|---|
| [docs/design.md](docs/design.md) | 六相与产物、findings 格式、引用审计、设计取舍、与上游差异、已知限制 |
| [docs/publishing.md](docs/publishing.md) | npm 发布：workflow 门禁、token 现状、三种发布方式、排错 |
| [NOTICE.md](NOTICE.md) | 上游来源、许可与归属、借用范围、未借用项、核对方式 |
| [CREDITS.md](CREDITS.md) | 逐相映射、术语对照、上游原话 |

## 开发与测试

```bash
node test/run.mjs     # 15 项离线回归，零网络
```

CI 在 Node 20 / 22 / 24 矩阵上跑同一套用例（`.github/workflows/test.yml`）。

## 许可

MIT，见 [LICENSE](LICENSE)。上游 MiMo Code 同为 MIT，Copyright (c) 2026 Xiaomi。
