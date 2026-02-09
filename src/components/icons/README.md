# React icon wrappers

Place React wrappers for SVG icons here. This gives a consistent API (`size`, `className`, accessibility) and avoids duplicating SVG markup across the app.

Suggested pattern:
- Keep raw `.svg` sources in `src/assets/icons/`.
- Create components here that render the SVG paths using the shared `Icon` wrapper from `Icon.tsx`.
- Export all icons via an `index.ts` barrel when you start adding multiple icons.

