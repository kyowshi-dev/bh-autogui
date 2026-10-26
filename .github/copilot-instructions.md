# Workspace Guidance

- Keep Electron context isolation enabled and Node integration disabled in all renderer processes.
- Treat Kongregate's game frame as cross-origin and inspect only parent-visible frame metadata and bounds.
- Fail closed unless a unique Bit Heroes frame can be positively identified.
- Gameplay automation is in scope only for explicit user-directed activities and workflows.
- Keep automation bounded to visible game input; do not bypass cross-origin protections or inspect the game's frame contents.
- Never collect or expose credentials or session secrets.
- Use local OCR on visible screenshots only; do not persist screenshots or OCR text.
- Stop automation on uncertain state, failure, depleted energy, purchase prompts, or ambiguous controls.
- Never click purchases, premium currency, or unverified controls.
- Run `npm run typecheck` and `npm test` after changes to selection logic.
