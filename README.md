# dsh-deep-research-workflow

DeepSeek Harness 版的 deep-research：**brief → plan angles → 并行 findings → reflect → 单一写手出带引用报告 → 冷评审**。

这是对 **MiMo Code** 内置工作流 `deep-research` 的移植（MIT）。设计、六相流程、预算表与提示词结构来自上游；请先读 [NOTICE.md](NOTICE.md) 与 [CREDITS.md](CREDITS.md)，那里写明了逐项借用范围与本仓库新增的部分。

> 一句话区别：上游把编排写成沙箱里的 JS 脚本；DSH 插件不能自己 spawn 子 agent，所以本仓库把同一套流程拆成**九个工具 + 文件检查点**，硬上限仍然由代码执行，判断仍然由模型做。

## 安装

```bash
# 作为本地 link 装进某个 profile
dsh plugin --profile <你的profile> add link:D:/file/dsh/work/dsh-deep-research
```

或在 profile 的 `package.json` 里加依赖与 bundle 行，然后重启 DSH。仓库自带的 `cordis.patch.yml` 只插入自己的 host 行。

## 六相与九个工具

| 相 | 工具 | 产出（落盘即检查点） |
|---|---|---|
| Brief | `deep_research_start` | `run.json`、`brief.prompt.txt` |
| Plan | `deep_research_plan` + `deep_research_record(slot="plan")` | `plan.json`（角度数被硬性截断） |
| Research | `deep_research_angle` + `deep_research_record(slot="finding", n=…)` | `findings/F{n}.md`（格式不合规拒收） |
| Reflect | `deep_research_reflect` + `deep_research_record(slot="reflect")` | `reflect.json`（delta 角度被硬性截断） |
| Write | `deep_research_write` + `deep_research_record(slot="report")` | `REPORT.md` |
| Review | `deep_research_review` | `REVIEW.md`（机器引用审计 + 评审提示词） |

辅助：`deep_research_status`（相状态、预算使用、缺口、审计结论）、`deep_research_jury`（3 票中 2 票否决）。

## 用法（模型视角）

```text
1. deep_research_start({ question, depth: "standard" })      -> runId + brief 提示词
2. 按提示词写 brief.md，deep_research_record({ runId, slot: "brief", markdown })
3. deep_research_plan({ runId })                              -> 规划提示词与角度上限
   记录：slot="plan"，内容是 {"briefContext":"...","angles":[...]}
4. deep_research_angle({ runId })                             -> 每个角度的锁定提示词
   用 subagent 派发，回收后 slot="finding", n=i, markdown=findings 文件全文
5. deep_research_reflect({ runId })                           -> 缺口检查提示词
   记录：slot="reflect"，内容是 {"deltaAngles":[...],"openQuestions":[...]}
6. deep_research_write({ runId })                             -> 单写手报告提示词（含硬性引用规则）
   记录：slot="report"
7. deep_research_review({ runId })                            -> 机器审计 + 冷评审提示词
```

## 硬上限（由代码执行，不接受协商）

| depth | angles | 每角度查询 | delta 角度 | 来源上限 |
|---|---|---|---|---|
| quick | 3 | 4 | 0 | 8 |
| standard | 5 | 6 | 3 | 15 |
| deep | 8 | 8 | 4 | 25 |

超出部分被截断并记入 `run.json` 的 `trimmed`，不静默丢弃。

## findings 文件格式（严格校验）

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

缺 `url`、来源类型非法、缺 `Dead ends` 段，都会被 `deep_research_record` 拒绝并返回具体错误。

## 引用审计（本仓库新增）

`deep_research_review` 会做机器可判定的部分：

- 正文每个 `[n]` 必须在 `## Sources` 里有对应条目；
- `## Sources` 的每条 URL 必须出现在某个 `findings/F*.md` 里；
- 统计单源结论数量，提示 `[single source]` 标注。

虚构引用、指向未读来源、缺 Sources 段都会计入 `critical`，触发 fix pass 提示词。

## 与上游的差异

| 项 | 上游 MiMo Code | 本仓库 |
|---|---|---|
| 编排 | 沙箱 JS 脚本，`agent()`/`parallel()` 直接派子 agent | 工具序列 + 文件检查点，子 agent 由宿主 subagent 工具派发 |
| 硬上限 | 脚本常量 | 同数值，搬进 `lib/budget.js` |
| findings 校验 | 提示词约束 | 代码严格校验，不合规拒收 |
| 引用审计 | 冷评审 agent 抽查 | 机器审计（集合比对）+ 评审提示词 |
| 结构化输出 | `agent(prompt, {schema})` | 工具参数与返回的 JSON schema |

## 开发

```bash
node test/run.mjs     # 15 项离线回归，零网络
```


## 发布到 npm

仓库带 `.github/workflows/publish.yml`，两种触发方式：

| 触发 | 行为 |
|---|---|
| 发布一个 GitHub Release | 校验 tag 与 `package.json` 版本一致 → 跑测试 → 发布 |
| 手动 `workflow_dispatch` | 默认 `dry_run=true`，只做 `npm publish --dry-run` |

发布前的硬性检查（任一条不过就停）：

1. `node test/run.mjs` 全绿；
2. release tag（去掉前缀 `v`）与 `package.json` 的 `version` 完全相同；
3. npm 上不存在同名同版本（`npm view <name>@<version>` 必须 404）。

### 认证：二选一

**A. NPM_TOKEN（最简单）**

1. npm → Access Tokens → Generate New Token → **Granular Access Token**，权限 `Read and write`，勾选该包；
2. 仓库 → Settings → Secrets and variables → Actions → New repository secret，名字 `NPM_TOKEN`；
3. 若账号开了 2FA，选 **Automation** 类型 token，否则 CI 发布时会被 2FA 卡住。

**B. Trusted publishing（无密钥，推荐长期）**

1. 先手动发布一次，让包在 npm 上存在；
2. npm 包页面 → Settings → **Trusted publisher** → GitHub Actions，填 `Demerier/dsh-deep-research-workflow` 与 workflow 文件名 `publish.yml`；
3. 仓库里不要配 `NPM_TOKEN`，并把 workflow 的 setup-node 后加一步 `npm install -g npm@latest`（trusted publishing 需要 npm ≥ 11.5.1）。

### 关于 provenance

`--provenance` **只对公开仓库有效**。workflow 会自动判断：仓库是 private 时跳过并打印原因；改成 public 后自动加上。

### 发布流程

```bash
npm version patch          # 或 minor / major，自动打 tag
git push --follow-tags
gh release create v0.1.1 --generate-notes   # 触发 publish workflow
```

## 许可

MIT，见 [LICENSE](LICENSE)。上游 MiMo Code 亦为 MIT，Copyright (c) 2026 Xiaomi。
