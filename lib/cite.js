// 引用审计：机器可判定的部分（引用是否指向 findings 里出现过的 URL）。
import { readText, findingFiles } from './workspace.js'
import { parseFindings } from './findings.js'

function urlsFromFindings(run) {
  const set = new Set()
  const perFinding = []
  for (const file of findingFiles(run)) {
    const parsed = parseFindings(readText(run, 'findings/' + file), Number(file.match(/\d+/)[0]))
    for (const f of parsed.findings) {
      if (f.url) { set.add(f.url); perFinding.push(f.url) }
    }
  }
  const counts = new Map()
  for (const url of perFinding) counts.set(url, (counts.get(url) ?? 0) + 1)
  return { set, counts }
}

function sourcesSection(report) {
  const idx = report.search(/^##\s*Sources\s*$/im)
  if (idx === -1) return { present: false, entries: new Map() }
  const block = report.slice(idx)
  const entries = new Map()
  const re = /^\s*(?:\[(\d+)\]|(\d+)[.)])\s*(.+)$/gm
  let m
  while ((m = re.exec(block)) !== null) {
    const n = Number(m[1] ?? m[2])
    const rest = m[3]
    const url = (rest.match(/https?:\/\/\S+/) ?? [])[0] ?? ''
    entries.set(n, { url: url.replace(/[),.]+$/, ''), line: rest.trim() })
  }
  return { present: true, entries }
}

export function auditCitations(run, reportMarkdown) {
  const report = String(reportMarkdown ?? readText(run, 'REPORT.md') ?? '')
  const { set, counts } = urlsFromFindings(run)
  const { present, entries } = sourcesSection(report)
  const cited = new Set()
  for (const m of report.matchAll(/\[(\d{1,3})\]/g)) cited.add(Number(m[1]))

  const problems = []
  if (!present) problems.push({ kind: 'no-sources-section', detail: '缺少 ## Sources 段' })
  if (cited.size === 0) problems.push({ kind: 'no-citations', detail: '正文没有任何 [n] 引用' })

  const unresolved = [...cited].filter((n) => !entries.has(n))
  if (unresolved.length) problems.push({ kind: 'unresolved', detail: '引用编号在 Sources 里找不到：' + unresolved.join(', ') })

  const fabricated = []
  const notInFindings = []
  for (const [n, entry] of entries) {
    if (!entry.url) { alleged: problems.push({ kind: 'source-without-url', detail: 'Sources 第 ' + n + ' 条没有 URL' }); continue }
    if (!set.has(entry.url)) notInFindings.push({ n, url: entry.url })
    else if ((counts.get(entry.url) ?? 0) === 0) fabricated.push({ n, url: entry.url })
  }
  if (notInFindings.length) {
    problems.push({ kind: 'url-not-in-findings', detail: 'Sources 里的 URL 未出现在任何 findings 文件：' + notInFindings.map((x) => x.url).join(' ') })
  }

  const singleSource = []
  for (const [url, count] of counts) {
    if (count === 1) singleSource.push(url)
  }

  const critical = problems.filter((p) => ['no-sources-section', 'unresolved', 'url-not-in-findings', 'source-without-url'].includes(p.kind)).length
  return {
    ok: critical === 0,
    critical,
    problems,
    unresolved,
    notInFindings,
    singleSourceCount: singleSource.length,
    citedCount: cited.size,
    sourceEntries: entries.size,
    findingsUrls: set.size,
  }
}

export function renderReview(audit, extra = {}) {
  const lines = ['# REVIEW', '']
  lines.push('- 结论：' + (audit.ok ? '引用层面通过' : '引用层面不通过，需修正'))
  lines.push('- 正文引用编号：' + audit.citedCount + '；Sources 条目：' + audit.sourceEntries + '；findings 里的 URL：' + audit.findingsUrls)
  lines.push('- 单源结论数：' + audit.singleSourceCount)
  lines.push('')
  if (audit.problems.length) {
    lines.push('## 机器判定问题')
    for (const p of audit.problems) lines.push('- [' + p.kind + '] ' + p.detail)
    lines.push('')
  }
  if (extra.agentFindings) {
    lines.push('## 评审意见（需模型补充）')
    lines.push(extra.agentFindings)
    lines.push('')
  }
  lines.push('## 人工复核清单')
  lines.push('- 抽查 5 条 [n]，确认 URL 是否真的支持该句。')
  lines.push('- 结论强度是否超过证据；[single source] 与 [speculative] 标注是否齐全。')
  lines.push('- 摘要与正文是否一致。')
  lines.push('')
  return lines.join('\n')
}
