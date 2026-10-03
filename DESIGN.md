# Mint green workspace

Approved direction: E, Mint green (1 October 2026). Preview reference:
`C:/Users/ajuma/.gstack/projects/adnugp-CRM-Software/designs/2026-10-01-ui/design-board.html#E`.

Use fresh mint surfaces (#F0F8F3), almost-white cards (#FCFFFD), forest navigation
(#1C4B3C), deep readable text (#173D31), green actions (#237C59), and quiet mint
borders (#D3E6DA). Dark mode uses the same forest/mint family. Existing saved theme
preferences stay valid; new visitors default to light mode.

Typography uses Segoe UI with system fallbacks. Left-aligned headings use a compact
semibold scale; financial values use tabular numerals. Shared components determine
the look across dashboard, records, forms, authentication and assistant controls.

Persistent desktop sidebar, mobile sheet navigation, workspace toolbar and spacious
content areas. Keep real data, permission controls and pagination visible. Cards
that do not perform actions must not move on hover. Active navigation uses a light
mint surface with forest text and aria-current. Do not hide navigation on hover.

Button press feedback lasts 140ms. Routes enter immediately with a 180ms fade;
main content settles over 220ms. Never delay navigation to retain old forms or
workspace data. Respect prefers-reduced-motion for animations, transforms, and
smooth scrolling. Shared buttons have a minimum 44px touch target and retain
keyboard focus and disabled states.
