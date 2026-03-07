import { useState } from "react"

const C = {
  bg: "#09090f",
  surface: "#0d0d16",
  border: "#1e1e2e",
  accent: "#6366f1",
  accentDim: "#3730a3",
  text: "#e2e8f0",
  muted: "#6b7280",
  green: "#34d399",
  code: "#818cf8"
}

interface ApiMethod {
  call: string
  desc: string
  example?: string
}

const API: ApiMethod[] = [
  {
    call: "storm",
    desc: "Initialize the Storm chain. Always start here.",
    example: "storm"
  },
  {
    call: "text",
    desc: "Select all visible text nodes on the page.",
    example: "storm > text"
  },
  {
    call: "redact p",
    desc: "Replace non-whitespace chars with █ at probability p (0–1).",
    example: "storm > text > redact 0.5"
  },
  {
    call: "highlight p",
    desc: "Wrap text nodes in a colored span at probability p. Default color: rgb(100,0,0).",
    example: "storm > text > highlight 0.5"
  },
  {
    call: "color r g b",
    desc: "Set highlight color and recolor any already-highlighted spans.",
    example: "storm > text > highlight 0.5 > color 100 0 0"
  }
]

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: "#1a1a2e",
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        padding: "1px 7px",
        fontSize: 11,
        fontFamily: "Consolas, monospace",
        color: C.code
      }}>
      {children}
    </span>
  )
}

export default function IndexPopup() {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div
      style={{
        width: 340,
        background: C.bg,
        color: C.text,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13
      }}>
      {/* Header */}
      <div
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: "0.06em",
              color: C.accent
            }}>
            STORM LIVE
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>
            Live DOM manipulation console
          </div>
        </div>
      </div>

      {/* Status pill */}
      <div style={{ padding: "10px 16px 0" }}>
        <div
          style={{
            background: "#0d1f17",
            border: "1px solid #14532d",
            borderRadius: 6,
            padding: "7px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11
          }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: C.green,
              display: "inline-block",
              boxShadow: `0 0 6px ${C.green}`
            }}
          />
          <span style={{ color: C.green }}>
            Active on all pages — open any tab to see the console
          </span>
        </div>
      </div>

      {/* API Reference */}
      <div style={{ padding: "14px 16px 0" }}>
        <div
          style={{
            color: C.muted,
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8
          }}>
          API Reference
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: "hidden"
          }}>
          {API.map((m) => (
            <div
              key={m.call}
              style={{
                background: C.surface,
                padding: "10px 12px",
                borderBottom: `1px solid ${C.border}`
              }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4
                }}>
                <Tag>{m.call}</Tag>
              </div>
              <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
                {m.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick copy examples */}
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            color: C.muted,
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8
          }}>
          Quick Examples
        </div>
        {[
          "storm > text > redact 0.5",
          "storm > text > highlight 0.5",
          "storm > text > highlight 0.5 > color 100 0 0",
          "storm > text > highlight 1 > color 0 100 0"
        ].map((ex) => (
          <div
            key={ex}
            onClick={() => copy(ex)}
            style={{
              background: C.surface,
              border: `1px solid ${copied === ex ? C.accent : C.border}`,
              borderRadius: 6,
              padding: "8px 12px",
              marginBottom: 6,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              transition: "border-color 0.15s",
              fontFamily: "Consolas, monospace",
              fontSize: 12,
              color: copied === ex ? C.accent : C.code
            }}>
            <span>{ex}</span>
            <span style={{ color: C.muted, fontSize: 10 }}>
              {copied === ex ? "✓ copied" : "copy"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
