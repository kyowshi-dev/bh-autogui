# Bit Heroes Surface Selector

A Linux desktop app that opens Bit Heroes on Kongregate, identifies the verified game frame, and offers user-directed Raid, PvP, Expedition, and Trial monitoring with cautious visible-input reruns. It uses local OCR on screenshots cropped to the selected visible frame; it does not inspect cross-origin game DOM or JavaScript.

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

For automation, manually enter Raid, PvP, Expedition, or Trial, select that activity in the toolbar, then choose **Monitor & rerun**. Local OCR is limited to the selected frame. The app clicks only one high-confidence `Rerun` label when the selected activity name is visible, and dismisses a high-confidence `Close`/`Dismiss` label only when nearby OCR identifies chat. It stops and notifies on `Defeat`, “Not enough”/energy depletion, purchase or premium-currency wording, ambiguous labels, an unclear screen, navigation, or OCR failure. **Stop** remains available while running. It never clicks purchase controls.

The current version does not navigate activity menus or choose Raid options. Manually choose the Raid tier/heroic setting and complete the team confirmation before arming the monitor. Unknown screen states stop without clicking. OCR is local and screenshots are not written to disk.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

```

```
