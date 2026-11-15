# 设计与流程细节

README 只做入口。这里放六相与产物的对应、findings 格式、引用审计规则，以及几个关键取舍和已知限制。

## 1. 六相与产物

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

## 2. findings 文件格式

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

`deep_research_record(slot="finding")` 严格校验：缺 `url`、`source_type` 不在枚举内、`confidence` 缺失、缺 `Dead ends` 段，一律拒收并返回具体错误。理由见第 5 节。

## 3. 引用审计

`deep_research_review` 做机器可判定的部分：

1. 正文每个 `[n]` 必须在 `## Sources` 有对应条目；
2. `## Sources` 每条 URL 必须出现在某个 `findings/F*.md` 里；
3. 统计单源结论数，供 `[single source]` 标注使用。

虚构引用、指向未读来源、缺 Sources 段都会计入 `critical`，并给出 fix pass 提示词。

## 4. 运行目录

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

## 5. 为什么不内联执行搜索

上游是沙箱 JS 脚本，内部可以直接 `agent()`、`parallel()`。DSH 插件没有这些原语：

- 插件不能 spawn 子 agent（那是宿主的 `subagent` 工具）；
- 插件内部调用 `ctx.tools.execute` 需要 step-owned 的 `toolSet`，在工具执行期拿不到稳定值。

因此把流程拆成**工具序列 + 文件检查点**：插件负责硬约束与格式校验，判断交给模型，并行交给宿主 `subagent`。

## 6. 硬上限放在代码里

`lib/budget.js` 的 `DEPTHS` 是常量，`clampAngles` / `clampDelta` 直接截断，超出的部分记进 `run.json.trimmed`。

理由：把"要不要再搜一轮"交给模型协商，结果是长任务里无限扩张。上游注释写得很直白：*enforced by script, not by LLM judgment*。

## 7. findings 严格校验而不是宽容接收

格式不对就拒收，不写入后再纠正。

理由：findings 是下游三个组件（reflect、write、引用审计）的唯一输入。一条缺 URL 的结论会让引用审计产生误判，宁可让调用方重写一次。

## 8. 引用审计：机器的归机器

| 环节 | 谁做 | 为什么 |
|---|---|---|
| `[n]` 是否有对应 Sources 条目 | 代码 | 纯集合比对，模型容易漏 |
| Sources 的 URL 是否出现在 findings | 代码 | 防虚构引用 |
| 单源结论统计 | 代码 | 可复算 |
| 结论是否被来源支持、措辞是否过强 | 模型 | 需要语义判断 |

## 9. 与上游的差异

| 维度 | MiMo Code | 本仓库 |
|---|---|---|
| 编排 | 沙箱 JS 脚本，`agent()`/`parallel()` 直接派子 agent | 工具序列 + 文件检查点，子 agent 由宿主 `subagent` 派发 |
| 硬上限 | 脚本常量 | 同数值，集中在 `lib/budget.js` |
| findings 校验 | 提示词约束 | 代码严格校验，不合规拒收 |
| 引用审计 | 冷评审 agent 抽查 | 机器集合比对 + 评审提示词 |
| 结构化输出 | `agent(prompt, {schema})` | 工具参数与返回的 JSON schema |

## 10. provenance 的自动降级

npm provenance 要求源码仓库公开。`publish.yml` 读 `github.event.repository.private` 决定是否加 `--provenance`，仓库转公开后自动生效，不需要改 workflow。发布流程见 [publishing.md](publishing.md)。

## 未移植的部分

| 上游能力 | 为什么没搬 |
|---|---|
| Max Mode（并行采样 + judge） | 属于宿主推理层，不是工作流 |
| Goal（独立进程验收） | 同上，DSH 应用审批与沙箱表达 |
| Dynamic Workflow 运行时 | 本仓库用工具序列替代 |
| Memory 的 FTS 索引 | 与研究工作流无直接关系 |

## 已知限制

1. **无并发控制**：`deep_research_angle` 返回多个提示词，同时派几个由调用方决定；插件不限制并发，也不排队。
2. **报告长度无上限**：只约束角度与来源数，不约束输出字数。
3. **无成本核算**：不统计 token 消耗，也不据此提前停止。
4. **stage 模式需人工批准**：这是 npm 的设计，不是插件缺陷。
5. **run 目录无锁**：同一 runId 并发写入由调用方避免。
