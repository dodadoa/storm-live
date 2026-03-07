import type { PlasmoCSConfig } from "plasmo"

import { executeAll } from "~lib/lang"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

// ============================================================
//  Panel UI
// ============================================================

const C = {
  bg: "rgba(8,8,18,0.55)",
  header: "transparent",
  border: "#6366f1",
  accent: "#000",
  accentHover: "#111",
  inputBg: "rgba(12,12,28,0.5)",
  inputBorder: "rgba(0,0,0,0.35)",
  text: "#000",
  muted: "#000",
  green: "#000",
  red: "#000",
  blue: "#000"
}

const GLOW = "none"

type LogType = "input" | "output" | "error"

function mkEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (style) el.style.cssText = style
  return el
}

function createPanel() {
  if (document.getElementById("storm-live-root")) return

  // ── Root ────────────────────────────────────────────────────
  const root = mkEl(
    "div",
    `
    position: fixed; bottom: 0; left: 0; right: 0; width: 100%;
    z-index: 2147483647;
    font-family: 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace;
    font-size: 13px;
    box-shadow: 0 -6px 40px rgba(99,102,241,0.12);
    backdrop-filter: blur(6px) saturate(1.2);
    -webkit-backdrop-filter: blur(6px) saturate(1.2);
  `
  )
  root.id = "storm-live-root"

  // ── Header ───────────────────────────────────────────────────
  const header = mkEl(
    "div",
    `
    background: ${C.header};
    border-top: 2px solid rgba(0,0,0,0.15);
    border-bottom: 1px solid rgba(0,0,0,0.1);
    padding: 7px 16px;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer; user-select: none; gap: 12px;
  `
  )

  const headerLeft = mkEl(
    "div",
    `display: flex; align-items: center; gap: 10px;`
  )

  const badge = mkEl(
    "span",
    `color:${C.accent}; font-weight:800; letter-spacing:.12em; font-size:11px; text-shadow:${GLOW};`
  )
  badge.textContent = "⚡ STORM LIVE"

  const syntaxHint = mkEl(
    "span",
    `
    color: ${C.muted}; font-size: 10px;
    border: 1px solid rgba(99,102,241,0.2); border-radius: 4px;
    padding: 2px 8px; letter-spacing: .04em;
  `
  )
  syntaxHint.textContent = "storm [bpm]  >  text  >  highlight  >  redact  >  color"

  headerLeft.appendChild(badge)
  headerLeft.appendChild(syntaxHint)

  const headerRight = mkEl(
    "span",
    `color:${C.muted}; font-size:10px; flex-shrink:0; text-shadow:${GLOW};`
  )
  headerRight.textContent = "⌃↵ run · ↵ newline · esc minimize"

  header.appendChild(headerLeft)
  header.appendChild(headerRight)

  // ── Body ─────────────────────────────────────────────────────
  const body = mkEl("div", `background: transparent;`)

  // Log area
  const logArea = mkEl(
    "div",
    `
    height: 28px; overflow: hidden;
    padding: 0 16px; border-top: 1px solid rgba(0,0,0,0.1);
    display: none;
  `
  )

  // Input row
  const inputRow = mkEl(
    "div",
    `
    display: flex; gap: 10px; align-items: flex-end;
    padding: 10px 14px; border-top: 1px solid rgba(99,102,241,0.15);
  `
  )

  const inputWrap = mkEl("div", `flex:1; position:relative;`)

  const promptGlyph = mkEl(
    "span",
    `
    position:absolute; left:11px; top:50%; transform:translateY(-50%);
    color:${C.accent}; pointer-events:none; user-select:none;
    font-size:18px; line-height:1; opacity:1; text-shadow:${GLOW};
  `
  )
  promptGlyph.textContent = "›"

  const input = mkEl(
    "textarea",
    `
    width: 100%; background: ${C.inputBg};
    border: 1px solid ${C.inputBorder}; border-radius: 6px;
    color: ${C.text}; padding: 8px 12px 8px 28px;
    outline: none; font-family: inherit; font-size: inherit;
    box-sizing: border-box; min-height: 38px; max-height: 160px;
    resize: none; overflow-y: auto; line-height: 1.6;
    transition: border-color .15s; caret-color: ${C.accent};
    text-shadow: ${GLOW}; font-weight: 500;
  `
  ) as HTMLTextAreaElement
  input.rows = 1
  input.spellcheck = false
  input.placeholder = "storm 120 > text > redact 0.5"
  input.value = "storm 120 > text > redact 0.5"

  input.addEventListener("focus", () => {
    input.style.borderColor = C.accent
  })
  input.addEventListener("blur", () => {
    input.style.borderColor = C.inputBorder
  })

  input.addEventListener("input", () => {
    input.style.height = "auto"
    input.style.height = Math.min(input.scrollHeight, 160) + "px"
    promptGlyph.style.top =
      input.scrollHeight > 42 ? "10px" : "50%"
    promptGlyph.style.transform =
      input.scrollHeight > 42 ? "none" : "translateY(-50%)"
  })

  const clearBtn = mkEl(
    "button",
    `
    background:transparent; color:${C.muted};
    border:1px solid rgba(99,102,241,0.2); border-radius:6px;
    padding:0 12px; cursor:pointer; font-family:inherit;
    font-size:11px; font-weight:600; flex-shrink:0; height:38px;
    transition:all .15s; letter-spacing:.06em;
  `
  )
  clearBtn.textContent = "CLR"

  const runBtn = mkEl(
    "button",
    `
    background:${C.accent}; color:white; border:none;
    border-radius:6px; padding:0 20px; cursor:pointer;
    font-family:inherit; font-size:12px; font-weight:700;
    letter-spacing:.08em; flex-shrink:0; height:38px;
    transition:background .15s;
  `
  )
  runBtn.textContent = "RUN ▶"

  inputWrap.appendChild(promptGlyph)
  inputWrap.appendChild(input)
  inputRow.appendChild(inputWrap)
  inputRow.appendChild(clearBtn)
  inputRow.appendChild(runBtn)
  body.appendChild(logArea)
  body.appendChild(inputRow)
  root.appendChild(header)
  root.appendChild(body)

  // ── Log helpers ──────────────────────────────────────────────
  function addLog(type: LogType, text: string) {
    if (logArea.style.display === "none") {
      logArea.style.display = "block"
    }
    const line = document.createElement("div")
    const color =
      type === "error" ? C.red : type === "input" ? C.blue : C.green
    line.style.cssText = `
      color:${color}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      font-size:12px; line-height:28px; font-weight:600;
      text-shadow:${GLOW};
    `
    line.textContent = type === "input" ? `> ${text}` : text
    logArea.appendChild(line)
    logArea.scrollTop = logArea.scrollHeight
  }

  function clearLogs() {
    logArea.innerHTML = ""
    logArea.style.display = "none"
  }

  // ── Runner ───────────────────────────────────────────────────
  function run() {
    const cmd = input.value.trim()
    if (!cmd) return
    addLog("input", cmd)
    const results = executeAll(cmd)
    results.forEach(({ output, error }, i) => {
      const prefix = results.length > 1 ? `[${i + 1}] ` : ""
      if (error) addLog("error", `${prefix}✗ ${error}`)
      else if (output) addLog("output", `${prefix}${output}`)
      else addLog("output", `${prefix}✓ done`)
    })
  }

  // ── Events ───────────────────────────────────────────────────
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault()
      run()
    }
    if (e.key === "Escape") toggleMinimize()
  })

  runBtn.addEventListener("click", run)
  runBtn.addEventListener("mouseenter", () => {
    runBtn.style.background = C.accentHover
  })
  runBtn.addEventListener("mouseleave", () => {
    runBtn.style.background = C.accent
  })

  clearBtn.addEventListener("click", clearLogs)
  clearBtn.addEventListener("mouseenter", () => {
    clearBtn.style.color = C.text
    clearBtn.style.borderColor = "#4b5563"
  })
  clearBtn.addEventListener("mouseleave", () => {
    clearBtn.style.color = C.muted
    clearBtn.style.borderColor = "#252538"
  })

  let minimized = false
  function toggleMinimize() {
    minimized = !minimized
    body.style.display = minimized ? "none" : "block"
    headerRight.textContent = minimized ? "▲ click to expand" : "⌃↵ run · ↵ newline · esc minimize"
  }
  header.addEventListener("click", toggleMinimize)

  document.body.appendChild(root)
  setTimeout(() => input.focus(), 150)
}

// Don't inject the panel into popup windows opened by Storm
if (window.name !== "_storm_popup") {
  if (document.body) {
    createPanel()
  } else {
    document.addEventListener("DOMContentLoaded", createPanel)
  }
}
