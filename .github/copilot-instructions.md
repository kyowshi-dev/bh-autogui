# Workspace Guidance

- Keep Electron context isolation enabled and Node integration disabled in all renderer processes.
- Treat Kongregate's game frame as cross-origin and inspect only parent-visible frame metadata and bounds.
- Fail closed unless a unique Bit Heroes frame can be positively identified.
- Do not add gameplay automation or send automated gameplay input.
- Never collect or expose credentials or session secrets.
- Run `npm run typecheck` and `npm test` after changes to selection logic.
