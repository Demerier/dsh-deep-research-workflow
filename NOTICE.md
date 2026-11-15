# NOTICE

本仓库是 **MiMo Code** 内置工作流 `deep-research` 的移植，不是原创设计。本文件管**来源、许可与借用边界**；文件级对应关系在 [CREDITS.md](CREDITS.md)，结构与本文件一一对齐。

## 1. 上游

| 项 | 值 |
|---|---|
| 项目 | MiMo Code |
| 仓库 | https://github.com/XiaomiMiMo/MiMo-Code |
| 被移植文件 | `packages/cli/src/workflow/builtin/deep-research.js`（11,723 字节） |
| 相关文件 | `fact-check.js`（陪审团与预算）、`workflow/builtin.ts`（内置工作流注册表） |
| 默认分支 | `main` |
| 取用日期 | 2026-11-15 |
| 设计说明 | https://mimo.xiaomi.com/blog/mimo-code-long-horizon |
| 官方文档 | https://mimo.xiaomi.com/zh/mimocode/commands |

## 2. 许可与归属

| 项 | 值 |
|---|---|
| 上游许可 | MIT，Copyright (c) 2026 Xiaomi |
| 本仓库许可 | MIT，见 [LICENSE](LICENSE) |
| 归属要求 | 保留上游版权声明与许可全文；衍生作品需说明改动 |
| 商标 | 未使用上游名称、logo 或商标作为本仓库标识 |

## 3. 借用范围

| 上游内容 | 本仓库位置 | 改动 |
|---|---|---|
| 六相流程 Brief / Plan / Research / Reflect / Write / Review | `lib/phases.js`、`lib/prompts.js` | 编排由沙箱脚本改为工具序列，相语义保留 |
| `DEPTH` 预算表 | `lib/budget.js` | 数值逐字保留 |
| 子 agent 锁定提示词（查询预算、抓 3–6 页、来源分级、findings 格式、Dead ends、Suggested follow-ups） | `lib/prompts.js` `anglePrompt()` | 工具名改为 DSH 的 `web_search` / `web_fetch` |
| `findings/F{n}.md` 格式与落盘检查点 | `lib/findings.js`、`lib/workspace.js` | 增加严格解析与校验 |
| `plan.json` / `reflect.json` / `REVIEW.md` 落盘 | `lib/workspace.js` | 增加元信息与保留策略 |
| 报告规则（单一写手、按主题组织、`[n]` 引用、冲突并列、`[single source]` / `[speculative]`） | `lib/prompts.js` `writePrompt()` | 保留 |
| 冷评审（无上下文 reviewer、抽查 5 条、critical 计数、fix pass） | `lib/cite.js`、`lib/prompts.js` `reviewPrompt()` | 引用核对改为代码比对 |
| `fact-check.js` 的 `JURY_SIZE` / `REJECT_QUORUM` | `lib/jury.js` | 仅取投票聚合 |

## 4. 未借用

| 上游内容 | 说明 |
|---|---|
| Max Mode、Goal、Dynamic Workflow 运行时 | 属于宿主推理/运行层，未移植 |
| Memory 的 FTS 实现 | 与研究工作流无直接关系 |
| 源代码文本、logo、商标 | 未复制任何上游源码文本或品牌资产 |

## 5. 本仓库新增

| 文件 | 新增内容 |
|---|---|
| `lib/findings.js` | 严格解析与校验、渲染回环 |
| `lib/cite.js` | 机器引用审计：`[n]` ↔ Sources ↔ findings URL 集合比对 |
| `lib/workspace.js` | 运行目录隔离、检查点判定、`maxRuns` 保留策略 |
| `lib/tools.js` | 九个工具的 DSH 封装、相前置条件、预算汇总 |
| `test/run.mjs` | 15 项离线回归 |

## 6. 核对方式

```bash
curl -s https://api.github.com/repos/XiaomiMiMo/MiMo-Code/contents/packages/cli/src/workflow/builtin/deep-research.js \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(Buffer.from(JSON.parse(s).content,'base64').toString()))" \
  | head -40
```

## 7. 免责

本仓库与小米、MiMo 团队无任何关联，也未获其背书。上游原话见 [CREDITS.md](CREDITS.md) 第 5 节。
