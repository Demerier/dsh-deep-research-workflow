// 九个工具：把 MiMo Code 的脚本编排拆成 DSH 可调用的一步步，硬上限仍由代码执行。
import fs from 'node:fs'
import path from 'node:path'
import { depthOf, clampAngles, clampDelta, budgetReport, PHASES } from './budget.js'
import { createRun, openRun, markPhase, writeText, writeJson, readJson, readText, findingFiles, pruneRuns } from './workspace.js'
import { parseFindings, stats as findingStats, renderFindings } from './findings.js'
import { briefPrompt, planPrompt, anglePrompt, reflectPrompt, writePrompt, reviewPrompt, fixPrompt } from './prompts.js'
import { nextAction, phaseTable, gate, gaps, snapshot } from './phases.js'
import { auditCitations, renderReview } from './cite.js'
import { juryReport, JURY_SIZE, REJECT_QUORUM } from './jury.js'

const text = (v) => [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }]
const today = () => new Date().toISOString().slice(0, 10)
const obj = (props) => ({ type: 'object', properties: props })

export function registerDeepResearchTools(service, deps) {
  const { config, log, root } = deps
  const disposers = []
  const getRun = (id) => {
    if (!id) throw new Error('需要 runId：先调用 deep_research_start')
    return openRun(root, id)
  }

  disposers.push(service.register({
    name: 'deep_research_start',
    description: 'Phase 1 of the deep-research workflow: create an isolated run directory, fix the budget for the chosen depth, and return the brief prompt. Next: write brief.md through deep_research_record(slot="brief").',
    parameters: {
      question: { type: 'string', required: true, description: 'The research question, verbatim from the user.' },
      depth: { type: 'string', description: 'quick | standard | deep. Defaults to plugin config.' },
      context: { type: 'string', description: 'Optional requester context passed into the brief step.' },
    },
    output: { schema: obj({ runId: { type: 'string' }, dir: { type: 'string' }, depth: { type: 'string' }, budget: { type: 'object' }, briefPrompt: { type: 'string' }, phases: { type: 'array', items: { type: 'object' } } }), render: (_a, v) => text('runId ' + v.runId + ' / depth ' + v.depth + '\n' + v.briefPrompt) },
    execute(args) {
      const depth = depthOf(args.depth ?? config.defaultDepth)
      const run = createRun(root, { question: args.question, depth: depth.name })
      const prompt = briefPrompt({ question: args.question, today: today(), depth: depth.name, context: args.context })
      writeText(run, 'brief.prompt.txt', prompt)
      markPhase(run, 'Brief', 'pending')
      pruneRuns(root, config.maxRuns)
      log?.('info', 'start ' + run.id + ' depth=' + depth.name)
      return { runId: run.id, dir: run.dir, depth: depth.name, budget: depth, briefPrompt: prompt, phases: phaseTable(run) }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_record',
    description: 'Write one artifact of the run: brief, plan, finding, reflect, report or review. Findings are validated against the strict F{n}.md format and rejected when fields are missing. This is the checkpoint mechanism: re-running a phase skips files that already exist.',
    parameters: {
      runId: { type: 'string', required: true },
      slot: { type: 'string', required: true, description: 'brief | plan | finding | reflect | report | review' },
      markdown: { type: 'string', required: true, description: 'File content. For slot=plan/reflect/report/review this is JSON or markdown as documented.' },
      n: { type: 'integer', description: 'Angle index, required when slot=finding.' },
    },
    output: { schema: obj({ ok: { type: 'boolean' }, file: { type: 'string' }, errors: { type: 'array', items: { type: 'string' } }, next: { type: 'object' }, stats: { type: 'object' } }), render: (_a, v) => text(v.ok ? '已写入 ' + v.file + (v.stats ? '；' + JSON.stringify(v.stats) : '') + '\n下一步：' + v.next.phase + ' -> ' + v.next.action : '被拒绝：' + v.errors.join('；')) },
    execute(args) {
      const run = getRun(args.runId)
      const slot = String(args.slot)
      if (slot === 'brief') {
        const bad = gate(run, 'Plan')
        if (!readText(run, 'brief.md') && bad && /\.md/.test(String(bad))) { /* brief 缺失是正常的首写 */ }
        const file = writeText(run, 'brief.md', args.markdown)
        markPhase(run, 'Brief', 'done')
        return { ok: true, file, errors: [], next: nextAction(run) }
      }
      if (slot === 'plan') {
        const bad = gate(run, 'Plan')
        if (bad) return { ok: false, file: '', errors: [bad], next: nextAction(run) }
        let parsed
        try { parsed = JSON.parse(args.markdown) } catch { return { ok: false, file: '', errors: ['plan 必须是 JSON：{"briefContext":"...","angles":[...]}'], next: nextAction(run) } }
        const depth = depthOf(run.meta.depth)
        const angles = clampAngles(parsed.angles, depth)
        if (!angles.length) return { ok: false, file: '', errors: ['angles 为空'], next: nextAction(run) }
        const trimmed = parsed.angles.length > angles.length
        const file = writeJson(run, 'plan.json', { briefContext: String(parsed.briefContext ?? ''), angles })
        markPhase(run, 'Plan', 'done', { angles: angles.length, trimmed })
        return { ok: true, file, errors: [], stats: { angles: angles.length, trimmed }, next: nextAction(run) }
      }
      if (slot === 'finding') {
        const n = Number(args.n ?? 0)
        if (!Number.isInteger(n) || n < 1) return { ok: false, file: '', errors: ['slot=finding 需要整数 n'], next: nextAction(run) }
        const bad = gate(run, 'Research')
        if (bad) return { ok: false, file: '', errors: [bad], next: nextAction(run) }
        const parsed = parseFindings(args.markdown, n)
        if (!parsed.ok) return { ok: false, file: '', errors: parsed.errors, next: nextAction(run) }
        const file = writeText(run, 'findings/F' + n + '.md', args.markdown)
        return { ok: true, file, errors: [], stats: findingStats(parsed), next: nextAction(run) }
      }
      if (slot === 'reflect') {
        const bad = gate(run, 'Reflect')
        if (bad) return { ok: false, file: '', errors: [bad], next: nextAction(run) }
        let parsed
        try { parsed = JSON.parse(args.markdown) } catch { return { ok: false, file: '', errors: ['reflect 必须是 JSON'], next: nextAction(run) } }
        const depth = depthOf(run.meta.depth)
        const deltaAngles = clampDelta(parsed.deltaAngles, depth)
        const file = writeJson(run, 'reflect.json', { deltaAngles, openQuestions: (parsed.openQuestions ?? []).slice(0, 12) })
        markPhase(run, 'Reflect', 'done', { deltaAngles: deltaAngles.length })
        return { ok: true, file, errors: [], stats: { deltaAngles: deltaAngles.length }, next: nextAction(run) }
      }
      if (slot === 'report') {
        const bad = gate(run, 'Write')
        if (bad) return { ok: false, file: '', errors: [bad], next: nextAction(run) }
        const file = writeText(run, 'REPORT.md', args.markdown)
        markPhase(run, 'Write', 'done')
        return { ok: true, file, errors: [], next: nextAction(run) }
      }
      if (slot === 'review') {
        const bad = gate(run, 'Review')
        if (bad) return { ok: false, file: '', errors: [bad], next: nextAction(run) }
        const file = writeText(run, 'REVIEW.md', args.markdown)
        markPhase(run, 'Review', 'done')
        return { ok: true, file, errors: [], next: nextAction(run) }
      }
      return { ok: false, file: '', errors: ['未知 slot：' + slot], next: nextAction(run) }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_plan',
    description: 'Phase 2: return the planning prompt plus the hard angle cap for this run. Record the result with deep_research_record(slot="plan").',
    parameters: { runId: { type: 'string', required: true } },
    output: { schema: obj({ prompt: { type: 'string' }, maxAngles: { type: 'integer' }, next: { type: 'object' } }), render: (_a, v) => text(v.prompt) },
    execute(args) {
      const run = getRun(args.runId)
      const bad = gate(run, 'Plan')
      if (bad) throw new Error(bad)
      const depth = depthOf(run.meta.depth)
      return { prompt: planPrompt({ depth }), maxAngles: depth.angles, next: nextAction(run) }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_angle',
    description: 'Phase 3: return locked sub-agent prompts for angles that have no findings file yet. Dispatch each with the subagent tool, then store the result through deep_research_record(slot="finding", n=...).',
    parameters: { runId: { type: 'string', required: true }, n: { type: 'integer', description: 'Only this angle index.' } },
    output: { schema: obj({ angles: { type: 'array', items: { type: 'object' } }, remaining: { type: 'integer' } }), render: (_a, v) => text(v.angles.map((x) => 'F' + x.n + ' ' + x.angle).join('\n') || '没有待研究角度') },
    execute(args) {
      const run = getRun(args.runId)
      const plan = readJson(run, 'plan.json')
      if (!plan) throw new Error('先完成 Plan')
      const depth = depthOf(run.meta.depth)
      const files = new Set(findingFiles(run))
      const pending = plan.angles.map((angle, i) => ({ n: i + 1, angle })).filter((x) => !files.has('F' + x.n + '.md') && (!args.n || args.n === x.n))
      const out = pending.map((x) => ({ ...x, prompt: anglePrompt({ n: x.n, angle: x.angle, briefContext: plan.briefContext, depth, today: today() }) }))
      writeJson(run, 'angles.pending.json', out.map((x) => ({ n: x.n, angle: x.angle })))
      return { angles: out, remaining: out.length }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_reflect',
    description: 'Phase 4: return the reflection prompt. It looks for brief gaps, single-source claims and source conflicts, and may propose a hard-capped number of delta angles.',
    parameters: { runId: { type: 'string', required: true } },
    output: { schema: obj({ prompt: { type: 'string' }, maxDelta: { type: 'integer' }, gaps: { type: 'array', items: { type: 'string' } } }), render: (_a, v) => text(v.prompt) },
    execute(args) {
      const run = getRun(args.runId)
      const bad = gate(run, 'Reflect')
      if (bad) throw new Error(bad)
      const depth = depthOf(run.meta.depth)
      return { prompt: reflectPrompt({ depth }), maxDelta: depth.deltaAngles, gaps: gaps(run) }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_write',
    description: 'Phase 5: return the single-writer report prompt with the hard citation rules, plus the known gaps the report must state. Record the result with deep_research_record(slot="report").',
    parameters: { runId: { type: 'string', required: true } },
    output: { schema: obj({ prompt: { type: 'string' }, gaps: { type: 'array', items: { type: 'string' } }, openQuestions: { type: 'array', items: { type: 'string' } } }), render: (_a, v) => text(v.prompt) },
    execute(args) {
      const run = getRun(args.runId)
      const bad = gate(run, 'Write')
      if (bad) throw new Error(bad)
      const reflect = readJson(run, 'reflect.json', { openQuestions: [] })
      return { prompt: writePrompt({ today: today(), depth: run.meta.depth, openQuestions: reflect.openQuestions ?? [], gaps: gaps(run) }), gaps: gaps(run), openQuestions: reflect.openQuestions ?? [] }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_review',
    description: 'Phase 6: run the mechanical citation audit (does every [n] resolve to a Source whose URL appears in findings?) and write REVIEW.md, then return the reviewer prompt for the judgement part.',
    parameters: { runId: { type: 'string', required: true } },
    output: { schema: obj({ ok: { type: 'boolean' }, critical: { type: 'integer' }, audit: { type: 'object' }, reviewerPrompt: { type: 'string' }, fixPrompt: { type: 'string' } }), render: (_a, v) => text((v.ok ? '引用审计通过' : '引用审计有 ' + v.critical + ' 个阻断问题') + '\n' + v.reviewerPrompt) },
    execute(args) {
      const run = getRun(args.runId)
      const bad = gate(run, 'Review')
      if (bad) throw new Error(bad)
      const audit = auditCitations(run)
      const file = writeText(run, 'REVIEW.md', renderReview(audit))
      log?.('info', 'audit ' + run.id + ' critical=' + audit.critical)
      return { ok: audit.ok, critical: audit.critical, audit, reviewerPrompt: reviewPrompt({ today: today() }), fixPrompt: audit.ok ? '' : fixPrompt(), file }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_status',
    description: 'Report the run state: which phases are done, budget usage, missing findings, and the mechanical citation verdict. Also lists recent runs when no runId is given.',
    parameters: { runId: { type: 'string' } },
    output: { schema: obj({ runId: { type: 'string' }, phases: { type: 'array', items: { type: 'object' } }, next: { type: 'object' }, budget: { type: 'object' }, gaps: { type: 'array', items: { type: 'string' } }, audit: { type: 'object' } }), render: (_a, v) => text(JSON.stringify(v, null, 2)) },
    execute(args) {
      if (!args.runId) {
        const runs = listRuns(root).slice(0, 10)
        return { runId: '', phases: [], next: { phase: '-', action: '-', detail: runs.length + ' 个运行' }, budget: {}, gaps: runs.map((r) => r.id + ' ' + r.depth + ' ' + String(r.question).slice(0, 40)), audit: {} }
      }
      const run = getRun(args.runId)
      const depth = depthOf(run.meta.depth)
      const s = snapshot(run)
      const used = { angles: readJson(run, 'plan.json', { angles: [] }).angles?.length ?? 0, sources: countUrls(run) }
      const audit = s.report ? auditCitations(run) : null
      return { runId: run.id, phases: phaseTable(run), next: nextAction(run), budget: budgetReport(depth, used), gaps: gaps(run), audit: audit ?? {} }
    },
  }))

  disposers.push(service.register({
    name: 'deep_research_jury',
    description: 'Adversarial vote tally for uncertain claims: 3 voters per claim, 2 reject votes kill it, fewer than 2 valid votes means insufficient. Borrowed from the fact-check workflow.',
    parameters: {
      claims: { type: 'array', items: { type: 'object' }, required: true, description: 'Each item: { claim, url?, verdicts: ["keep"|"reject", ...] }' },
    },
    output: { schema: obj({ total: { type: 'integer' }, kept: { type: 'integer' }, rejected: { type: 'integer' }, pending: { type: 'integer' }, rows: { type: 'array', items: { type: 'object' } } }), render: (_a, v) => text(v.rows.map((r) => r.decision + ' ' + r.keep + '/' + r.reject + ' ' + r.claim).join('\n')) },
    execute(args) {
      return { ...juryReport(args.claims), jurySize: JURY_SIZE, quorum: REJECT_QUORUM }
    },
  }))

  return disposers
}

function countUrls(run) {
  const set = new Set()
  for (const file of findingFiles(run)) {
    const md = readText(run, 'findings/' + file) ?? ''
    for (const m of md.matchAll(/https?:\/\/\S+/g)) set.add(m[0])
  }
  return set.size
}

function listRuns(root) {
  const dir = path.join(root, 'runs')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).map((id) => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, id, 'run.json'), 'utf8')) } catch { return { id, depth: '-', question: '-' } }
  })
}
