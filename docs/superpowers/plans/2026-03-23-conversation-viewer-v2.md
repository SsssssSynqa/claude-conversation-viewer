# Claude Conversation Viewer V2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Claude Conversation Viewer from a single 40KB HTML file into a modular Vite-based app with three themes, full COT/thinking support, enhanced search, statistics, and multi-format export — while still shipping as a single distributable HTML file.

**Architecture:** Vanilla JS modules bundled by Vite + vite-plugin-singlefile. Web Worker for background parsing of large JSON files. CSS custom properties for theme switching. Virtual scrolling for performance with 16K+ messages.

**Tech Stack:** Vite, vite-plugin-singlefile, marked, highlight.js (subset), DOMPurify, vanilla JS

**Spec:** `docs/superpowers/specs/2026-03-23-conversation-viewer-v2-design.md`

**Test data:** `/Users/arthas/Desktop/Synergia/Claude/数据导出/data-2026-03-14-14-05-18-batch-0000/conversations.json` (187MB, 140 conversations, 16,929 messages, 7,183 thinking blocks)

**Security note:** All user-generated content rendered as HTML must be sanitized with DOMPurify before DOM insertion. Use `textContent` for plain text, `DOMPurify.sanitize(marked.parse(content))` for Markdown content. Never use raw innerHTML with untrusted data.

---

## File Map

| File | Responsibility | Created/Modified |
|------|---------------|-----------------|
| `package.json` | Dependencies and scripts | Create |
| `vite.config.js` | Build config with singlefile plugin | Create |
| `index.html` | Entry HTML shell (replaces existing) | Replace |
| `src/main.js` | App entry: init theme, bind events, orchestrate components | Create |
| `src/store/state.js` | Pub/sub state management (~50 lines) | Create |
| `src/parser/claude.js` | Claude JSON parser: 6 content types, search index builder | Create |
| `src/parser/worker.js` | Web Worker: loads JSON, calls parser, posts progress | Create |
| `src/utils/time.js` | Time formatting and duration utilities | Create |
| `src/utils/markdown.js` | marked + highlight.js + DOMPurify wrapper | Create |
| `src/utils/virtual-scroll.js` | Virtual scroll for fixed and variable height rows | Create |
| `src/utils/charts.js` | Lightweight canvas chart drawing (line, bar) | Create |
| `src/utils/export.js` | Export to TXT/MD/HTML with options | Create |
| `src/components/FileUpload.js` | Drag-drop upload + Clawd loading animation | Create |
| `src/components/ConversationList.js` | Left panel: grouped list with virtual scroll | Create |
| `src/components/MessageView.js` | Right panel: message stream with all content types | Create |
| `src/components/SearchBar.js` | Global search + filter controls | Create |
| `src/components/StatsPanel.js` | Statistics overlay with charts | Create |
| `src/components/ExportDialog.js` | Export options modal | Create |
| `src/themes/variables.css` | CSS custom properties for all themes | Create |
| `src/themes/dark.css` | Dark theme (关灯版) | Create |
| `src/themes/light.css` | Light theme (开灯版) | Create |
| `src/themes/claude.css` | Claude theme (怀旧版) | Create |
| `src/styles/base.css` | Reset, typography, shared layout | Create |
| `src/styles/components.css` | Component-specific styles | Create |
| `README.md` | Updated docs | Modify |

---

## Task 1: Project Scaffolding and Build System

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html` (new shell), `src/main.js`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/arthas/Desktop/Synergia/Claude/claude-conversation-viewer
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install --save-dev vite vite-plugin-singlefile
npm install marked highlight.js dompurify
```

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: Infinity,
  },
});
```

- [ ] **Step 4: Rename old index.html and create new entry shell**

```bash
mv index.html index.v1.html
```

New `index.html`: minimal HTML with `<div id="app">`, theme data attribute on `<html>`, module script tag pointing to `src/main.js`.

- [ ] **Step 5: Create minimal src/main.js**

Import base CSS, log a startup message, render a placeholder heading using textContent.

- [ ] **Step 6: Create placeholder CSS files**

Create `src/styles/base.css` and `src/themes/variables.css` with minimal content.

- [ ] **Step 7: Verify build works**

```bash
npx vite build
ls -la dist/index.html
npx vite  # Dev server should work
```

- [ ] **Step 8: Add .gitignore entries and commit**

Add `node_modules/`, `dist/` to `.gitignore`.

```bash
git add -A
git commit -m "feat: scaffold Vite project with singlefile plugin"
```

---

## Task 2: State Management and Theme System

**Files:**
- Create: `src/store/state.js`, `src/themes/variables.css`, `src/themes/dark.css`, `src/themes/light.css`, `src/themes/claude.css`, `src/styles/base.css`

- [ ] **Step 1: Create state.js — pub/sub event emitter**

Store class with `get(key)`, `set(key, value)`, `on(key, callback)` methods. Initial state includes: conversations, filteredConversations, currentConversationIndex, searchQuery, filters, theme, displayNames, showThinking, showToolUse, showFlags, loading, loadingProgress.

- [ ] **Step 2: Create CSS variables file — all three themes**

`src/themes/variables.css`: Define `[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="claude"]` blocks with all color/spacing/font variables. Include system preference detection with `@media (prefers-color-scheme)` for `[data-theme="auto"]`.

Key variables: `--bg-primary`, `--bg-secondary`, `--bg-card`, `--text-primary`, `--text-secondary`, `--accent`, `--accent-hover`, `--border`, `--sidebar-bg`, `--sidebar-text`, `--message-human-bg`, `--message-assistant-bg`, `--thinking-bg`, `--tool-bg`, `--flag-bg`, `--shadow`, `--radius`, `--font-family`.

Dark theme colors: deep blue gradient (#1a1a2e to #0f3460), purple accent (#667eea to #764ba2), light gray text (#e8e8e8).
Light theme colors: warm white (#fafaf8), subtle purple accent (#7c5cbf), dark gray text (#2d2d2d).
Claude theme colors: cream content (#f9f5ef), warm dark brown sidebar (#2d2b28), brown-orange accent (#da7756).

- [ ] **Step 3: Create individual theme CSS files**

`dark.css`, `light.css`, `claude.css` — each adds theme-specific styles (e.g., dark theme's backdrop-filter frosted glass, Claude theme's breadcrumb nav).

- [ ] **Step 4: Create base.css — reset, typography, layout**

Box-sizing reset, body styles using CSS variables, `.container`, `.two-panel` layout (CSS Grid: sidebar + main), responsive breakpoints.

- [ ] **Step 5: Wire theme switching into main.js**

Function `applyTheme(theme)`: if 'auto' check `prefers-color-scheme`, otherwise set `data-theme` attribute. Subscribe to state changes. Persist to localStorage.

- [ ] **Step 6: Verify themes switch correctly via dev server**

- [ ] **Step 7: Commit**

```bash
git add src/store src/themes src/styles
git commit -m "feat: add state management and three-theme CSS system"
```

---

## Task 3: Claude JSON Parser and Web Worker

**Files:**
- Create: `src/parser/claude.js`, `src/parser/worker.js`, `src/utils/time.js`

- [ ] **Step 1: Create time.js utilities**

Functions: `formatTimestamp(iso)`, `formatDuration(startIso, stopIso)` returns human-readable duration like "8.2s", `formatRelativeDate(iso)`, `getTimeDiffMinutes(iso1, iso2)`.

- [ ] **Step 2: Create claude.js parser**

Core function: `parseConversation(rawConv)` returns parsed conversation with:
- Conversation metadata: uuid, name, summary, createdAt, updatedAt
- Messages array with each message containing: uuid, sender, createdAt, contentBlocks array, files array, searchText (lowercase concatenation for search index)
- ContentBlock types handled:
  - `text`: extract `item.text`
  - `thinking`: extract `item.thinking` (NOT item.text!), `item.summaries`, compute duration from timestamps
  - `tool_use`: extract `item.name`, `item.input`
  - `tool_result`: pair with preceding tool_use by position
  - `token_budget`: mark as system metadata
  - `flag`: extract `item.flag`, `item.helpline`
- Per-conversation stats: message count, char counts (human/assistant), has thinking, has flags, has tools

- [ ] **Step 3: Create worker.js — Web Worker**

Receives JSON string via postMessage, parses it, iterates conversations one by one posting progress, sends final parsed result. Uses Vite `?worker&inline` for single-file compatibility.

Error handling: catch JSON parse errors, catch malformed data, post error messages back to main thread.

- [ ] **Step 4: Test parser against real data**

Quick validation: load the 187MB file, verify conversation count (132 non-empty), verify thinking blocks have content (not empty), verify tool pairs are linked, verify flags are captured.

- [ ] **Step 5: Commit**

```bash
git add src/parser src/utils/time.js
git commit -m "feat: add Claude JSON parser with COT/thinking support and Web Worker"
```

---

## Task 4: File Upload + Clawd Loading Animation

**Files:**
- Create: `src/components/FileUpload.js`, `src/styles/clawd.css`

- [ ] **Step 1: Create FileUpload component**

Renders: drag-drop zone with dashed border, two name input fields (default "Synqa" / "Sylux"), usage instructions. On file drop/select, reads file via FileReader as text, spawns Web Worker (imported with `?worker&inline`), subscribes to progress messages, updates loading state.

- [ ] **Step 2: Create Clawd CSS animation**

`src/styles/clawd.css`: Pixel-art crab using CSS box-shadow technique or inline SVG (swappable if user provides a Clawd asset). Keyframe animations: sideways walking cycle, claw snapping, bubble trail using pseudo-elements. Progress bar below. Bounce-and-exit on completion. Fallback: simple spinner + text if CSS animation has issues.

- [ ] **Step 3: Wire into main.js**

FileUpload instance created on app start. On loading complete (conversations loaded into state), hide upload, initialize main view components.

- [ ] **Step 4: Test upload with real 187MB file — verify Worker progress updates and no UI freeze**

- [ ] **Step 5: Commit**

```bash
git add src/components/FileUpload.js src/styles/clawd.css src/main.js
git commit -m "feat: add file upload with Clawd loading animation and Web Worker parsing"
```

---

## Task 5: Conversation List (Left Panel)

**Files:**
- Create: `src/components/ConversationList.js`, `src/utils/virtual-scroll.js`

- [ ] **Step 1: Create virtual-scroll.js**

Generic virtual scroll utility: takes container element, item count, item height (number or function), render callback. Handles scroll events, calculates visible range with buffer zone, renders only visible items. ~150 lines.

- [ ] **Step 2: Create ConversationList component**

- Groups conversations by month (using createdAt)
- Each item shows: title (or "Untitled"), date, message count, small icons (thinking/flag indicators)
- Click sets `state.currentConversationIndex`
- Hover shows tooltip preview (first 2 messages, truncated)
- Checkbox for batch selection (visible on hover, always visible in select mode)
- Title search filter at top of list
- Subscribes to `filteredConversations` state changes
- Uses virtual scroll with fixed ~60px row height

- [ ] **Step 3: Wire into main view layout**

Create the two-panel CSS Grid layout in main.js: left sidebar (300px, collapsible) with ConversationList, right area for MessageView.

- [ ] **Step 4: Test with 140 conversations — verify grouping, virtual scroll, click navigation**

- [ ] **Step 5: Commit**

```bash
git add src/components/ConversationList.js src/utils/virtual-scroll.js
git commit -m "feat: add conversation list with virtual scroll and month grouping"
```

---

## Task 6: Message View (Right Panel)

**Files:**
- Create: `src/components/MessageView.js`, `src/utils/markdown.js`, `src/styles/components.css`

- [ ] **Step 1: Create markdown.js wrapper**

Configure `marked` with: GFM enabled, breaks enabled (single newline = br), highlight.js for code blocks (language subset: js, typescript, python, html, css, json, bash, markdown, sql, rust, go, java, xml). All output sanitized through DOMPurify before DOM insertion. Links open in new tab with `rel="noopener"`.

- [ ] **Step 2: Create MessageView component**

Renders message stream for selected conversation. For each message:
- Message header: display name (from state.displayNames based on sender) + formatted timestamp
- Iterate contentBlocks, render by type:
  - `text`: Markdown rendered via `renderMarkdown()`, sanitized with DOMPurify
  - `thinking`: Collapsible details/summary element. Summary shows first line from summaries array. Duration badge. Full thinking text inside, rendered as plain text (not Markdown).
  - `tool_use`: Collapsible card. Header shows tool icon + name. Body shows input JSON formatted. If paired result exists, show result below input.
  - `tool_result` (unpaired): Standalone result block.
  - `token_budget`: Hidden unless showToolUse is true. Minimal indicator.
  - `flag`: Hidden unless showFlags is true. Warning badge with flag type text.
- File attachments: paperclip icon + filename as label.
- Time separators: when gap between consecutive messages exceeds 60 minutes, insert a centered divider with relative time text.

- [ ] **Step 3: Add virtual scroll for messages (variable height)**

Use measure-then-cache strategy: estimate initial heights based on content length, render into viewport, measure actual heights, cache. Overscan buffer of 5 items above/below.

- [ ] **Step 4: Test all 6 content types render correctly with real data**

Critical verification: thinking blocks must show actual content (not empty). Tool use cards must show tool name and input. Flags must appear when toggled on.

- [ ] **Step 5: Commit**

```bash
git add src/components/MessageView.js src/utils/markdown.js src/styles/components.css
git commit -m "feat: add message view with Markdown, COT, tool cards, and flags"
```

---

## Task 7: Search and Filtering

**Files:**
- Create: `src/components/SearchBar.js`

- [ ] **Step 1: Create SearchBar component**

- Global search input with 300ms debounce
- Filter controls: date range (two date inputs), role dropdown (all/human/assistant), content type dropdown (all/has-thinking/has-tool/has-flag)
- Search results dropdown: up to 50 snippet results with context (30 chars around match)
- Click result navigates to conversation + scrolls to matching message
- Search terms highlighted in message view

- [ ] **Step 2: Implement search logic**

Search against pre-built `searchText` index from parser. For each match, extract snippet with surrounding context. Results sorted by relevance.

- [ ] **Step 3: Implement filter logic**

Filter conversations array based on active filters, update `state.filteredConversations`. ConversationList subscribes and re-renders.

- [ ] **Step 4: Test search with real data — verify speed, accuracy, navigation**

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.js
git commit -m "feat: add global search with filters, snippets, and highlight"
```

---

## Task 8: Statistics Panel

**Files:**
- Create: `src/components/StatsPanel.js`, `src/utils/charts.js`

- [ ] **Step 1: Create charts.js — lightweight canvas charts**

Two functions: `drawLineChart(canvas, data, options)` and `drawBarChart(canvas, data, options)`. Pure canvas API drawing. ~200 lines total. Support axis labels, gridlines, data point labels, basic color fills.

- [ ] **Step 2: Create StatsPanel component**

Overlay panel accessed from toolbar chart icon.

Basic stats: total conversations, messages, characters (split human/assistant), time span (first to last date).

Fun stats: top 5 longest conversations (by message count, clickable to navigate), late-night conversations (messages between 00:00-05:00 local time), total thinking time (sum all thinking durations), average thinking duration per response.

Charts: monthly conversation frequency (line chart), monthly character count by role (stacked bar chart).

- [ ] **Step 3: Test stats accuracy against known data**

Verify totals match: 132 non-empty conversations, 16,929 messages, 7,183 thinking blocks.

- [ ] **Step 4: Commit**

```bash
git add src/components/StatsPanel.js src/utils/charts.js
git commit -m "feat: add statistics panel with charts and fun stats"
```

---

## Task 9: Export Enhancement

**Files:**
- Create: `src/components/ExportDialog.js`, `src/utils/export.js`

- [ ] **Step 1: Create export.js — three format exporters**

Three functions: `exportAsText()`, `exportAsMarkdown()`, `exportAsHTML()`. All accept conversations array and options object `{ includeThinking, includeToolUse, includeFlags, displayNames }`.

Text format: plain text with sender labels and timestamps, thinking blocks wrapped in "Thinking:" sections.

Markdown format: headers for each message, thinking in blockquote with duration, tool use in blockquote with tool name and input/result, horizontal rules between messages.

HTML format: standalone HTML file with CSS inlined from current theme. All messages rendered statically. No JavaScript required in output. DOMPurify used during generation.

All formats properly handle the `item.thinking` field (not `item.text`!) for COT content.

- [ ] **Step 2: Create ExportDialog component**

Modal with: format selector (TXT/MD/HTML radio buttons), scope indicator showing count, checkboxes for include thinking/tools/flags, export button triggering file download via Blob URL.

- [ ] **Step 3: Critical test — export a conversation with thinking blocks as Markdown, verify COT content is present and not empty**

This is the primary acceptance test for the #1 bug fix that motivated this entire rewrite.

- [ ] **Step 4: Commit**

```bash
git add src/components/ExportDialog.js src/utils/export.js
git commit -m "feat: add multi-format export with COT/thinking support"
```

---

## Task 10: Theme Switch UI + Polish

**Files:**
- Modify: `src/main.js`, `src/styles/components.css`

- [ ] **Step 1: Create theme toggle button**

Three-state toggle in top-right corner. Icons cycle through: moon (dark), sun (light), Claude chrysanthemum (claude). Shows current theme name on hover tooltip.

- [ ] **Step 2: Add toolbar**

Top bar containing: app title (left), search bar (center, from Task 7), theme toggle + stats button + settings button + export button (right).

Settings button opens dropdown with toggles: Show thinking blocks, Show tool usage, Show system flags.

- [ ] **Step 3: Claude theme special treatment**

When Claude theme active: sidebar gets warm dark brown background, content area gets cream color, breadcrumb navigation appears at top of message view, messages use open layout without bubble borders (spacing-based separation only).

- [ ] **Step 4: Visual polish pass**

Smooth CSS transitions on theme switch (0.3s). Hover effects on interactive elements. Focus outlines for keyboard navigation. Responsive breakpoints: mobile (<768px) collapses sidebar to hamburger menu, tablet (768-1024px) narrower sidebar, desktop (>1024px) full layout.

- [ ] **Step 5: Test all three themes end-to-end**

Load data, switch themes, verify each theme looks correct across all components: conversation list, message view, stats panel, search results, export dialog.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add theme toggle UI and visual polish"
```

---

## Task 11: Build, Test and Deploy

**Files:**
- Modify: `package.json` (scripts), `README.md`, `.gitignore`

- [ ] **Step 1: Add build scripts to package.json**

Scripts: `dev` (vite), `build` (vite build), `preview` (vite preview).

- [ ] **Step 2: Build and verify single-file output**

```bash
npm run build
ls -la dist/index.html  # Should be a single file, ideally under 500KB
```

Open `dist/index.html` directly from filesystem (file:// protocol) to verify it works offline without a server.

- [ ] **Step 3: Full integration test with 187MB export**

End-to-end checklist:
1. Open dist/index.html in Chrome
2. Upload conversations.json (187MB)
3. Verify Clawd animation plays during loading with progress counter
4. Verify conversation list shows 132 non-empty conversations grouped by month
5. Open a conversation known to have thinking blocks — verify COT content is visible and not empty
6. Toggle "Show flags" — verify flag badges appear on flagged messages
7. Search for a known term — verify results show snippets, click navigates correctly
8. Open stats panel — verify totals match known data (16,929 messages, 7,183 thinking blocks)
9. Export a conversation as Markdown — open exported file, verify thinking blocks have content
10. Switch through all three themes — verify visual correctness
11. Test on mobile viewport width

- [ ] **Step 4: Update README.md**

New features, updated usage instructions, build instructions for contributors, screenshots.

- [ ] **Step 5: Copy dist/index.html to repo root for GitHub Pages**

```bash
cp dist/index.html index.html
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Conversation Viewer V2 — three themes, COT support, search, stats, export"
```

---

## Execution Order and Dependencies

```
Task 1 (Scaffold) → Task 2 (State + Themes) → Task 3 (Parser + Worker)
                                                        |
Task 4 (File Upload + Clawd) ← depends on Worker from Task 3
        |
Task 5 (Conversation List) ← depends on parsed data
        |
Task 6 (Message View) ← depends on list navigation
        |
Task 7 (Search) ← depends on parsed data + message view
        |
Task 8 (Stats Panel) ← depends on parsed data
        |
Task 9 (Export) ← depends on message view content types
        |
Task 10 (Theme UI + Polish) ← depends on all components existing
        |
Task 11 (Build + Test + Deploy) ← final integration
```

Tasks 1-3 are sequential foundations. Tasks 4-6 build the core UI. Tasks 7-9 can be parallelized (independent features on top of core). Task 10 polishes everything. Task 11 ships it.
