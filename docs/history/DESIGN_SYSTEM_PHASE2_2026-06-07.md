# Design System Phase 2 — 2026-06-07

## Scope
Migrated additional major screens onto shared UI primitives:

- `ChatView`
- `ReviewView`

## Shared primitives now actively used

- `ScreenHeader`
- `SectionCard`
- `StatTile`
- `ActionTile`
- `EmptyState`
- `InlineNotice`

## ChatView
### Improvements
- setup/onboarding state now uses shared design tokens and card structure
- header now uses `ScreenHeader`
- suggestion groups now use `SectionCard`
- suggestion actions now use `ActionTile`
- setup key validation now uses `InlineNotice`
- setup hero metrics now use `StatTile`
- empty conversation state now uses `EmptyState`

### Result
The chat screen now matches the visual language of the rest of the app instead
of behaving like a separate product.

## ReviewView
### Improvements
- practice header now uses `ScreenHeader`
- session settings panel now uses `SectionCard`
- session metrics now use `StatTile`
- games empty state now uses shared `EmptyState`

### Result
The practice area now feels much more aligned with the dashboard, library, and
stats pages, while preserving existing review/quiz/game logic.

## Verification
- `frontend: tsc --noEmit` ✅
- `frontend: npm run build` ✅
- `backend: pytest -q` ✅

## Next recommended screens
To complete visual-system coverage, the next best migration targets are:

- `CoreLibraryView`
- `WordDetailView`
- `ChatView` message bubble subcomponents
- `ProfileView` settings rows (deeper full migration)
