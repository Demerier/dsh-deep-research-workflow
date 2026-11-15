// 锁定提示词：结构与字段沿用 MiMo Code 的 deep-research（见 NOTICE.md），
// 工具名改为 DSH 的 web_search / web_fetch / subagent。

export function briefPrompt(input) {
  const { question, today, depth, context } = input
  return [
    'You are the scoping step of a deep research run. Today is ' + today + '.',
    'No user is available - do NOT ask questions; write assumptions instead.',
    'Research question (verbatim from user): "' + question + '"',
    context ? 'Additional context from the requester: ' + context : '',
    'Write brief.md with sections:',
    '# Research Brief',
    '**Date**: ' + today + ' . **Depth**: ' + depth,
    '## Question - the refined, unambiguous research question',
    '## Scope - In: ... / Out: ... (explicit boundaries)',
    '## Assumptions - audience, time frame, region, language; every guess you made goes here',
    'Do nothing else. Do not plan angles yet.',
    'Save it with deep_research_record(slot="brief", markdown=...).',
  ].filter(Boolean).join('\n')
}

export function planPrompt(input) {
  const { depth } = input
  return [
    'You are the planning step of a deep research run. Read brief.md.',
    'Decompose it into 3-' + depth.angles + ' INDEPENDENT research angles (no overlap; each answerable alone).',
    'Draw from these lenses as applicable: core facts/definitions, recent developments, quantitative data/benchmarks,',
    'counter-arguments and failure cases, practitioner experience, academic work, key players/alternatives.',
    'Also compress the brief into a 2-3 line briefContext for sub-agents.',
    'Return JSON: { "briefContext": "...", "angles": ["...", "..."] }.',
    'Angles beyond ' + depth.angles + ' will be discarded by the host.',
  ].join('\n')
}

export function anglePrompt(input) {
  const { n, angle, briefContext, depth, today } = input
  return [
    'You are a research sub-agent. Today is ' + today + '.',
    '',
    'Research context: ' + (briefContext || '(see brief.md)'),
    '',
    'Your ONLY task - research this single angle, nothing else:',
    angle,
    '',
    'Rules:',
    '1. Run up to ' + depth.queryBudget + ' web searches. Start with 2-3 differently-phrased queries in parallel; refine based on what comes back.',
    '   Prefer primary sources (official docs, papers, original announcements) over aggregators and SEO farms.',
    '2. web_fetch the 3-' + Math.min(6, Math.max(3, depth.sources)) + ' most promising results to read actual content. Do not cite a page you did not fetch.',
    '3. Judge each source: official/primary > reputable media/peer-reviewed > forums/blogs > content farms.',
    '   Discard low-quality sources rather than citing them.',
    '4. Extract findings as information-dense claims: include exact entities, numbers, dates, versions. One claim per finding.',
    '5. Write your findings to findings/F' + n + '.md in EXACTLY this format:',
    '',
    '# F' + n + ': ' + angle,
    '',
    '## Findings',
    '',
    '### [1] <one-sentence claim>',
    '- quote: "<short verbatim supporting quote>"',
    '- url: <source URL>',
    '- source_type: primary | secondary | community',
    '- published: <date if known, else unknown>',
    '- confidence: high | medium | low',
    '',
    '### [2] ...',
    '',
    '## Dead ends',
    '- <queries or sources that yielded nothing useful, one line each>',
    '',
    '## Suggested follow-ups',
    '- <at most 3 narrower questions worth a deeper look, or "none">',
    '',
    '6. Aim for 5-12 findings. Depth beats breadth: 6 solid sourced claims beat 15 vague ones.',
    '7. If the angle turns out unanswerable or results are thin, still write the file with whatever you found and say so under Dead ends.',
    '',
    'Return ONLY: a 3-5 line summary, the file path written, finding count, overall confidence. Do NOT return raw page content.',
    'Save it with deep_research_record(slot="finding", n=' + n + ', markdown=...).',
  ].join('\n')
}

export function reflectPrompt(input) {
  const { depth } = input
  return [
    'You are the reflection step of a deep research run. Read brief.md and EVERY file in findings/.',
    'Against the brief, identify: (a) parts of the brief with no evidence; (b) major claims resting on a single source;',
    '(c) conflicts between sources worth resolving. Also consider the "Suggested follow-ups" sections in the findings.',
    'Output at most ' + depth.deltaAngles + ' delta-angles - narrow, targeted research questions that would close the most important gaps.',
    'If coverage is already sufficient, output an empty array. Also list unresolved gaps for the report Open questions section.',
    'Return JSON: { "deltaAngles": ["..."], "openQuestions": ["..."] }.',
    'More than ' + depth.deltaAngles + ' delta-angles will be discarded by the host.',
  ].join('\n')
}

export function writePrompt(input) {
  const { today, depth, openQuestions, gaps } = input
  return [
    'You are the SOLE writer of a deep research report. Read brief.md, reflect.json (openQuestions), and EVERY file in findings/.',
    'Write REPORT.md in one pass. Header: "> Generated ' + today + ' . depth: ' + depth + '".',
    'Report structure: Executive summary (5-10 bullet conclusions with [n] citations) -> Background and scope',
    '-> Body sections organized by THEME (not by findings file) -> Open questions -> Sources (numbered, dedup URLs, access date ' + today + ').',
    'Hard rules: every non-obvious claim carries [n] resolving to a Sources entry whose URL appears in some findings file -',
    'never cite from memory; conflicts presented with both sides and dates; [single source] and [speculative] flags where applicable.',
    'Do NOT re-search. If a gap blocks a section, state the gap.',
    gaps && gaps.length ? 'Known gaps to state explicitly: ' + gaps.join(' | ') : '',
    openQuestions && openQuestions.length ? 'Open questions to carry over: ' + openQuestions.join(' | ') : '',
    'Save it with deep_research_record(slot="report", markdown=...).',
  ].filter(Boolean).join('\n')
}

export function reviewPrompt(input) {
  const { today } = input
  return [
    'You are an independent reviewer with NO prior context - judge only from files. Today is ' + today + '.',
    'Read REPORT.md and every file in findings/.',
    'The host has already run a mechanical citation audit; its verdict is in REVIEW.md under "机器判定问题".',
    'Your job is the part a script cannot do:',
    '(a) claims lacking citations that need one;',
    '(b) spot-check 5 random [n] citations - does the URL plausibly support the sentence?',
    '(c) conclusions stronger than the evidence;',
    '(d) executive summary consistent with body.',
    'Append your findings to REVIEW.md under "评审意见".',
    'Return JSON: { "critical": <number>, "summary": "<one line>" }. critical counts fabricated citations and unsupported claims.',
  ].join('\n')
}

export function fixPrompt() {
  return [
    'Read REVIEW.md and fix REPORT.md accordingly: re-anchor citations to URLs actually present in findings/,',
    'otherwise weaken or remove unsupported claims. Never invent new sources.',
    'Save the fixed report with deep_research_record(slot="report", markdown=...) again.',
  ].join('\n')
}
