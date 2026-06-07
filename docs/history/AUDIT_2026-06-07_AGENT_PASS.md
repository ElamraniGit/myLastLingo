# LinguaLearn Audit Pass — 2026-06-07

## Scope
A focused full-app review was performed across frontend UX, build reliability, and codebase consistency.
This pass emphasized:

- UI consistency and visual polish
- runtime/frontend defects
- design-token conflicts
- build/test verification
- near-term production risks

---

## Verified

- `pytest -q` ✅
- `frontend: tsc --noEmit` ✅
- `frontend: npm run build` ✅

Current production build snapshot:

- First Load JS shared: ~208 kB
- `/` page first load: ~195 kB

---

## Main issues discovered

### 1. Design-system drift
Several screens mixed semantic class names (`text-accent`, `border-line`, `bg-warn`) with Tailwind utility naming. Some semantic aliases existed only conceptually, not as actual CSS utilities. Result:

- inconsistent active states
- silent style degradation
- reduced predictability when editing UI

### 2. Build hygiene is still too permissive
`next.config.js` currently skips type-check and lint during build. This is practical for Termux compatibility, but it also means styling and API regressions can slip into production more easily.

### 3. Next.js version is outdated
`next@14.2.33` is behind current patched releases and shows known security advisories in `npm audit`. This is a real production-readiness risk.

### 4. Frontend screens remain oversized
A number of views are still too large and tightly coupled (`ReviewView`, `CoreLibraryView`, `ProfileView`, `LibraryView`). They are maintainability risks and make visual regressions more likely.

### 5. Duplicate interaction logic
Reading/subtitle selection logic has improved, but similar touch-selection and phrase-handling patterns still exist in multiple places and should eventually be extracted into reusable primitives.

---

## Improvements implemented in this pass

### Frontend UX / design

#### App shell
- improved nav active-state styling
- improved mobile bottom-nav visual affordance
- improved desktop sidebar active indicator
- fixed avatar rendering to use reliable pixel sizing instead of dynamic Tailwind class names
- avatar images now render cleanly when available

#### Global design utilities
Added or normalized semantic utility aliases in `globals.css` for:

- `text-accent`
- `bg-accent`
- `bg-accent-soft`
- `text-success`, `bg-success`
- `text-danger`, `bg-danger`
- `text-warn`, `bg-warn`
- `border-line`, `border-line-s`
- `bg-border-subtle`
- `shadow-card`
- `surface-panel`

This reduced style drift across older and newer screens.

#### Buttons / controls
- improved primary button contrast (`text-white` on primary blue)
- normalized secondary / outline button borders and hover states
- improved perceived depth and consistency of controls

#### Loading states
- redesigned root hydration loader
- redesigned page loader to use a branded surface panel instead of plain text

#### Chat styling cleanup
- fixed invalid accent-related styling in important chat areas
- normalized send button and focus styles
- improved markdown blockquote border rendering

### Functional UX fixes already included in recent passes
- fixed disappearing multi-word selection highlight after touch release
- fixed false “first word selected” visual conflict in subtitle selection
- added saved-word / saved-phrase highlighting in text reader and subtitles
- repaired Library → Add Word crash
- upgraded Library add flow to show inline definitions, Arabic translation, examples, synonyms
- added phrase / idiom support in Library add flow
- added pronunciation button in Library add flow
- prevented duplicate saves with explicit “Already Saved” handling

---

## Remaining recommended roadmap

### High priority
1. Upgrade Next.js to a patched secure version with a Termux-safe validation pass.
2. Re-enable stricter CI checks progressively (at least CI type-checking, even if local Termux build remains permissive).
3. Split oversized screens into feature components.
4. Add frontend test coverage for:
   - selection toolbar
   - library add flow
   - subtitle highlighting
   - saved-word highlighting

### Medium priority
1. Create a shared “semantic status styles” helper to reduce repeated color logic.
2. Extract reusable mobile sheet / panel component.
3. Normalize spacing and typography across auth, library, profile, and stats screens.
4. Add design tokens for success/warn/info surfaces to avoid hardcoded Tailwind mixes.

### Product / UX priority
1. Distinguish visually between:
   - saved single words
   - saved phrases
   - currently selected words
   - currently spoken word
2. Add a compact legend or toggle in reading views.
3. Add “already saved” indicators in more places before user taps save.

---

## Conclusion
The app is in a noticeably stronger state after this pass:

- builds successfully
- backend tests pass
- several runtime crashes and selection bugs were removed
- library lookup/save flow is more polished
- the UI shell is more consistent and modern

However, this should still be considered an **ongoing modernization pass**, not the final production-ready endpoint. The two biggest structural risks that remain are:

- outdated Next.js security posture
- oversized frontend view files
