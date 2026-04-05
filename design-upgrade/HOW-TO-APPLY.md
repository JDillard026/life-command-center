# Design Upgrade — How to Apply

Three drop-in file replacements. Back up your originals first, then swap.

---

## Step 1 — globals.css
Replace: `src/app/globals.css`
With: `design-upgrade/globals.css`

---

## Step 2 — SideNav.module.css
Replace: `src/app/components/SideNav.module.css`
With: `design-upgrade/SideNav.module.css`

---

## Step 3 — AppShell.module.css
Replace: `src/app/components/AppShell.module.css`
With: `design-upgrade/AppShell.module.css`

---

## What changed and why

### Color system
- Background moved from near-pure black `#04070d` → deep slate `#0f1117`
  (same darkness level, but warmer undertone — this is what Vercel, Linear, and Stripe use)
- Text moved from cold blue-white → `#e8edf5` (still crisp, easier on eyes)
- Accent colors pulled back from neon: red `#ff9bb3` → `#e0546a`, green `#8ef4bb` → `#22c77d`
- Each color now has one semantic job — no double-duty colors

### Typography
- Font weights reduced from 850/780/900 → 700/600/500 (just as bold visually, but far more natural)
- `font-variant-numeric: tabular-nums` applied globally — dollar amounts will align perfectly
- Eyebrow letter-spacing reduced from 0.18em → 0.08em (0.18em looks like a template)
- `letter-spacing: -0.025em` on large numbers — tighter tracking = more premium

### Sidebar
- Nav items no longer have individual card borders in the resting state — they appear on hover/active only
- Icon boxes are smaller (36px vs 42px) — less bulky, more refined
- Nav item height trimmed (50px vs 58px) — fits more items, feels less oversized
- Border radius on nav items: 10px vs 18px — more serious, less "bubbly"

### Shadows
- All shadows now have blue-slate tinting instead of pure black
- Shadow system simplified to three sizes (sm/md/lg) with consistent depth cues

### Cards
- Added very subtle top-edge inner highlight (`background-image` linear-gradient) — makes cards look physically lit from above
- Border radius reduced: xl 24px→20px, lg 18px→14px, md 14px→10px

### Scrollbars
- Slimmed from 11px → 6px — modern apps use thin scrollbars

---

## Optional next steps

After applying these files, the biggest remaining visual upgrades would be:
1. Update the Bills page `$2,804` amount-due text — use `var(--lcc-red)` instead of inline red, and add the `.moneyLg` class for proper number formatting
2. Replace `.eyebrow` usage across pages — current tracking is very high
3. Add `.chip` / `.chipNegative` / `.chipWarning` classes to the overdue badges — they'll look much more refined than the current pill badges
