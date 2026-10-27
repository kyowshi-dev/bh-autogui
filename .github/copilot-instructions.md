# Workspace Guidance

- Keep Electron context isolation enabled and Node integration disabled in all renderer processes.
- Treat Kongregate's game frame as cross-origin; inspect only parent-visible metadata and bounds, and allow read-only OCR of pixels only within the uniquely verified, user-selected frame.
- Fail closed unless a unique Bit Heroes frame can be positively identified.
- Do not add gameplay automation or send automated gameplay input. OCR may report text and configured keyword matches only; it must not trigger game actions.
- Never collect or expose credentials or session secrets.
- Run `npm run typecheck` and `npm test` after changes to selection logic.
