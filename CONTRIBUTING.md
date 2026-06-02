# Contributing to LinguaLearn

Thanks for helping improve LinguaLearn! This guide applies to both human
contributors and AI coding agents. Please also read
[AI_AGENT_GUIDE.md](AI_AGENT_GUIDE.md) (golden rules) and
[DEVELOPMENT.md](DEVELOPMENT.md) (setup).

---

## Workflow

1. Fork or branch: `git checkout -b feat/<short-name>` (or `fix/…`, `docs/…`).
2. Make focused changes. Keep PRs small and single-purpose.
3. Run the checks below — they must pass.
4. Update documentation for any behavior/API/schema change.
5. Commit with a Conventional Commit message, open a PR, describe the change and
   how you verified it.

## Required checks (must pass before a PR)

```bash
pytest -q                       # backend tests — keep green
cd frontend && npx next dev     # must reach "✓ Ready" (no SWC error), then Ctrl+C
```

CI (`.github/workflows/ci.yml`) runs backend pytest and a frontend build + audit.

> Note: `next build` (production) cannot complete on Termux/arm64. Validate the
> frontend with **dev mode** locally; CI runs the production build on x86.

## Commit message format (Conventional Commits)

```
<type>(<scope>): <summary>

<body — what & why, how verified>
```
Types: `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `chore`, `perf`,
`security`. Example: `fix(vocabulary): scope review endpoint to owner (IDOR)`.

## Coding standards

### Python (backend)
- Target 3.11+. Use type hints and short docstrings on public functions.
- `async`/`await` throughout; DB access only via `DatabaseManager` /
  `get_connection()`. **Always parameterize SQL** (never string-format user input).
- Protect endpoints with `Depends(get_current_user)` unless intentionally public;
  scope every query by `user_id`; verify ownership before mutating a single row.
- Schema changes: **additive migrations only** in `_run_migrations()`.
- Don't print secrets or raw exceptions to clients.

### TypeScript / React (frontend)
- Functional components + hooks. Keep network access in `lib/api.ts`.
- Read/write shared state through the Zustand store; don't duplicate server state.
- Use the Tailwind CSS-variable tokens (`bg-card`, `text-heading`, …) so theming
  works. Add `aria-label`s to icon-only buttons.
- Keep bundle lean — avoid adding dependencies (unused ones were intentionally
  removed). Justify any new package, especially native ones (Termux constraint).

### General
- Match existing style; prefer clarity over cleverness.
- Update `docs/API.md` / `docs/DATABASE.md` / `ARCHITECTURE.md` when relevant.
- Never commit `data/`, `.env`, `node_modules/`, `.next/`, or secret files.

## Reporting bugs / proposing features

Open an issue with: what you expected, what happened, steps to reproduce,
environment (Termux/desktop, Python/Node versions), and logs (`logs/app.log`,
browser console). For features, describe the learning/UX value and any API/schema
impact.

## Documentation-only contributions

Docs live in the repo root (`README.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`,
`AI_AGENT_GUIDE.md`, this file) and `docs/`. Historical audits are archived in
`docs/history/` — don't edit those; write new docs instead.
