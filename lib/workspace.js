// 运行目录：每次 deep_research 一个独立目录，落盘即检查点。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export function defaultRoot(config = {}) {
  const raw = typeof config.dataDir === 'string' && config.dataDir.trim()
  return raw ? path.resolve(raw) : path.join(os.homedir(), '.dsh', 'deep-research')
}

export function runId(now = Date.now()) {
  const stamp = new Date(now).toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const salt = Math.random().toString(36).slice(2, 6)
  return 'run-' + stamp + '-' + salt
}

export function createRun(root, options = {}) {
  const id = options.id ?? runId(options.now)
  const dir = path.join(root, 'runs', id)
  fs.mkdirSync(path.join(dir, 'findings'), { recursive: true })
  const meta = {
    id,
    createdAt: options.now ?? Date.now(),
    depth: options.depth ?? 'standard',
    question: String(options.question ?? '').slice(0, 2000),
    phases: {},
  }
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8')
  return { id, dir, meta }
}

export function openRun(root, id) {
  const dir = path.join(root, 'runs', String(id))
  if (!fs.existsSync(path.join(dir, 'run.json'))) throw new Error('运行不存在：' + id)
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'))
  return { id: meta.id, dir, meta }
}

export function saveMeta(run, patch) {
  Object.assign(run.meta, patch)
  fs.writeFileSync(path.join(run.dir, 'run.json'), JSON.stringify(run.meta, null, 2) + '\n', 'utf8')
  return run.meta
}

export function markPhase(run, phase, status = 'done', extra = {}) {
  run.meta.phases = run.meta.phases ?? {}
  run.meta.phases[phase] = { status, at: Date.now(), ...extra }
  return saveMeta(run, {})
}

export function writeJson(run, name, value) {
  const file = path.join(run.dir, name)
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
  return file
}

export function readJson(run, name, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(run.dir, name), 'utf8')) } catch { return fallback }
}

export function writeText(run, name, text) {
  const file = path.join(run.dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, String(text), 'utf8')
  return file
}

export function readText(run, name) {
  try { return fs.readFileSync(path.join(run.dir, name), 'utf8') } catch { return null }
}

export function findingFiles(run) {
  const dir = path.join(run.dir, 'findings')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => /^F\d+\.md$/.test(f)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
}

export function pruneRuns(root, maxRuns = 20) {
  const dir = path.join(root, 'runs')
  if (!fs.existsSync(dir)) return { removed: [] }
  const items = fs.readdirSync(dir)
    .map((name) => ({ name, at: (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, name, 'run.json'), 'utf8')).createdAt ?? 0 } catch { return 0 } })() }))
    .sort((a, b) => b.at - a.at)
  const removed = items.slice(Math.max(0, maxRuns)).map((x) => x.name)
  for (const name of removed) {
    try { fs.rmSync(path.join(dir, name), { recursive: true, force: true }) } catch {}
  }
  return { removed }
}
