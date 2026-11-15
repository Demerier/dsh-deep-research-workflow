// 预算表：数值与 MiMo Code 的 DEPTH 常量一致（见 NOTICE.md）。
// 硬上限由代码执行，不交给模型协商，这是上游的核心设计之一。

export const DEPTHS = {
  quick: { angles: 3, queryBudget: 4, deltaAngles: 0, sources: 8 },
  standard: { angles: 5, queryBudget: 6, deltaAngles: 3, sources: 15 },
  deep: { angles: 8, queryBudget: 8, deltaAngles: 4, sources: 25 },
}

export const PHASES = ['Brief', 'Plan', 'Research', 'Reflect', 'Write', 'Review']

export function depthOf(name, fallback = 'standard') {
  const key = DEPTHS[name] ? name : (DEPTHS[fallback] ? fallback : 'standard')
  return { name: key, ...DEPTHS[key] }
}

export function clampAngles(angles, depth) {
  const list = Array.isArray(angles) ? angles.filter((a) => typeof a === 'string' && a.trim()) : []
  return list.slice(0, depth.angles)
}

export function clampDelta(angles, depth) {
  const list = Array.isArray(angles) ? angles.filter((a) => typeof a === 'string' && a.trim()) : []
  return list.slice(0, depth.deltaAngles)
}

// 查询预算与抓取预算的实际消耗统计，供状态汇总与越界告警使用。
export function budgetReport(depth, used = {}) {
  const queries = Number(used.queries ?? 0)
  const sources = Number(used.sources ?? 0)
  const angles = Number(used.angles ?? 0)
  return {
    depth: depth.name,
    angles: { used: angles, cap: depth.angles, over: angles > depth.angles },
    queriesPerAngle: { used: queries, cap: depth.queryBudget * Math.max(1, angles || depth.angles) },
    sources: { used: sources, cap: depth.sources, over: sources > depth.sources },
    deltaAngles: { cap: depth.deltaAngles },
  }
}
