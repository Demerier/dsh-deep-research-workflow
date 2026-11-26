# dsh-deep-research-workflow

[![npm](https://img.shields.io/npm/v/dsh-deep-research-workflow.svg)](https://www.npmjs.com/package/dsh-deep-research-workflow)
[![test](https://github.com/Demerier/dsh-deep-research-workflow/actions/workflows/test.yml/badge.svg)](https://github.com/Demerier/dsh-deep-research-workflow/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

给 DeepSeek Harness 的六相研究工作流。把"帮我查透这件事"变成一条可复现的生产线：先拆题，再并行取证，然后缺口回补，最后由单一写手产出带引用的报告，并由独立评审挑错。

移植自 **MiMo Code** 的内置工作流 `deep-research`（MIT，小米）。来源与逐项出处见 [NOTICE.md](NOTICE.md)，代码映射见 [CREDITS.md](CREDITS.md)。

---

## 它解决什么问题

1. **一次搜索不够**：宽问题需要多个角度分头取证，而不是在同一串关键词上反复换措辞。
2. **报告会编**：模型容易在没读过的页面上生成引用。本插件让每个 `[n]` 必须指向真正读过的来源，否则审计判失败。
3. **长任务会跑偏**：角度数、查询数、来源数都有代码级上限，模型不能自行扩张，也不能跳过阶段。

## 不适合什么

- **单点查证**：一次 `web_search` 就够，别开六相。
- **精确事实核查**：那是逐条判定真伪的活，用 `deep_research_jury` 或专门的核查流程。
- **需要人实时拍板的探索**：本流程假设无人值守推进到报告。

## 安装

```bash
dsh plugin --profile <你的profile> add dsh-deep-research-workflow
```

开发用本地链接：

```bash
dsh plugin --profile <你的profile> add link:/abs/path/to/dsh-deep-research-workflow
```

重启 DSH 后生效：新增九个 `deep_research_*` 工具，以及一段说明六相的工作流提示词。

## 五分钟上手

对 DSH 说：

> 用 deep_research 查一下「DSH 的 tools.pre-execute 与 tools.guard 谁先执行、能否被后续插件覆盖」，depth=standard。

它会依次找你确认或直接推进：

| 步 | 你会看到 | 说明 |
|---|---|---|
| 1 | `runId` 与 brief 提示词 | 确定范围、假设、边界 |
| 2 | 角度清单 | 3–5 个互不重叠的取证方向 |
| 3 | 并行子任务 | 每个角度一个 subagent，各自写 `findings/F{n}.md` |
| 4 | 缺口清单 | 哪些结论只有单一来源 |
| 5 | `REPORT.md` | 按主题组织、逐句带 `[n]` |
| 6 | `REVIEW.md` | 引用审计结果与待修项 |

产物在 `~/.dsh/deep-research/runs/<runId>/`，随时可回头看。

## 给 agent 的契约

完整版见 [docs/agent-guide.md](docs/agent-guide.md)。速查：

| 工具 | 用途 | 关键约束 |
|---|---|---|
| `deep_research_start` | 建 run，定 depth，给 brief 提示词 | 返回 `runId`，后续所有调用都带它 |
| `deep_research_record` | 写某个阶段的产物 | `slot` 取 `brief` / `plan` / `finding` / `reflect` / `report` / `review` |
| `deep_research_plan` | 给规划提示词与角度上限 | 未写 brief 时抛错 |
| `deep_research_angle` | 给待研究角度的锁定提示词 | 已有 findings 的角度不会重派 |
| `deep_research_reflect` | 给缺口检查提示词 | 没有任何 findings 时抛错 |
| `deep_research_write` | 给单写手报告提示词 | 附带已知缺口与待解问题 |
| `deep_research_review` | 机器引用审计 + 冷评审提示词 | 有阻断问题时会给 fix 提示词 |
| `deep_research_status` | 看相进度、预算、缺口、审计结论 | 不带 `runId` 时列最近运行 |
| `deep_research_jury` | 3 票制投票 | 2 票否决即删，有效票不足 2 票不作数 |

三条硬规则，违反会被拒：

1. **顺序不可跳**：Brief → Plan → Research → Reflect → Write → Review。
2. **产物必须先落盘**：没有 `findings/F{n}.md` 就不许写报告。
3. **引用必须可追溯**：报告的 `[n]` 必须对应 `## Sources` 条目，且该 URL 出现在某个 findings 文件里。

## 六相状态机

```text
Brief ──► Plan ──► Research ──► Reflect ──► Write ──► Review
  │         │          │            │          │          │
brief.md  plan.json  findings/   reflect.json REPORT.md REVIEW.md
```

任意一步中断，重跑时会从已存在的文件继续，不会重复派发已完成的角度。

## 硬上限

| depth | 角度数 | 每角度查询 | 补角度 | 来源上限 |
|---|---|---|---|---|
| `quick` | 3 | 4 | 0 | 8 |
| `standard` | 5 | 6 | 3 | 15 |
| `deep` | 8 | 8 | 4 | 25 |

超出部分被截断，并记录在 `run.json` 的 `trimmed` 字段。数值与上游一致。

## findings 格式

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
- <白试过的查询或来源>

## Suggested follow-ups
- <最多 3 条更窄的问题，或 none>
```

写入时会严格校验：缺 `url`、`source_type` 不在枚举、缺 `Dead ends` 段，一律拒收并返回具体原因。

## 三层质量闸门

| 闸门 | 谁执行 | 拦截什么 |
|---|---|---|
| 格式校验 | 代码 | 字段缺失、来源类型非法、条目为空 |
| 引用审计 | 代码 | 虚构引用、指向未读来源、缺 Sources 段、单源结论过多 |
| 冷评审 | 模型 | 结论强度超过证据、摘要与正文不一致 |

## 配置

`cordis.patch.yml` 可调：

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `dataDir` | `~/.dsh/deep-research` | 运行目录 |
| `defaultDepth` | `standard` | 未显式指定时用的档位 |
| `maxRuns` | `20` | 保留最近多少次运行 |

## 运行目录

```text
~/.dsh/deep-research/
├── log.jsonl
└── runs/<runId>/
    ├── run.json
    ├── brief.md
    ├── plan.json
    ├── findings/F1.md …
    ├── reflect.json
    ├── REPORT.md
    └── REVIEW.md
```

## 与上游的差异

| 维度 | MiMo Code | 本仓库 |
|---|---|---|
| 编排 | 沙箱 JS 脚本直接派子 agent | 工具序列 + 文件检查点，子 agent 由宿主 `subagent` 派发 |
| 硬上限 | 脚本常量 | 同数值，集中在 `lib/budget.js` |
| findings 校验 | 提示词约束 | 代码严格校验 |
| 引用审计 | 评审 agent 抽查 | 机器集合比对 + 评审提示词 |

## 开发

```bash
node test/run.mjs     # 17 项离线回归，零网络
```

CI 在 Node 20 / 22 / 24 上跑同一套用例。

## 文档

| 文件 | 读者 | 内容 |
|---|---|---|
| 本文件 | 用户 | 是什么、怎么装、怎么用 |
| [docs/agent-guide.md](docs/agent-guide.md) | agent 与插件作者 | 工具契约、状态机、错误语义、断点续跑 |
| [docs/design.md](docs/design.md) | 维护者 | 为什么这样拆、哪些没搬 |
| [NOTICE.md](NOTICE.md) | 法务与复核者 | 上游来源、许可、借用范围 |
| [CREDITS.md](CREDITS.md) | 复核者 | 上游代码与本仓库文件的逐项映射 |

## 许可

MIT，见 [LICENSE](LICENSE)。上游 MiMo Code 同为 MIT，Copyright (c) 2026 Xiaomi。
