// 陪审团聚合：3 票中 2 票否决即删；有效票不足 2 票不作数。
// 借自 MiMo Code fact-check.js 的 JURY_SIZE / REJECT_QUORUM（见 NOTICE.md）。
export const JURY_SIZE = 3
export const REJECT_QUORUM = 2

export function tally(verdicts) {
  const list = Array.isArray(verdicts) ? verdicts.map((v) => String(v ?? '').toLowerCase()) : []
  const keep = list.filter((v) => v === 'keep' || v === 'support' || v === 'true').length
  const reject = list.filter((v) => v === 'reject' || v === 'refute' || v === 'false').length
  const abstain = list.length - keep - reject
  const valid = keep + reject
  let decision = 'pending'
  if (valid < REJECT_QUORUM) decision = 'insufficient'
  else if (reject >= REJECT_QUORUM) decision = 'reject'
  else if (keep >= REJECT_QUORUM) decision = 'keep'
  else decision = 'pending'
  return { keep, reject, abstain, valid, decision, quorum: REJECT_QUORUM, size: JURY_SIZE }
}

export function juryReport(claims) {
  const rows = (Array.isArray(claims) ? claims : []).map((c) => {
    const t = tally(c.verdicts)
    return { claim: String(c.claim ?? '').slice(0, 200), url: c.url ?? '', ...t }
  })
  return {
    total: rows.length,
    kept: rows.filter((r) => r.decision === 'keep').length,
    rejected: rows.filter((r) => r.decision === 'reject').length,
    pending: rows.filter((r) => r.decision !== 'keep' && r.decision !== 'reject').length,
    rows,
  }
}
