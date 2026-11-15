// 相状态机：文件即检查点。任何一步失败，重跑会跳过已完成的相。
import { readText, readJson, findingFiles } from './workspace.js'
import { PHASES } from './budget.js'

export function snapshot(run) {
  const brief = readText(run, 'brief.md')
  const plan = readJson(run, 'plan.json')
  const reflect = readJson(run, 'reflect.json')
  const report = readText(run, 'REPORT.md')
  const review = readText(run, 'REVIEW.md')
  const files = findingFiles(run)
  return {
    brief: !!brief,
    plan: !!(plan && Array.isArray(plan.angles) && plan.angles.length),
    findings: files.length,
    reflect: !!reflect,
    report: !!report,
    review: !!review,
  }
}

export function nextAction(run) {
  const s = snapshot(run)
  if (!s.brief) return { phase: 'Brief', action: 'deep_research_start', detail: '写 brief.md' }
  if (!s.plan) return { phase: 'Plan', action: 'deep_research_plan', detail: '拆角度并写 plan.json' }
  if (s.findings === 0) return { phase: 'Research', action: 'deep_research_angle', detail: '派子 agent 产出 findings/F1.md 起' }
  if (!s.reflect) return { phase: 'Reflect', action: 'deep_research_reflect', detail: '缺口检查，产出 deltaAngles' }
  if (!s.report) return { phase: 'Write', action: 'deep_research_write', detail: '单写手出 REPORT.md' }
  if (!s.review) return { phase: 'Review', action: 'deep_research_review', detail: '冷评审与引用审计' }
  return { phase: 'Done', action: 'deep_research_status', detail: '六相已完成' }
}

export function phaseTable(run) {
  const s = snapshot(run)
  const done = {
    Brief: s.brief,
    Plan: s.plan,
    Research: s.findings > 0,
    Reflect: s.reflect,
    Write: s.report,
    Review: s.review,
  }
  return PHASES.map((name) => ({ name, done: !!done[name] }))
}

/** 相前置条件：不允许跳相。返回值 null 表示可以继续。 */
export function gate(run, phase) {
  const s = snapshot(run)
  if (phase === 'Plan' && !s.brief) return '先完成 Brief：缺少 brief.md'
  if (phase === 'Research' && !s.plan) return '先完成 Plan：缺少 plan.json'
  if (phase === 'Reflect' && s.findings === 0) return '先完成 Research：没有任何 findings 文件'
  if (phase === 'Write' && s.findings === 0) return '先完成 Research：没有任何 findings 文件'
  if (phase === 'Review' && !s.report) return '先完成 Write：缺少 REPORT.md'
  return null
}

export function gaps(run) {
  const plan = readJson(run, 'plan.json', { angles: [] })
  const out = []
  const files = findingFiles(run)
  for (let i = 1; i <= (plan.angles?.length ?? 0); i += 1) {
    if (!files.includes('F' + i + '.md')) out.push('角度 ' + i + ' 没有 findings：' + plan.angles[i - 1])
  }
  return out
}
