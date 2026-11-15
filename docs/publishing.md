# 发布到 npm

包名：`dsh-deep-research-workflow`。本文件是发布细节的唯一入口（README 只链到这里）；设计与流程见 [design.md](design.md)。

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/Demerier/dsh-deep-research-workflow（公开） |
| 当前版本 | 见仓库根 `package.json`（README 不重复写版本号，避免过期） |
| 已发布 | `0.1.0` 起可用；`0.0.0-stage` 是 staged 流程的临时占位版本 |
| 发布 workflow | `.github/workflows/publish.yml` |

## 工作流

`.github/workflows/publish.yml` 有两个入口：

| 入口 | 行为 |
|---|---|
| GitHub Release（published） | 校验 tag 与版本一致 → 跑测试 → 发布 |
| `workflow_dispatch` | 手动；`dry_run` 默认 true，`mode` 选 publish 或 stage |

四道门禁，任一不过即停：

1. `node test/run.mjs` 15 项全绿；
2. Release tag（去 `v` 前缀）等于 `package.json` 的 `version`；
3. npm 上不存在同名同版本（`npm view <name>@<version>` 必须 404）；
4. 私有仓库自动跳过 `--provenance` 并打印原因。

## npm 权限现状（2025-12 之后）

| 事实 | 影响 |
|---|---|
| **Classic token 已永久吊销** | 不要再找 "Automation token"，它不存在了 |
| 只剩 granular access token | 写权限有有效期上限，需要轮换 |
| granular 可选 **stage only** | 只能 `npm stage publish`，正式上线要人工批准 |
| **staged publishing 已 GA** | 新包首次发布常被要求走这条 |
| bypass-2FA 的 granular token 正在收紧 | 长期方案是 OIDC |

## 三种发布方式

### A. Granular token（Read and write，非 stage only）

适用于想直接 CI 发布、且账号允许 bypass 2FA 的情况。

1. npm → Access Tokens → Granular：Packages 选 All packages（首版包不存在时绑不了具体包），Permissions 选 **Read and write**，不要勾 stage only；
2. `gh secret set NPM_TOKEN --repo Demerier/dsh-deep-research-workflow`；
3. `gh workflow run publish -f dry_run=false`。

### B. Staged publishing（人工批准）

适用于 token 只能 stage only，或希望发布有二次确认。

```bash
gh workflow run publish -f dry_run=false -f mode=stage
# 记下日志里的 stage id，然后本地批准（需要 OTP）
npm stage list
npm stage approve <stage-id>
```

批准前注册表里只有 `0.0.0-stage` 占位版本；批准后 `latest` 变成真实版本。

### C. Trusted publishing（OIDC，推荐长期）

无长期密钥，每步由 GitHub 签发短期凭据。

1. 先让包存在（走 A 或 B 发布一次）；
2. npm 包页 → Settings → Trusted publisher → GitHub Actions，填 `Demerier/dsh-deep-research-workflow` 与 `publish.yml`；
3. 删除 `NPM_TOKEN` secret；
4. workflow 已内置 `npm install -g npm@latest`（OIDC 需要 npm ≥ 11.5）。

## 排错

| 报错 | 原因 | 处理 |
|---|---|---|
| `EOTP` | token 需要一次性密码 | 换 granular token 并勾 bypass 2FA，或改走 stage / OIDC |
| `E_STAGE_REQUIRED` | token 是 stage only，包还不存在 | 用 `mode=stage` 先暂存，或换非 stage token |
| `E403 Forbidden` | 权限不足或包名被占 | 核对 token 的包范围与权限 |
| `E404` | 作用域或包名拼错 | 核对 `package.json` 的 `name` |
| tag 与版本不一致 | 手打 tag | `npm version patch` 自动同步两者 |

## 手动发布（不依赖 CI）

```bash
npm login
npm publish          # 会提示 OTP
```
