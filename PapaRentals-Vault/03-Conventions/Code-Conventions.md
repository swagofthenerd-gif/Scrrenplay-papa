---
title: Code Conventions
tags: [conventions]
area: conventions
---

# Code Conventions

## Comments

Comments explain **why**, naming the concrete failure they prevent — never what
the code does. Match the surrounding density; most code carries none.

Good:
```ts
/* Bearings are spread evenly per vendor rather than hashed. A hash over six
   owners clumped them all into one quadrant, stacked their pins, and left the
   ones underneath impossible to tap. */
```

Bad: `// calculate the angle`

## Accessibility

- Clickable rows are real `<button>`s, not click-`<div>`s. When converting, zero
  out borders you don't want (`borderLeft: 0`) rather than dropping the class.
  `border: 0` on `.list-row` is load-bearing — a `<button>` with no declared
  border takes the UA's `2px outset ButtonBorder`.
- Icon-only controls need `aria-label`.
- Toggles need `aria-pressed` **and** a label stating direction — "Add to
  wishlist" / "Remove from wishlist", never "Toggle wishlist".
- Touch targets are **44px minimum**. `btn-sm` is 40px, so anything tapped
  one-handed in the field needs an explicit `min-height: 44px`.
- Grouped controls get `role="group"` with an `aria-label`.
- If a graphic is `aria-hidden`, the facts it conveys must exist as text.

## Styling

- **Tokens only.** No invented hex values. `var(--danger, #b42318)` shipped once
  with no `--danger` token defined, so a red from nowhere rendered next to the
  palette's `--red`.
- **One card system**: `var(--card)` background, rounded corner, `box-shadow`,
  **never a border**. Panels, list rows and stat tiles all obey it. The wallet
  card's gradient is the one deliberate exception — it is the hero of its screen.
- Both themes must be styled. Dark values live in one `:root[data-theme='dark']`
  rule so the two copies cannot drift.

## Duplication

Extract on the second copy, not the third. Cases that earned their helper:
`shiftBooking`, `threadPeer`, `downloadOrShow`, `displayName`, `tierOf`,
`canInstantBook`, `.ellipsis`.

## Commits

Subjects are imperative and **user-facing** — describe the change in the world,
not the diff:

- ✅ "Let the driver be messaged, not only called"
- ✅ "Make the notification switches switch something"
- ❌ "Add driverThreadId helper to store"

The body explains the failure the change removes. If a bug was found in passing,
name it in the body rather than hiding it in the diff.

## Related

- [[Traps]]
- [[Design-System]]
- [[Verification]]
