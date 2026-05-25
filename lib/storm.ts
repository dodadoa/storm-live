// ============================================================
//  Storm — live DOM manipulation library
// ============================================================

// ── Selector helpers ─────────────────────────────────────────

function collectTextNodes(root: Element = document.body): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName.toLowerCase()
      if (["script", "style", "noscript", "head", "iframe"].includes(tag))
        return NodeFilter.FILTER_REJECT
      if (parent.closest("#storm-live-root")) return NodeFilter.FILTER_REJECT
      if (node.textContent?.trim()) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_SKIP
    }
  })
  let node: Node | null
  while ((node = walker.nextNode())) nodes.push(node as Text)
  return nodes
}

function unwrapSpans(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((span) => {
    const parent = span.parentNode
    if (!parent) return
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    span.remove()
  })
}

// ── Cleanup ───────────────────────────────────────────────────

function restoreParas(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.innerHTML = el.dataset.stormParaHtml ?? el.innerHTML
    el.style.cssText = el.dataset.stormParaStyle ?? ""
    delete el.dataset.stormParaHtml
    delete el.dataset.stormParaStyle
    delete el.dataset.stormPara
    delete el.dataset.stormLine
  })
}

export function cleanupLine(lineId: number) {
  document
    .querySelectorAll<HTMLElement>(`[data-storm-redact][data-storm-line="${lineId}"]`)
    .forEach((span) => {
      span.parentNode?.insertBefore(
        document.createTextNode(span.dataset.stormRedact ?? ""),
        span
      )
      span.remove()
    })

  unwrapSpans(`[data-storm-highlight][data-storm-line="${lineId}"]`)
  unwrapSpans(`[data-storm-color][data-storm-line="${lineId}"]`)
  unwrapSpans(`[data-storm-weight][data-storm-line="${lineId}"]`)
  unwrapSpans(`[data-storm-size][data-storm-line="${lineId}"]`)
  restoreParas(`[data-storm-para][data-storm-line="${lineId}"]`)
}

export function cleanupAll() {
  document.querySelectorAll<HTMLElement>("[data-storm-redact]").forEach((span) => {
    span.parentNode?.insertBefore(
      document.createTextNode(span.dataset.stormRedact ?? ""),
      span
    )
    span.remove()
  })
  unwrapSpans("[data-storm-highlight]")
  unwrapSpans("[data-storm-color]")
  unwrapSpans("[data-storm-weight]")
  unwrapSpans("[data-storm-size]")
  restoreParas("[data-storm-para]")
  document.querySelectorAll<HTMLStyleElement>("style[data-storm-bg]").forEach((s) =>
    s.remove()
  )
}

// ── Sequential cursor store ────────────────────────────────────
// Persists across beats so seq mode can advance through nodes.

type RunMode = "random" | "seq"

interface SeqCursors { text: number; link: number; para: number; mode: RunMode }
const _seqStore = new Map<number, SeqCursors>()

function seqFor(lineId: number): SeqCursors {
  if (!_seqStore.has(lineId)) _seqStore.set(lineId, { text: 0, link: 0, para: 0, mode: "random" })
  return _seqStore.get(lineId)!
}

export function setLineMode(lineId: number, mode: RunMode) {
  seqFor(lineId).mode = mode
}

export function clearSeqStore() {
  _seqStore.clear()
}

// ── Chain ────────────────────────────────────────────────────

type LastOp = "text" | "highlight" | "bg" | "link" | "paragraph" | null

function markPara(el: HTMLElement, lineId: number) {
  if (!el.dataset.stormPara) {
    el.dataset.stormPara = "true"
    el.dataset.stormParaHtml = el.innerHTML
    el.dataset.stormParaStyle = el.style.cssText
    el.dataset.stormLine = String(lineId)
  }
}

export class StormChain {
  readonly nodes: Text[] = []
  readonly log: string[] = []
  private _color = "rgb(100,0,0)"
  private _lastOp: LastOp = null
  private _highlighted: HTMLElement[] = []
  private _colorSpans: HTMLElement[] = []
  private _bgStyle: HTMLStyleElement | null = null
  private _links: HTMLAnchorElement[] = []
  private _paragraphs: HTMLElement[] = []
  private _lineId: number

  constructor(lineId = 0) {
    this._lineId = lineId
  }

  // ── Selectors ──────────────────────────────────────────────

  /**
   * Select visible text nodes, filtered by probability.
   * @param probability  0–1 fraction to randomly keep (default 1 = all)
   */
  texts(probability = 1): this {
    const all = collectTextNodes()
    const count =
      probability >= 1
        ? all.length
        : Math.max(1, Math.round(probability * all.length))

    const cur = seqFor(this._lineId)
    let found: Text[]
    if (cur.mode === "seq") {
      found = Array.from({ length: count }, (_, i) => all[(cur.text + i) % all.length])
      cur.text = (cur.text + count) % Math.max(all.length, 1)
    } else {
      found = all.sort(() => Math.random() - 0.5).slice(0, count)
    }

    ;(this.nodes as Text[]).length = 0
    ;(this.nodes as Text[]).push(...found)
    this._lastOp = "text"
    this.log.push(`text(${probability === 1 ? "all" : probability.toFixed(2)}) → ${found.length}/${all.length}`)
    return this
  }

  /** Select the page background — injects a scoped <style> tag. */
  bg(): this {
    const id = `storm-bg-${this._lineId}`
    let style = document.getElementById(id) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement("style")
      style.id = id
      style.dataset.stormBg = String(this._lineId)
      document.head.appendChild(style)
    }
    this._bgStyle = style
    this._lastOp = "bg"
    this.log.push("bg → page background")
    return this
  }

  /**
   * Select whole <p> elements, filtered by probability.
   * Manipulators (redact, highlight, color, weight, size) then operate on
   * the entire paragraph element rather than individual text nodes.
   * @param probability  0–1 fraction to keep (default 1 = all)
   */
  paragraphs(probability = 1): this {
    const all = Array.from(
      document.querySelectorAll<HTMLParagraphElement>("p")
    ).filter((p) => !p.closest("#storm-live-root"))
    const count =
      probability >= 1 ? all.length : Math.max(1, Math.round(probability * all.length))

    const cur = seqFor(this._lineId)
    if (cur.mode === "seq") {
      this._paragraphs = Array.from(
        { length: count },
        (_, i) => all[(cur.para + i) % all.length]
      )
      cur.para = (cur.para + count) % Math.max(all.length, 1)
    } else {
      this._paragraphs = all.sort(() => Math.random() - 0.5).slice(0, count)
    }

    this._lastOp = "paragraph"
    this.log.push(`paragraph(${probability === 1 ? "all" : probability.toFixed(2)}) → ${this._paragraphs.length}/${all.length}`)
    return this
  }

  /**
   * Select links on the page, filtered by probability.
   * @param probability  0–1 fraction to randomly keep (default 1 = all)
   */
  links(probability = 1): this {
    const all = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href]")
    ).filter((a) => a.href.startsWith("http") && !a.closest("#storm-live-root"))
    const count =
      probability >= 1 ? all.length : Math.max(1, Math.round(probability * all.length))

    const cur = seqFor(this._lineId)
    if (cur.mode === "seq") {
      this._links = Array.from({ length: count }, (_, i) => all[(cur.link + i) % all.length])
      cur.link = (cur.link + count) % Math.max(all.length, 1)
    } else {
      this._links = all.sort(() => Math.random() - 0.5).slice(0, count)
    }

    this._lastOp = "link"
    this.log.push(`link(${probability === 1 ? "all" : probability.toFixed(2)}) → ${this._links.length}/${all.length}`)
    return this
  }


  // ── Manipulators ───────────────────────────────────────────

  redacts(probability = 0.5): this {
    if (this._lastOp === "paragraph") {
      let count = 0
      for (const para of this._paragraphs) {
        if (Math.random() < probability) {
          markPara(para, this._lineId)
          para.textContent = (para.textContent ?? "").replace(/[^\s]/g, "█")
          count++
        }
      }
      this.log.push(`redact(${probability.toFixed(2)}) → ${count}/${this._paragraphs.length} paragraphs`)
    } else {
      let count = 0
      for (const node of this.nodes) {
        if (Math.random() < probability) {
          const original = node.textContent ?? ""
          const span = document.createElement("span")
          span.dataset.stormRedact = original
          span.dataset.stormLine = String(this._lineId)
          span.textContent = original.replace(/[^\s]/g, "█")
          node.parentNode?.insertBefore(span, node)
          node.remove()
          count++
        }
      }
      this.log.push(`redact(${probability.toFixed(2)}) → ${count}/${this.nodes.length}`)
    }
    return this
  }

  highlights(probability = 0.5): this {
    if (this._lastOp === "paragraph") {
      let count = 0
      for (const para of this._paragraphs) {
        if (Math.random() < probability) {
          markPara(para, this._lineId)
          para.style.backgroundColor = this._color
          count++
        }
      }
      this.log.push(`highlight(${probability.toFixed(2)}) → ${count}/${this._paragraphs.length} paragraphs`)
    } else {
      let count = 0
      for (const node of this.nodes) {
        if (Math.random() < probability) {
          const span = document.createElement("span")
          span.dataset.stormHighlight = "true"
          span.dataset.stormLine = String(this._lineId)
          span.style.backgroundColor = this._color
          span.style.borderRadius = "2px"
          span.style.padding = "0 1px"
          node.parentNode?.insertBefore(span, node)
          span.appendChild(node)
          this._highlighted.push(span)
          count++
        }
      }
      this._lastOp = "highlight"
      this.log.push(`highlight(${probability.toFixed(2)}) → ${count}/${this.nodes.length}`)
    }
    return this
  }

  /**
   * Apply color based on context:
   *   after text      → set CSS text color on selected nodes
   *   after highlight → set background color of highlight spans
   *   after bg        → set page background color
   */
  setColor(r: number, g: number, b: number): this {
    this._color = `rgb(${r | 0},${g | 0},${b | 0})`

    if (this._lastOp === "paragraph") {
      for (const para of this._paragraphs) {
        markPara(para, this._lineId)
        para.style.color = this._color
      }
    } else if (this._lastOp === "text") {
      // Wrap each selected text node in a color span
      for (const node of this.nodes) {
        const span = document.createElement("span")
        span.dataset.stormColor = "true"
        span.dataset.stormLine = String(this._lineId)
        span.style.color = this._color
        node.parentNode?.insertBefore(span, node)
        span.appendChild(node)
        this._colorSpans.push(span)
      }
    } else if (this._lastOp === "highlight") {
      for (const span of this._highlighted) span.style.backgroundColor = this._color
    } else if (this._lastOp === "bg" && this._bgStyle) {
      this._bgStyle.textContent = `
        html, body,
        div:not(#storm-live-root):not(#storm-live-root *),
        main:not(#storm-live-root *),
        article:not(#storm-live-root *),
        section:not(#storm-live-root *),
        aside:not(#storm-live-root *),
        header:not(#storm-live-root *),
        footer:not(#storm-live-root *),
        nav:not(#storm-live-root *),
        [class*="container"]:not(#storm-live-root *),
        [class*="wrapper"]:not(#storm-live-root *),
        [class*="content"]:not(#storm-live-root *),
        [class*="layout"]:not(#storm-live-root *),
        [class*="page"]:not(#storm-live-root *),
        [class*="app"]:not(#storm-live-root *),
        [class*="root"]:not(#storm-live-root):not(#storm-live-root *),
        [class*="bg"]:not(#storm-live-root *),
        [class*="background"]:not(#storm-live-root *) {
          background-color: ${this._color} !important;
        }
      `
    }

    this.log.push(`color(${r | 0},${g | 0},${b | 0})`)
    return this
  }

  /**
   * Set font-weight on selected text nodes or whole paragraphs.
   * @param value  CSS font-weight — e.g. 100, 400, 700, 900
   */
  weight(value = 400): this {
    const fw = String(Math.round(value / 100) * 100)
    if (this._lastOp === "paragraph") {
      for (const para of this._paragraphs) {
        markPara(para, this._lineId)
        para.style.fontWeight = fw
      }
    } else {
      for (const node of this.nodes) {
        const span = document.createElement("span")
        span.dataset.stormWeight = "true"
        span.dataset.stormLine = String(this._lineId)
        span.style.fontWeight = fw
        node.parentNode?.insertBefore(span, node)
        span.appendChild(node)
      }
    }
    this.log.push(`weight(${value | 0})`)
    return this
  }

  /**
   * Set font-size on selected text nodes or whole paragraphs.
   * @param value  CSS font-size in px (e.g. 12, 32, 96)
   */
  size(value = 16): this {
    const fs = `${value}px`
    if (this._lastOp === "paragraph") {
      for (const para of this._paragraphs) {
        markPara(para, this._lineId)
        para.style.fontSize = fs
      }
    } else {
      for (const node of this.nodes) {
        const span = document.createElement("span")
        span.dataset.stormSize = "true"
        span.dataset.stormLine = String(this._lineId)
        span.style.fontSize = fs
        node.parentNode?.insertBefore(span, node)
        span.appendChild(node)
      }
    }
    this.log.push(`size(${value | 0}px)`)
    return this
  }

  // ── Utilities ──────────────────────────────────────────────

  toString(): string {
    return this.log.join(" · ") || "[StormChain]"
  }
}

export function storm(lineId = 0): StormChain {
  return new StormChain(lineId)
}
