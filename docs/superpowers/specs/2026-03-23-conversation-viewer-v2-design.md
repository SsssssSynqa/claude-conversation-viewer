# Claude Conversation Viewer V2 — Design Spec

## Overview

Major overhaul of the Claude Conversation Viewer — a single-file HTML tool for viewing and managing Claude conversation exports. Originally built in 2025 as a 40KB single-file HTML, now being rebuilt with modular architecture, three themes, full thinking/COT support, enhanced search, statistics, and improved export.

**GitHub**: `SsssssSynqa/claude-conversation-viewer`
**Live**: GitHub Pages (existing deployment)
**Data source**: Claude data export JSON (`conversations.json` from Settings > Data Export)

## Critical Bug Fix

The #1 reason for this rewrite: **thinking/COT blocks were not being exported**.

Root cause: The parser looked for `item.text` on thinking blocks, but Claude's export format stores thinking content in `item.thinking`. The field name mismatch caused all 7,183 thinking blocks to silently export as empty.

## Data Format (Claude Export JSON)

### Top-Level Structure
```json
[
  {
    "uuid": "string",
    "name": "string (conversation title)",
    "summary": "string",
    "created_at": "ISO 8601",
    "updated_at": "ISO 8601",
    "account": { ... },
    "chat_messages": [ ... ]
  }
]
```

### Message Structure
```json
{
  "uuid": "string",
  "sender": "human | assistant",
  "content": [ ContentItem, ... ],
  "text": "string (sometimes present)",
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601",
  "files": [{ "file_name": "string" }],
  "attachments": [ ... ]
}
```

### Content Item Types (6 types)

| Type | Key Fields | Display |
|------|-----------|---------|
| `text` | `text` | Main content, Markdown rendered |
| `thinking` | `thinking` (NOT `text`!), `summaries`, `start_timestamp`, `stop_timestamp`, `cut_off`, `truncated` | Collapsible block with summary preview and thinking duration |
| `tool_use` | `name`, `input`, `message` | Collapsible card showing tool name and parameters |
| `tool_result` | Paired with preceding `tool_use` by position (see pairing logic below) | Shown inside the tool_use card |
| `token_budget` | (no meaningful fields) | Hidden by default, toggleable |
| `flag` | `flag` (e.g. "self_harm_risk"), `helpline` | Hidden by default, toggleable via "Show system flags" setting |

### Sample Thinking Block
```json
{
  "type": "thinking",
  "thinking": "用户问的是关于...",
  "summaries": [
    { "summary": "思考纯氧长期吸入对人体的生理影响" }
  ],
  "start_timestamp": "2025-11-09T05:49:27.666364Z",
  "stop_timestamp": "2025-11-09T05:49:35.919653Z",
  "cut_off": false,
  "truncated": false
}
```

### tool_use / tool_result Pairing Logic

In Claude's export format, `tool_use` blocks appear in **assistant** messages and `tool_result` blocks appear in the **next human message** (the system injects tool results as human-side content). Pairing algorithm:

1. When parsing messages sequentially, maintain a stack of pending `tool_use` items (keyed by position index within the conversation).
2. When a `tool_result` is encountered in the next message, pair it with the corresponding `tool_use` by array position (first tool_result matches first tool_use, etc.).
3. If a `tool_use` has no matching `tool_result`, display it as standalone (tool may have been interrupted).
4. If a `tool_result` has no matching `tool_use`, display it as a standalone result block.
5. Paired items render as a single collapsible card: tool name + input on top, result below.

### Sample Flag Block
```json
{
  "type": "flag",
  "flag": "self_harm_risk",
  "helpline": {
    "name": "Samaritans of Singapore",
    "phone_number": "1767"
  }
}
```

## Architecture

### Build System
- **Vite** for development and bundling
- **vite-plugin-singlefile** to produce a single distributable `index.html`
- No framework (React/Vue) — vanilla JS with modular components
- External deps: `marked` (Markdown), `highlight.js` (code highlighting, subset: js/ts/python/html/css/json/bash/markdown), inlined at build
- **Web Worker in single-file mode**: Use Vite's `?worker&inline` import suffix, which inlines the worker code as a blob URL. This is natively supported by Vite and compatible with vite-plugin-singlefile.
- **Charts**: Use lightweight Canvas-based chart rendering (custom implementation with `<canvas>`) for the 2-3 charts needed. No Chart.js — too heavy (~200KB) for our single-file target. Simple line/bar charts can be drawn in ~200 lines of code.

### Directory Structure
```
claude-conversation-viewer/
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.js                    # Entry: init theme, bind events, orchestrate
│   ├── parser/
│   │   ├── worker.js              # Web Worker for background JSON parsing
│   │   └── claude.js              # Claude format parser (6 content types)
│   ├── store/
│   │   └── state.js               # Lightweight global state (conversations, filters, current view)
│   ├── components/
│   │   ├── FileUpload.js          # Drag-drop upload + Clawd loading animation
│   │   ├── ConversationList.js    # Virtual-scrolled, grouped, searchable list
│   │   ├── MessageView.js         # Message display (Markdown, COT, tool cards)
│   │   ├── StatsPanel.js          # Statistics dashboard
│   │   ├── SearchBar.js           # Global search + filters
│   │   └── ExportDialog.js        # Export options modal
│   ├── themes/
│   │   ├── variables.css          # CSS variable definitions for all themes
│   │   ├── dark.css               # Dark theme overrides
│   │   ├── light.css              # Light theme overrides
│   │   └── claude.css             # Claude-style theme overrides
│   └── utils/
│       ├── markdown.js            # marked + highlight.js wrapper
│       ├── export.js              # TXT/MD/HTML export logic
│       ├── virtual-scroll.js      # Virtual scroll implementation
│       └── time.js                # Time formatting utilities
├── docs/
│   └── superpowers/specs/         # This spec
└── dist/                          # Build output (single index.html)
```

### State Management

`store/state.js` implements a simple pub/sub event emitter pattern:
- Central `state` object holds: `conversations[]`, `currentConversationIndex`, `filters`, `searchQuery`, `theme`, `displayNames`
- Components subscribe to state changes via `state.on('conversations:loaded', callback)`
- State mutations go through `state.set('key', value)` which triggers subscribers
- No proxy magic, no framework — just an EventEmitter with a plain object. ~50 lines of code.

### Display Names

Two configurable name fields (default "Synqa" / "Sylux") that replace `human`/`assistant` labels everywhere: message headers, stats panel, export output. Stored in `localStorage` for persistence.

### Performance Strategy: Web Worker + Clawd Loading Animation

The export JSON can be 187MB+ (140 conversations, 16,929 messages). Strategy:

1. **File upload** triggers Web Worker
2. **Worker** parses JSON in background thread, posts progress messages back to main thread
3. **Main thread** displays Clawd the crab loading animation with progress ("Carrying your memories... 42/140 conversations")
4. **Clawd animation**: pixel-art orange crab walking sideways across the screen, trailing bubbles, progress bar below. When done, crab does a happy bounce and exits.
5. **Virtual scrolling** for conversation list (fixed-height rows, straightforward) and message view (variable-height rows — use a "measure then cache" approach: render each message offscreen once to get its height, cache the height, then use cached heights for scroll position calculations. For initial render before measurement, estimate heights based on content length.)

### Virtual Scroll Detail

- **Conversation list**: Fixed row height (~60px per item). Standard virtual scroll — only render items within viewport ± buffer zone.
- **Message view**: Variable height. Strategy:
  1. On conversation open, estimate heights (e.g., 1 line per 80 chars + base padding)
  2. As messages scroll into view, measure actual rendered height and cache it
  3. Use cached heights for accurate scroll position and scrollbar behavior
  4. Overscan buffer: render 5 extra items above/below viewport
- Library: custom implementation (~150 lines). No third-party dependency needed for our use case.

## Theme System

CSS custom properties on `<html data-theme="dark|light|claude">`. Theme switch button in top-right corner with three icons: moon (dark), sun (light), Claude logo/chrysanthemum (claude).

Default: follows `prefers-color-scheme` system preference. Manual selection saved to `localStorage`.

### Dark Theme ("关灯版" — original)
- Background: deep blue gradient (`#1a1a2e` → `#16213e` → `#0f3460`)
- Cards: frosted glass (`rgba(255,255,255,0.05)` + `backdrop-filter: blur(10px)`)
- Accent: purple gradient (`#667eea` → `#764ba2`)
- Text: light gray (`#e8e8e8`)
- Vibe: starry night memory vault

### Light Theme ("开灯版")
- Background: warm white (`#fafaf8`)
- Cards: very light gray (`#f5f5f3`) with subtle shadows
- Accent: brightened purple (`#7c5cbf`)
- Text: dark gray (`#2d2d2d`), not pure black
- Vibe: sunny room, reading a journal

### Claude Theme ("怀旧版")
- Sidebar: warm dark brown (`#2d2b28`)
- Content area: cream/parchment (`#f9f5ef`)
- Accent: Claude's signature brown-orange (`#da7756`)
- Message layout: open layout without bubble borders, spacing-based separation (matching actual Claude UI)
- Top bar: breadcrumb navigation style (Project / Conversation)
- Font stack: Söhne → -apple-system → system-ui fallback
- Vibe: "browsing Claude inside Claude" — recursive nostalgia

## Page Layout & Interaction

### State 1: File Upload (initial)
- Centered upload zone (drag-drop + click)
- Two name input fields below (default: "Synqa" / "Sylux")
- Brief usage instructions
- Clean, minimal

### State 2: Loading (Clawd animation)
- Upload zone collapses
- Full-screen Clawd crab animation
- Progress bar + counter text
- Crab walks, bubbles trail, numbers tick up

### State 3: Main View (two-panel)
- **Left panel** (collapsible):
  - Search box at top
  - Conversation list grouped by month
  - Each item shows: title, date, message count, icons for thinking/flag presence
  - Hover shows first 2 messages as preview
  - Virtual scrolling for performance
- **Right panel** (main content):
  - Conversation header: title, date range, message count
  - Message stream with breathing room between messages
  - Auto-inserted time separators when gap > 1 hour ("— 3 hours later —")
  - Markdown rendering with code syntax highlighting
  - Thinking blocks: collapsed by default, show first summary line, expand to full content with thinking duration badge
  - Tool use: collapsed cards with tool icon + name, expand to show input/output
  - Flag markers: hidden by default, shown as ⚠️ badge when "Show system flags" enabled
  - File attachments: file icon + filename label

### Stats Panel
Accessed from toolbar chart icon. Overlay or slide-in panel.

**Basic stats:**
- Total conversations, messages, characters (split by human/assistant)
- Time span (first to last message date)

**Fun stats:**
- Top 5 longest conversations
- Late-night conversations (after 2 AM)
- Conversation frequency heatmap (which days had the most chats)
- Total Sylux thinking time (calculated from thinking block timestamps)
- Thinking summary word cloud (optional)

**Charts** (if using Chart.js or lightweight alternative):
- Monthly conversation frequency line chart
- Monthly character count stacked bar chart

### Search & Filtering
- **Global search**: searches across all conversations, results shown as snippets with context
- Click search result → jumps to conversation + scrolls to matching message
- **Filters**:
  - Date range picker
  - Role filter (human only / assistant only / both)
  - Content type filter (has thinking / has tool_use / has flag)
- Search result highlighting with auto-scroll to first match

### Export
- **Formats**: Plain text (.txt), Markdown (.md), Styled HTML (.html, preserves current theme)
- **Scope**: Single conversation, batch-selected conversations, all conversations
- **Options** (checkboxes):
  - Include thinking/COT blocks
  - Include tool_use/tool_result
  - Include system flags
- **Markdown format** for thinking blocks:
  ```markdown
  > 💭 **Thinking** (8.2s)
  >
  > thinking content here...
  ```
- **Markdown format** for tool use:
  ```markdown
  > 🔧 **Tool: view**
  >
  > Input: `{"path": "/mnt/project"}`
  >
  > Result: ...
  ```

### Mobile Responsiveness
- Left panel collapses to hamburger menu or bottom-swipe drawer
- Message view goes full-width
- Touch-friendly tap targets
- Theme switch remains accessible

### Markdown Rendering Configuration

- **Sanitization**: YES — use `marked` with DOMPurify or built-in sanitizer to prevent XSS from crafted export JSON
- **GFM**: enabled (tables, strikethrough, task lists)
- **Line breaks**: `breaks: true` (single newline = `<br>`)
- **highlight.js languages**: js, typescript, python, html, css, json, bash, markdown, sql, rust, go, java, xml (subset to keep bundle small)
- **LaTeX/math**: Not in V2 scope. Can be added later with KaTeX plugin if needed.
- **Links**: rendered as clickable `<a target="_blank" rel="noopener">`

### Search Performance

- Search index is built during parsing phase (in Web Worker): each message gets a lowercase plain-text version stored alongside the parsed data
- Global search runs against pre-built index, debounced at 300ms
- Results limited to first 50 matches with "load more" button
- Search runs on main thread (index is in-memory, fast string matching)

### Conversation Batch Selection (for Export)

- Each conversation list item has a checkbox (visible on hover, always visible in "select mode")
- "Select mode" toggled from export dialog or toolbar button
- Shift+click for range selection
- "Select all" / "Deselect all" buttons

### Error Handling

| Error | UI Response |
|-------|------------|
| Invalid JSON file | Error banner: "This file doesn't appear to be valid JSON. Please upload a Claude export file." |
| Valid JSON but wrong format | Error banner: "This JSON doesn't match Claude's export format. Expected an array of conversations." |
| File too large (browser memory) | Warning shown at 300MB+. Worker will attempt parsing; if it crashes, show "File too large for browser. Try splitting your export." |
| Web Worker crash | Fall back to main-thread parsing with a warning "Loading may freeze the page for a moment..." |
| Empty conversations | Filtered out silently (same as V1) |

### Clawd Loading Animation

The Clawd crab is a CSS-only pixel art animation (no sprite sheet dependency):
- Built with CSS `box-shadow` pixel art technique or small inline SVG
- 32×32 pixel grid, orange color (#da7756), simple crab shape with claws
- Animation: CSS keyframes for sideways walking, claw snapping, bubble trail
- Progress bar below with conversation count
- On completion: bounce animation + fade out
- Fallback: if CSS animation causes issues, simple spinner + text progress

## V1 Feature Parity Checklist

All V1 features must be preserved:
- [x] Upload Claude JSON file
- [x] Custom display names (user/assistant)
- [x] Conversation list with message counts
- [x] Open conversation in modal/panel to read messages
- [x] Search within conversation
- [x] Show/hide thinking blocks toggle
- [x] Select individual messages for export
- [x] Select conversations for batch export
- [x] Export as text file
- [x] Global stats (total conversations, messages, characters, time span)

## Testing Strategy

- Test with actual 187MB export file to verify performance
- Verify all 6 content types render correctly
- Verify thinking blocks export with correct content (not empty)
- Test all three themes
- Test search across large dataset
- Test virtual scrolling with 16,000+ messages
- Cross-browser: Chrome, Safari, Firefox

## Migration

- Existing GitHub Pages deployment stays on `main` branch
- New version replaces `index.html` (built from `dist/`)
- README updated with new features and screenshots
- No breaking changes to user workflow (still upload JSON → view)
