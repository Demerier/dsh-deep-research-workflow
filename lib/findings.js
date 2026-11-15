// findings 文件格式的严格解析：格式不合规直接拒收，避免主流程读到半成品。
// 格式与 MiMo Code 的 subagentPrompt 输出要求一致（见 NOTICE.md）。

const SOURCE_TYPES = new Set(['primary', 'secondary', 'community'])
const CONFIDENCE = new Set(['high', 'medium', 'low'])

function field(block, name) {
  const re = new RegExp('^-\\s*' + name + '\\s*:\\s*(.+)$', 'im')
  const m = block.match(re)
  return m ? m[1].trim() : ''
}

function stripQuotes(value) {
  return String(value ?? '').trim().replace(/^["'“”]|["'“”]$/g, '')
}

export function parseFindings(markdown, expectedN = null) {
  const text = String(markdown ?? '')
  const errors = []
  const header = text.match(/^#\s*F(\d+)\s*:\s*(.+)$/m)
  if (!header) errors.push('缺少一级标题，应为 # F{n}: <角度>')
  const n = header ? Number(header[1]) : expectedN
  if (expectedN !== null && header && Number(header[1]) !== expectedN) {
    errors.push('编号不一致：标题是 F' + header[1] + '，期望 F' + expectedN)
  }

  // 按二级标题切段：比正则 lookahead 稳，且不受行尾空白影响。
  const blocks = new Map()
  for (const part of text.split(/^##\s+/m).slice(1)) {
    const nl = part.indexOf('\n')
    const title = (nl === -1 ? part : part.slice(0, nl)).trim().toLowerCase()
    const body = nl === -1 ? '' : part.slice(nl + 1)
    if (title && !blocks.has(title)) blocks.set(title, body)
  }
  const findBlock = (title) => blocks.get(String(title).toLowerCase()) ?? ''
  const findingsBlock = findBlock('Findings')
  if (!findingsBlock.trim()) errors.push('缺少 ## Findings 段')

  const findings = []
  const chunks = findingsBlock.split(/^###\s*\[/m).slice(1)
  for (const chunk of chunks) {
    const body = chunk.replace(/^\d+\]\s*/, '')
    const idx = chunk.match(/^(\d+)\]/)?.[1]
    const lines = body.split('\n')
    const claim = String(lines[0] ?? '').trim()
    const quote = stripQuotes(field(body, 'quote'))
    const url = field(body, 'url')
    const sourceType = field(body, 'source_type').toLowerCase()
    const published = field(body, 'published') || 'unknown'
    const confidence = field(body, 'confidence').toLowerCase()
    const one = { index: Number(idx ?? findings.length + 1), claim, quote, url, sourceType, published, confidence }
    if (!claim) errors.push('第 ' + one.index + ' 条缺少结论句')
    if (!/^https?:\/\//i.test(url)) errors.push('第 ' + one.index + ' 条 url 不合法：' + (url || '空'))
    if (!SOURCE_TYPES.has(sourceType)) errors.push('第 ' + one.index + ' 条 source_type 非法：' + (sourceType || '空'))
    if (!CONFIDENCE.has(confidence)) errors.push('第 ' + one.index + ' 条 confidence 非法：' + (confidence || '空'))
    findings.push(one)
  }
  if (!findings.length) errors.push('Findings 段没有任何条目')

  const deadEnds = findBlock('Dead ends').split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
  const followUps = findBlock('Suggested follow-ups').split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
  if (!deadEnds.length) errors.push('缺少 Dead ends 段（哪怕写 "none"）')

  return {
    ok: errors.length === 0,
    n,
    angle: header ? header[2].trim() : '',
    findings,
    deadEnds,
    followUps,
    errors,
  }
}

export function renderFindings(n, angle, findings, deadEnds, followUps) {
  const lines = ['# F' + n + ': ' + angle, '', '## Findings', '']
  findings.forEach((f, i) => {
    lines.push('### [' + (i + 1) + '] ' + f.claim)
    lines.push('- quote: "' + (f.quote ?? '') + '"')
    lines.push('- url: ' + f.url)
    lines.push('- source_type: ' + f.sourceType)
    lines.push('- published: ' + (f.published ?? 'unknown'))
    lines.push('- confidence: ' + f.confidence)
    lines.push('')
  })
  lines.push('## Dead ends')
  if (!deadEnds.length) lines.push('- none')
  else deadEnds.forEach((d) => lines.push('- ' + d))
  lines.push('', '## Suggested follow-ups')
  if (!followUps.length) lines.push('- none')
  else followUps.forEach((f) => lines.push('- ' + f))
  lines.push('')
  return lines.join('\n')
}

export function stats(parsed) {
  const byType = { primary: 0, secondary: 0, community: 0 }
  const byConfidence = { high: 0, medium: 0, low: 0 }
  const urls = new Set()
  for (const f of parsed.findings) {
    byType[f.sourceType] = (byType[f.sourceType] ?? 0) + 1
    byConfidence[f.confidence] = (byConfidence[f.confidence] ?? 0) + 1
    if (f.url) urls.add(f.url)
  }
  return { count: parsed.findings.length, byType, byConfidence, urls: urls.size }
}
