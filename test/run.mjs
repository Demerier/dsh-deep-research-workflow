import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseFindings, renderFindings, stats } from '../lib/findings.js'
import { auditCitations, renderReview } from '../lib/cite.js'
import { tally, juryReport, JURY_SIZE, REJECT_QUORUM } from '../lib/jury.js'
import { depthOf, clampAngles, clampDelta, budgetReport, DEPTHS } from '../lib/budget.js'
import { createRun, openRun, writeText, pruneRuns, findingFiles } from '../lib/workspace.js'
import { registerDeepResearchTools } from '../lib/tools.js'
import { nextAction, gate } from '../lib/phases.js'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-deep-'))
const results = []
const check = (name, fn) => {
  try { fn(); results.push({ name, ok: true }) } catch (e) { results.push({ name, ok: false, why: String(e.message).slice(0, 240) }) }
}

// 假宿主：收集注册的工具定义，供测试直接调用 execute
const registered = new Map()
const service = { register(def) { registered.set(def.name, def); return () => registered.delete(def.name) } }
const disposers = registerDeepResearchTools(service, { config: { defaultDepth: 'standard', maxRuns: 5 }, log: () => {}, root: tmp })
const call = (name, args) => registered.get(name).execute(args)

const FINDING = (n, urls) => [
  '# F' + n + ': angle ' + n,
  '',
  '## Findings',
  '',
  '### [1] claim one about version 1.2 released 2026-03',
  '- quote: "quoted support"',
  '- url: ' + urls[0],
  '- source_type: primary',
  '- published: 2026-03-01',
  '- confidence: high',
  '',
  '### [2] claim two from a discussion thread',
  '- quote: "another quote"',
  '- url: ' + urls[1],
  '- source_type: community',
  '- published: unknown',
  '- confidence: medium',
  '',
  '## Dead ends',
  '- searched "foo bar baz", nothing relevant',
  '',
  '## Suggested follow-ups',
  '- does the 1.3 branch change this?',
  '',
].join('\n')

let runId = ''
check('1 预算表与上游一致', () => {
  assert.deepEqual(DEPTHS.quick, { angles: 3, queryBudget: 4, deltaAngles: 0, sources: 8 })
  assert.deepEqual(DEPTHS.standard, { angles: 5, queryBudget: 6, deltaAngles: 3, sources: 15 })
  assert.deepEqual(DEPTHS.deep, { angles: 8, queryBudget: 8, deltaAngles: 4, sources: 25 })
  assert.equal(clampAngles(['a', 'b', 'c', 'd'], depthOf('quick')).length, 3)
  assert.equal(clampDelta(['a', 'b'], depthOf('quick')).length, 0)
  const br = budgetReport(depthOf('quick'), { angles: 4, sources: 9 })
  assert.equal(br.angles.over, true)
  assert.equal(br.sources.over, true)
})

check('2 九个工具注册齐全', () => {
  assert.equal(disposers.length, 9)
  for (const name of ['deep_research_start', 'deep_research_record', 'deep_research_plan', 'deep_research_angle', 'deep_research_reflect', 'deep_research_write', 'deep_research_review', 'deep_research_status', 'deep_research_jury']) {
    assert.ok(registered.has(name), '缺少 ' + name)
    assert.equal(typeof registered.get(name).output.render, 'function')
  }
})

check('3 start 建立独立运行目录并给出 brief 提示', () => {
  const out = call('deep_research_start', { question: 'what changed in DSH tools pipeline', depth: 'standard' })
  runId = out.runId
  assert.ok(fs.existsSync(path.join(out.dir, 'findings')))
  assert.ok(out.briefPrompt.includes('Research Brief'))
  assert.equal(out.depth, 'standard')
})

check('4 未写 brief 前不能 plan', () => {
  let threw = false
  try { call('deep_research_plan', { runId }) } catch (e) { threw = /先完成 Brief/.test(e.message) }
  assert.ok(threw)
})

check('5 brief 落盘后 plan 可推进，且角度被硬性截断', () => {
  const r1 = call('deep_research_record', { runId, slot: 'brief', markdown: '# Research Brief\n## Question\nq' })
  assert.equal(r1.ok, true)
  assert.equal(call('deep_research_plan', { runId }).maxAngles, 5)
  const r2 = call('deep_research_record', { runId, slot: 'plan', markdown: JSON.stringify({ briefContext: 'ctx', angles: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }) })
  assert.equal(r2.ok, true)
  assert.equal(r2.stats.angles, 5)
  assert.equal(r2.stats.trimmed, true)
})

check('6 angle 只返回缺 findings 的角度', () => {
  const out = call('deep_research_angle', { runId })
  assert.equal(out.angles.length, 5)
  assert.ok(out.angles[0].prompt.includes('Run up to 6 web searches'))
  assert.ok(out.angles[0].prompt.includes('findings/F1.md'))
})

check('7 合法 findings 写入，非法 findings 被拒收', () => {
  const good = call('deep_research_record', { runId, slot: 'finding', n: 1, markdown: FINDING(1, ['https://a.example/x', 'https://b.example/y']) })
  assert.equal(good.ok, true)
  assert.equal(good.stats.count, 2)
  assert.equal(good.stats.byType.primary, 1)
  const bad = call('deep_research_record', { runId, slot: 'finding', n: 2, markdown: '# F2: bad\n\n## Findings\n\n### [1] no url\n- quote: "q"\n' })
  assert.equal(bad.ok, false)
  assert.ok(bad.errors.some((e) => e.includes('url')))
  assert.ok(bad.errors.some((e) => e.includes('Dead ends')))
})

check('8 编号不一致与来源类型非法都会报错', () => {
  const p = parseFindings('# F9: x\n\n## Findings\n\n### [1] c\n- quote: "q"\n- url: https://c.example\n- source_type: blog\n- published: unknown\n- confidence: low\n\n## Dead ends\n- none\n', 3)
  assert.equal(p.ok, false)
  assert.ok(p.errors.join(' ').includes('编号不一致'))
  assert.ok(p.errors.join(' ').includes('source_type'))
})

check('9 reflect 可选，且有 delta 上限', () => {
  const r = call('deep_research_record', { runId, slot: 'reflect', markdown: JSON.stringify({ deltaAngles: ['x', 'y', 'z', 'w'], openQuestions: ['q1'] }) })
  assert.equal(r.ok, true)
  assert.equal(r.stats.deltaAngles, 3)
})

check('10 报告引用审计能抓出虚构 URL', () => {
  const report = [
    '> Generated 2026-11-15 . depth: standard',
    '',
    '## Executive summary',
    '- something true [1]',
    '- something else [2]',
    '',
    '## Sources',
    '[1] https://a.example/x',
    '[2] https://invented.example/nope',
    '',
  ].join('\n')
  const w = call('deep_research_record', { runId, slot: 'report', markdown: report })
  assert.equal(w.ok, true)
  const rv = call('deep_research_review', { runId })
  assert.equal(rv.ok, false)
  assert.ok(rv.critical >= 1)
  assert.ok(rv.audit.notInFindings.some((x) => x.url.includes('invented')))
  assert.ok(rv.fixPrompt.includes('Never invent new sources'))
  assert.ok(fs.existsSync(path.join(tmp, 'runs', runId, 'REVIEW.md')))
})

check('11 引用齐全时审计通过，并统计单源结论', () => {
  const run2 = createRun(tmp, { question: 'q2', depth: 'quick' })
  writeText(run2, 'findings/F1.md', FINDING(1, ['https://a.example/x', 'https://b.example/y']))
  const report = ['## Body', '- claim [1]', '- claim two [2]', '', '## Sources', '[1] https://a.example/x', '[2] https://b.example/y', ''].join('\n')
  const audit = auditCitations(run2, report)
  assert.equal(audit.ok, true, JSON.stringify(audit.problems))
  assert.equal(audit.singleSourceCount, 2)
  assert.equal(audit.citedCount, 2)
  const md = renderReview(audit)
  assert.ok(md.includes('# REVIEW'))
})

check('12 陪审团：2 否决即删，有效票不足不作数', () => {
  assert.equal(tally(['keep', 'reject', 'reject']).decision, 'reject')
  assert.equal(tally(['keep', 'keep', 'reject']).decision, 'keep')
  assert.equal(tally(['reject']).decision, 'insufficient')
  assert.equal(JURY_SIZE, 3)
  assert.equal(REJECT_QUORUM, 2)
  const rep = juryReport([{ claim: 'c1', verdicts: ['keep', 'reject', 'reject'] }, { claim: 'c2', verdicts: ['keep', 'keep', 'reject'] }])
  assert.equal(rep.rejected, 1)
  assert.equal(rep.kept, 1)
})

check('13 相状态机：文件即检查点，跳相被拦', () => {
  const run2 = openRun(tmp, runId)
  assert.equal(gate(run2, 'Plan'), null)
  assert.ok(nextAction(run2).phase === 'Review' || nextAction(run2).phase === 'Done')
  const run3 = createRun(tmp, { question: 'q3', depth: 'quick' })
  assert.ok(gate(run3, 'Write'))
  assert.equal(nextAction(run3).phase, 'Brief')
})

check('14 运行目录保留策略', () => {
  for (let i = 0; i < 4; i += 1) createRun(tmp, { question: 'p' + i, depth: 'quick', now: Date.now() + i })
  const before = fs.readdirSync(path.join(tmp, 'runs')).length
  pruneRuns(tmp, 3)
  const after = fs.readdirSync(path.join(tmp, 'runs')).length
  assert.equal(after, 3)
  assert.ok(before >= 4)
})

check('15 findings 渲染回环', () => {
  const md = renderFindings(2, 'angle', [{ claim: 'c', quote: 'q', url: 'https://d.example', sourceType: 'secondary', published: 'unknown', confidence: 'high' }], [], [])
  const p = parseFindings(md, 2)
  assert.equal(p.ok, true, p.errors.join(';'))
  assert.equal(p.findings[0].url, 'https://d.example')
  assert.equal(stats(p).count, 1)
})

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : ' -> ' + r.why))
const bad = results.filter((r) => !r.ok).length
console.log('---')
console.log((results.length - bad) + '/' + results.length + ' passed; network: 0; tmp: ' + tmp)
process.exitCode = bad ? 1 : 0
