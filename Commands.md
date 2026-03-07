# Storm Live — Command Reference

## Syntax

```
storm [bpm] > selector > manipulator [args] > manipulator [args] ...
```

- Each **line** is an independent effect
- Use `//` to comment out a line
- `rand min max` can replace any numeric argument — re-evaluated every beat

---

## Initialiser

| Command | Description |
|---|---|
| `storm` | Start a one-shot chain |
| `storm 120` | Start a chain that repeats at 120 BPM (every 500 ms) |

## Run mode (place after selector)

| Command | Description |
|---|---|
| `run random` | *(default)* Each beat selects a fresh random subset of nodes |
| `run seq` | Each beat advances a window through the nodes sequentially, looping |

```
storm 120 > text 0.5 > run seq > redact 1
storm 120 > text 0.25 > run seq > color 255 0 0
storm 120 > text 0.5 > run random > highlight 1
```

---

## Selectors

| Command | Parameters | Description |
|---|---|---|
| `text` | `p=1` | Select all visible text nodes. `p` = fraction to keep |
| `paragraph` | `p=1` | Select whole `<p>` elements. `p` = fraction of paragraphs to keep. Manipulators act on the full element. |
| `bg` | — | Select the page background (html, body, and common layout elements) |
| `link` | `p=1` | Select `<a href>` links. `p` = fraction to keep |

---

## Manipulators

| Command | Parameters | Description |
|---|---|---|
| `redact` | `p=0.5` | Replace non-whitespace chars with █ at probability `p`. After `paragraph`: redacts the entire `<p>` |
| `highlight` | `p=0.5` | Highlight at probability `p`. After `paragraph`: sets `background-color` on the whole `<p>` |
| `color` | `r g b` | Text color after `text`/`paragraph`; background after `highlight` or `bg` |
| `weight` | `value=400` | Set CSS `font-weight` (100–900). After `paragraph`: applies to the whole `<p>` |
| `size` | `value=16` | Set CSS `font-size` in px. After `paragraph`: applies to the whole `<p>` |

---

## `rand` expression

Resolves to a random float in `[min, max)` — re-rolled on every beat.

```
rand min max
```

Can be used as any numeric argument:

```
storm 120 > text rand 0.3 0.8 > size rand 12 80
storm 60  > bg > color rand 0 255 rand 0 255 rand 0 255
```

---

## Examples

```
// flash page background red at 120 BPM
storm 120 > bg > color rand 0 100 0 0 0

// redact half the text on the page (one-shot)
storm > text 1 > redact 0.5

// randomly highlight text with a random color each beat
storm 90 > text rand 0.2 0.6 > highlight 1 > color rand 0 255 rand 0 255 rand 0 255

// change text color and weight every beat
storm 120 > text 0.5 > color rand 0 200 0 0 0 > weight rand 100 900

// grow random text nodes each beat
storm 60 > text rand 0.1 0.5 > size rand 10 96

// select 50% of paragraphs, redact 50% of those entirely
storm > paragraph 0.5 > redact 0.5

// highlight random paragraphs every beat
storm 120 > paragraph rand 0.2 0.6 > highlight 1 > color rand 100 255 0 0 0

// multi-line: two independent effects running simultaneously
storm 120 > bg > color rand 0 80 0 0 0
storm 60  > text rand 0.3 0.7 > redact rand 0.3 0.9
```
