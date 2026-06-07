# Design System Pass — 2026-06-07

## New shared UI primitives

Created reusable UI building blocks under `frontend/src/components/common/`:

- `ScreenHeader.tsx`
- `SectionCard.tsx`
- `StatTile.tsx`
- `EmptyState.tsx`
- `ActionTile.tsx`
- `InlineNotice.tsx`
- `SettingsRow.tsx`
- `ModalShell.tsx` (from previous modal-unification pass)

## Purpose

These primitives standardize:

- page headers
- section surfaces
- statistic tiles
- empty states
- settings/action rows
- lightweight notices
- modal/sheet presentation

## Applied in this pass

### VocabularyView
- unified sticky header shell with `ScreenHeader`
- replaced manual stat boxes with `StatTile`
- replaced manual info message with `InlineNotice`
- replaced empty state with `EmptyState`

### LibraryView
- unified header shell with `ScreenHeader`
- replaced action chooser buttons with `ActionTile`
- replaced inline modal error message with `InlineNotice`
- replaced empty states with `EmptyState`

### StatsView
- unified page header with `ScreenHeader`
- replaced hero metrics and activity metrics with `StatTile`
- replaced empty state with `EmptyState`

### ProfileView
- replaced repeated stat tiles with `StatTile`
- replaced status/save/error messages with `InlineNotice`
- wrapped repeated info rows with `SectionCard`

## Impact

The app now has a reusable design vocabulary instead of duplicating layout and
visual patterns across each screen. Future cleanup can migrate remaining screens
(`ChatView`, `ReviewView`, `CoreLibraryView`, `WordDetailView`) onto the same
shared primitives.
