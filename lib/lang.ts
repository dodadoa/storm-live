// ============================================================
//  Storm mini-language interpreter
//
//  Each newline = a separate independent effect.
//  Syntax:  storm [bpm] > step > step ...
//
//  Examples:
//    storm 120 > text > redact rand 0.1 0.9
//    storm 60 > bg > color rand 0 100 rand 0 100 rand 0 100
//
//  No eval / new Function — pure string parsing only.
// ============================================================

import { cleanupAll, cleanupLine, clearSeqStore, setLineMode, storm, StormChain } from "./storm"

// ── Types ─────────────────────────────────────────────────────

type Arg = number | boolean | string

// ── Argument parser ───────────────────────────────────────────

function parseScalar(token: string): Arg {
  if (token === "true") return true
  if (token === "false") return false
  const n = Number(token)
  if (token !== "" && !isNaN(n)) return n
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  )
    return token.slice(1, -1)
  return token
}

/**
 * Resolve raw tokens into argument values.
 * - `rand min max` → random float in [min, max), consumes 3 tokens
 * - `seq` / `random` → mode keywords, skipped (handled by pre-scan)
 */
function parseArgs(tokens: string[]): Arg[] {
  const args: Arg[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i].toLowerCase()
    if (t === "seq" || t === "random") {
      i++
    } else if (t === "rand") {
      const min = Number(tokens[i + 1] ?? 0)
      const max = Number(tokens[i + 2] ?? 1)
      args.push(min + Math.random() * (max - min))
      i += 3
    } else {
      args.push(parseScalar(tokens[i]))
      i++
    }
  }
  return args
}

// ── Step parser ───────────────────────────────────────────────
// Store raw tokens — args are resolved lazily on every runLine call
// so that `rand` produces a new value on each beat.

interface Step {
  name: string
  tokens: string[]  // raw arg tokens, not yet resolved
}

function parseStep(raw: string): Step | null {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return null
  return { name: tokens[0].toLowerCase(), tokens: tokens.slice(1) }
}

// ── Dispatch table ────────────────────────────────────────────

type Dispatcher = (chain: StormChain, args: Arg[]) => void

const DISPATCH: Record<string, Dispatcher> = {
  text: (c, [p = 1]) => c.texts(p as number),
  paragraph: (c, [p = 1]) => c.paragraphs(p as number),
  bg: (c) => c.bg(),
  link: (c, [p = 1]) => c.links(p as number),
  redact: (c, [p = 0.5]) => c.redacts(p as number),
  highlight: (c, [p = 0.5]) => c.highlights(p as number),
  color: (c, [r = 100, g = 0, b = 0]) =>
    c.setColor(r as number, g as number, b as number),
  weight: (c, [v = 400]) => c.weight(v as number),
  size: (c, [v = 16]) => c.size(v as number),
}

const INIT_TOKENS = new Set(["storm"])

// ── Beat engine ───────────────────────────────────────────────
// One timer slot per line index — lines don't share timers.

const _timers = new Map<number, ReturnType<typeof setInterval>>()

function stopAllBeats() {
  _timers.forEach((t) => clearInterval(t))
  _timers.clear()
}

function runLine(steps: Step[], lineId: number): { output: string; error?: string } {
  // Pre-scan: detect seq/random suffix on any manipulator step
  for (const step of steps) {
    const last = step.tokens.at(-1)?.toLowerCase()
    if (last === "seq" || last === "random") {
      setLineMode(lineId, last)
      break
    }
  }

  cleanupLine(lineId)
  const chain = storm(lineId)
  for (const step of steps) {
    const fn = DISPATCH[step.name]
    if (!fn) {
      return {
        output: chain.toString(),
        error: `Unknown: "${step.name}". Available: ${Object.keys(DISPATCH).join(", ")}`
      }
    }
    // Resolve args fresh each call so `rand` re-rolls on every beat
    fn(chain, parseArgs(step.tokens))
  }
  return { output: chain.toString() }
}

// ── Public API ────────────────────────────────────────────────

export interface ExecResult {
  output: string
  error?: string
}

/**
 * Execute every non-empty line as an independent Storm command.
 * Lines with a BPM get their own beat timer; lines without run once.
 */
export function executeAll(input: string): ExecResult[] {
  stopAllBeats()
  cleanupAll()
  clearSeqStore()

  const lines = input.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"))
  if (!lines.length) return [{ output: "", error: "empty input" }]

  return lines.map((line, lineId) => {
    const steps = line
      .split(">")
      .map(parseStep)
      .filter((s): s is Step => s !== null)

    if (!steps.length) return { output: "", error: "nothing to run" }

    const [init, ...rest] = steps

    if (!INIT_TOKENS.has(init.name)) {
      return { output: "", error: `Start with "storm" — got "${init.name}"` }
    }

    const initArgs = parseArgs(init.tokens)
    const bpm = typeof initArgs[0] === "number" ? initArgs[0] : 0

    if (bpm > 0) {
      const ms = (60 / bpm) * 1000
      const first = runLine(rest, lineId)
      if (first.error) return first

      _timers.set(lineId, setInterval(() => runLine(rest, lineId), ms))

      return {
        output: `♩ ${bpm} BPM (${ms.toFixed(0)}ms) · ${first.output}`
      }
    }

    return runLine(rest, lineId)
  })
}
