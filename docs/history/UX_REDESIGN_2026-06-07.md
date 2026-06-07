# UX / Design Review Pass — 2026-06-07

## Goal
A full UI consistency pass focused on:

- color system quality
- visual hierarchy
- shell/navigation clarity
- spacing consistency
- card/section readability
- modernizing the most visible screens without breaking Termux compatibility

## Main issues found

1. **Design-token drift**
   Older screens used semantic aliases (`text-accent`, `border-line`, `bg-warn`) that were either inconsistent or under-defined.

2. **Visual hierarchy inconsistency**
   Some screens felt flat while others used strong shadows / gradients. The app lacked a single clear surface language.

3. **Navigation polish gap**
   The shell worked, but active states and sidebar/footer hierarchy were not strong enough.

4. **Home dashboard layout was functional but not premium**
   It lacked a strong hero section and quick-action grouping.

5. **Profile / Stats top shells were visually weaker than newer screens**
   They needed more structure and modern surface treatment.

## Improvements implemented

### Global design system
Updated `globals.css`:
- refined light palette to a softer modern slate/blue neutral system
- refined dark palette away from flat black toward a richer navy slate
- added consistent semantic aliases:
  - `text-accent`, `bg-accent`, `bg-accent-soft`
  - `text-success`, `bg-success`
  - `text-danger`, `bg-danger`
  - `text-warn`, `bg-warn`
  - `border-line`, `border-line-s`
  - `bg-border-subtle`
- introduced `surface-panel`
- introduced `shadow-card`
- introduced `card-hover`
- improved nav bar shadow depth

### App shell
Updated `Layout.tsx`:
- stronger desktop sidebar branding block
- improved active nav treatment
- more polished mobile top bar
- mobile header now shows current page label
- improved footer/profile block on desktop
- more premium bottom-nav active styling

### Home dashboard
Updated `PlayerView.tsx` home state:
- new hero dashboard panel
- stronger greeting hierarchy
- better daily-goal placement
- quick action row added (Library / Practice / AI Tutor)
- section spacing improved
- review CTA elevated visually

### Profile / Stats shell
- Profile tab shell upgraded with stronger top panel treatment
- Stats page header upgraded with structured surface panel

### Buttons
Updated `Button.tsx`:
- primary buttons now use stronger contrast (`text-white`)
- secondary / outline buttons aligned better with card system
- larger, more consistent radius and hover feel

## Verification
- `frontend: tsc --noEmit` ✅
- `frontend: npm run build` ✅
- `backend: pytest -q` ✅

## Notes
This pass modernized the foundation and the most visible screens first.
A future pass should continue with:

- Chat layout polish (setup and conversation rhythm)
- ProfileView deeper decomposition
- StatsView section decomposition
- ReviewView / CoreLibraryView modular extraction
- full semantic component library for cards, sections, toggles, and settings rows
