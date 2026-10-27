# Bit Heroes Surface Selector

A Linux desktop app that opens Bit Heroes on Kongregate and identifies the verified game frame for user-directed surface selection. It does not inspect cross-origin game DOM or JavaScript, or automate gameplay.

## Requirements

- Node.js 20 or newer
- npm
- A graphical Linux session for launching Electron

## Run

```sh
npm install
npm start
```

Use **Select surface**, hover the verified game iframe, then choose **Confirm** in the toolbar. The app requires the exact Bit Heroes page, a unique frame, the observed Kongregate embed route, its `game-embed-iframe` class, and the `#game` parent. Uncertain or ambiguous frames remain unavailable. Kongregate sign-in, if needed, happens directly in the app-owned browser session.

After confirming the surface, use **OCR monitor** to choose a scan interval (1-10 seconds) and optional comma-separated keywords. The monitor reports recognized text, confidence, and keyword matches from the selected frame only. Recognition runs locally; no OCR result triggers a click, keypress, or other game action. Tesseract may download its English language data the first time it starts.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

```

```
