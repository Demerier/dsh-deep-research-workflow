// DSH 宿主入口：注册九个工具与一段工作流提示。
import fs from 'node:fs'
import path from 'node:path'
import { defaultRoot } from './workspace.js'
import { registerDeepResearchTools } from './tools.js'
import { DEPTHS } from './budget.js'

export const DEFAULTS = {
  enabled: true,
  dataDir: '',
  defaultDepth: 'standard',
  maxRuns: 20,
}

export function apply(ctx, rawConfig) {
  let logFile = ''
  function log(level, msg) {
    try {
      if (!logFile) return
      fs.mkdirSync(path.dirname(logFile), { recursive: true })
      fs.appendFileSync(logFile, JSON.stringify({ time: Date.now(), level, msg: String(msg) }) + '\n', 'utf8')
      if (fs.statSync(logFile).size > 256 * 1024) {
        const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
        fs.writeFileSync(logFile, lines.slice(-150).join('\n') + '\n', 'utf8')
      }
    } catch {}
  }

  try {
    const input = { ...DEFAULTS, ...(rawConfig ?? {}) }
    const config = {
      enabled: input.enabled !== false,
      dataDir: typeof input.dataDir === 'string' ? input.dataDir.trim() : '',
      defaultDepth: DEPTHS[input.defaultDepth] ? input.defaultDepth : 'standard',
      maxRuns: Number.isInteger(input.maxRuns) ? Math.max(1, Math.min(200, input.maxRuns)) : 20,
    }
    const root = defaultRoot(config)
    fs.mkdirSync(root, { recursive: true })
    logFile = path.join(root, 'log.jsonl')
    log('info', 'deep-research ready at ' + root + ' depth=' + config.defaultDepth)

    let active = true
    ctx.effect(() => () => { active = false }, 'deep-research.state')

    // 工具注册先于提示词：提示词侧的任何异常都不允许连累九个工具。
    if (typeof ctx.inject === 'function') {
      ctx.inject(['tools'], (toolCtx) => {
        try {
          const service = toolCtx && toolCtx.tools
          if (!active || !service || typeof service.register !== 'function') return
          const owner = toolCtx && typeof toolCtx.effect === 'function' ? toolCtx : ctx
          const disposers = registerDeepResearchTools(service, { config, log, root })
          owner.effect(() => () => {
            for (const dispose of disposers.reverse()) {
              try { dispose() } catch {}
            }
          }, 'deep-research.tools')
          log('info', 'registered ' + disposers.length + ' tools')
        } catch (error) {
          log('warn', '注册工具失败：' + String(error?.message ?? error))
        }
      })
    }

    // systemPrompt 是服务：必须走 inject。直接在 ctx 上读会被 cordis 拒绝
    // （0.1.2 就在这里抛错，被末尾的 catch 吞掉，九个工具一个都没注册）。
    if (typeof ctx.inject === 'function') {
      ctx.inject(['systemPrompt'], (promptCtx) => {
        try {
          if (!active) return
          const owner = promptCtx && typeof promptCtx.effect === 'function' ? promptCtx : ctx
          owner.effect(() => promptCtx.systemPrompt.section({
            name: 'research:deep',
            order: 32,
            interpolate: false,
            text: [
              '【deep-research 工作流】',
              '宽问题且需要成文报告时按六相推进，不要用一次 web_search 冒充深挖：',
              '1 Brief → 2 Plan → 3 Research（每个角度一个 subagent，并行）→ 4 Reflect → 5 Write（单一写手）→ 6 Review（含机器引用审计）。',
              '硬上限由代码执行：角度数、查询数、delta 角度、来源数按 depth 固定，超出会被拒收。',
              '每相产物用 deep_research_record 落盘；文件即检查点，重跑会自动跳过已完成相。',
              '报告里每个非显然结论必须带 [n]，且 [n] 的 URL 必须出现在某个 findings 文件里，否则 deep_research_review 判为阻断。',
              '不确定的结论用 deep_research_jury 投票：3 票中 2 票否决即删，有效票不足 2 票不作数。',
            ].join('\n'),
          }), 'deep-research.section')
          log('info', 'mounted research:deep prompt section')
        } catch (error) {
          log('warn', '提示词段挂载失败：' + String(error?.message ?? error))
        }
      })
    }
  } catch (error) {
    log('warn', '初始化失败：' + String(error?.message ?? error))
  }
}
