---
name: Contacts
description: A contact management app where every person is a rich, quickly scannable record.
colors:
  accent: "#0a84ff"
  accent-strong: "#0066cc"
  accent-text-light: "#005bb8"
  accent-text-dark: "#4da3ff"
  danger: "#ff453a"
  danger-strong: "#b3261e"
  danger-text-light: "#b3261e"
  danger-text-dark: "#ff7a72"
  bg-light: "#f2f2f7"
  surface-light: "#ffffff"
  surface-2-light: "#e5e5ea"
  text-light: "#1c1c1e"
  text-2-light: "#5f5f63"
  border-light: "#d1d1d6"
  bg-dark: "#000000"
  surface-dark: "#1c1c1e"
  surface-2-dark: "#2c2c2e"
  text-dark: "#ffffff"
  text-2-dark: "#9a9a9f"
  border-dark: "#38383a"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.3px"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.5px"
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-2-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.surface-2-light}"
    textColor: "{colors.accent-text-light}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger-strong}"
    textColor: "{colors.text-dark}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface-2-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  list-item:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
    padding: "14px 16px"
  section-card:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
  action-menu:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
    width: "220px"
  menu-item:
    textColor: "{colors.text-light}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  toast:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
---

# Design System: Contacts

## 1. Overview

**Creative North Star: "The Field Ledger"**

A ledger is read, not admired. Every contact is a row of facts (a phone, a document number, a birthday) and the interface exists to put the right fact under the thumb quickly. The system is flat and ruled: white or near-black surfaces separated by hairline borders, one blue accent for the things you can act on, and system type that disappears into the content. It inherits the calm, native feel of iOS so it reads as familiar on a phone, but it earns its own identity through density, consistent structure and honest states rather than ornament.

The register is a working tool for people who manage many records. Hierarchy comes from size, weight and position, never from decoration. Loading, empty and error states reuse the real layout so the screen never jumps. Light and dark are both first-class and both meet WCAG AA contrast, and text follows the user's size setting.

The system explicitly rejects: a heavy corporate CRM (endless forms, deep menus, visual noise), generic template SaaS (identical card grids, gradients, hero metrics), and decorative or childish apps (illustrations, emoji, animation that gets in the way of work).

**Key Characteristics:**
- Flat surfaces separated by 1px borders; depth through tone, not shadow.
- One accent color, used only for actionable and active elements, in three tones chosen by job (fill, text, decoration).
- System font stack, sizes in `rem`, hierarchy through weight and size.
- 44px minimum touch targets and a bottom tab bar for navigation on mobile.
- Skeletons, errors with retry, and empty states that mirror the final layout.
- Quick actions (call, WhatsApp, email, copy) one tap away from any contact or phone number.

## 2. Colors

A restrained palette: tinted-neutral surfaces in light and dark, one iOS-blue accent, one red for destruction. Every pairing in use was measured at 4.5:1 or better for text.

### Primary
- **Signal Blue** (#0a84ff): decoration and emphasis that carries no small text: the floating add button, focus rings, tints behind active items, dots and tonal fills.
- **Deep Signal** (#0066cc): any fill that sits behind white text: primary buttons, the save button, badges, the active filter chip, today in the calendar. White on it measures 5.57:1.
- **Link Blue** (#005bb8 in light, #4da3ff in dark): any blue used as text or icon: links, ghost buttons, the active tab, initials. At least 5.2:1 on every surface.

### Secondary
- **Alert Red** (#ff453a): borders and tints for error banners and destructive hover states. Never used for text or behind white text.
- **Alert Text** (#b3261e in light, #ff7a72 in dark): red as text: the delete button label, form errors, the deceased status. At least 5.2:1 on every surface.
- **Alert Fill** (#b3261e): the destructive button background under white text (6.54:1).

### Neutral
- **Light:** Mist Canvas (#f2f2f7) page background; Paper (#ffffff) cards and list rows; Pale Slate (#e5e5ea) inputs, secondary buttons and skeleton base; Ink (#1c1c1e) text; Graphite (#5f5f63) secondary text and labels; Hairline (#d1d1d6) borders.
- **Dark:** True Black (#000000) page background; Charcoal (#1c1c1e) cards and list rows; Deep Slate (#2c2c2e) inputs and secondary buttons; White (#ffffff) text; Ash (#9a9a9f) secondary text; Dark Hairline (#38383a) borders.

### Named Rules
**The One Voice Rule.** Blue marks what can be acted on or what is current. If a blue element is neither, remove the blue.

**The Job-Matched Token Rule.** Pick the blue or red by what it does: fill under white text, text on a surface, or decoration. Raw `--accent` and `--danger` never carry text, and never sit behind small white text. This is what keeps contrast at AA in both themes.

**The Contrast Floor Rule.** Secondary text on any surface keeps at least 4.5:1. Graphite on Pale Slate measures 5.06:1; never lighten it for elegance.

## 3. Typography

**Display Font:** system UI stack (-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif)
**Body Font:** the same stack
**Label/Mono Font:** none

**Character:** One native family in several weights. It looks at home on iOS and neutral elsewhere; the work is done by weight and size contrast, not by font choice.

### Hierarchy
All sizes are in `rem` so they follow the browser or system text-size setting; layouts must hold at 200 %.
- **Title** (700, 1.5rem, 1.25): contact name, the single `h1` on the detail page.
- **Headline** (600, 1.125rem, 1.3): form and modal titles.
- **Body** (400-500, 0.9375-1rem, 1.5): field values, list names (1rem, 500), inputs (1rem to avoid iOS zoom).
- **Label** (600, 0.8125rem, 0.5px tracking, uppercase): section card titles, which are real `h2` headings, and sticky letter headers.

### Named Rules
**The Short Caps Rule.** Uppercase is reserved for section labels of four words or fewer. Body copy and values are never uppercased.

**The Rem Rule.** Never set a font size in `px`. Containers that hold text (avatars, tab labels) grow or truncate instead of clipping.

## 4. Elevation

Flat by default. Depth is conveyed by tone (Paper on Mist Canvas, Charcoal on True Black) and a 1px Hairline border on every container. The only shadow in the system belongs to the floating add button, where it signals that the element sits above scrolling content. Overlays use a dimmed scrim, and floating panels (the quick actions menu, the toast) separate with a border, not a shadow.

### Shadow Vocabulary
- **Floating action** (`box-shadow: 0 4px 16px rgba(10, 132, 255, 0.4)`): the add-contact button only.

### Named Rules
**The Flat-By-Default Rule.** Cards, rows and inputs carry no shadow at rest or on hover. State is shown by a background shift to Pale Slate, never by a lift.

## 5. Components

### Buttons
- **Shape:** gently rounded (12px); ghost variant 10px.
- **Primary:** Deep Signal fill, white text, 44px min height, padding 10px 20px, weight 600.
- **Hover / Focus:** hover brightens slightly (brightness 1.06); press scales to 0.97; focus shows a 3px ring of the accent at 45% with 2px offset. Disabled drops to 50% opacity.
- **Secondary:** Pale Slate fill with Ink text. **Ghost:** Pale Slate fill, Link Blue text, 1px Hairline border. **Danger:** Alert Fill with white text; the ghost delete button uses Alert Text.
- **Icon-only:** 44px wide and tall, with an accessible name that says what it acts on ("Editar teléfono: 0991234567").

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper in light, Charcoal in dark.
- **Border:** 1px Hairline. No shadow.
- **Internal Padding:** 14px 16px. Section cards add a header row, with the section title as an `h2`, separated by a hairline.

### Inputs / Fields
- **Style:** Pale Slate fill, 1px Hairline stroke, 12px radius, 12px 16px padding, 1rem text.
- **Focus:** border shifts to Signal Blue.
- **Error:** 0.8125rem Alert Text message under the field, with a retry button when a load fails.

### List Item (contact row)
- **Style:** a row with a 44px initials avatar, name (1rem, 500) and, when the contact has data, a trailing 44px `⋯` button. The main area opens the contact; the `⋯` button opens the quick actions menu. Hover shifts the background to Pale Slate.
- **Grouping:** when sorted by name or surname, letter headers (A, B, C) stick under the search bar.

### Quick actions menu
- **Style:** a 220px panel with a Hairline border, anchored to its trigger and flipping above it near the bottom bar. Items are 44px: Call, WhatsApp, Email, Copy number, each with an icon.
- **Behavior:** a real `role="menu"`: opens with focus on the first item, arrow keys, Home and End move, Escape closes and returns focus. Inactive phone numbers offer only Copy. Used on list rows (primary phone and email) and on every phone number of the contact card.

### Navigation
- **Mobile:** a fixed bottom tab bar with icon and label per destination, active item in Link Blue, a count badge on Contacts in Deep Signal. Labels truncate with an ellipsis at large text sizes. The top bar is hidden on mobile because it adds nothing.
- **Desktop (601px and up):** a fixed 56px top bar with the app name and text links; the active link gets a blue tint.

### Loading skeleton, toast and dialog
- **Skeleton:** Pale Slate blocks with a soft shimmer, shaped like the final rows and cards. Animation stops under `prefers-reduced-motion`.
- **Toast:** a small bordered panel above the tab bar that confirms an action ("Número copiado") for two seconds, announced with `role="status"`.
- **Confirm dialog:** focus moves to the safe choice (Cancel), Tab stays inside, Escape closes and returns focus, and it is named by its title and description.
- **Disclosure:** the "Agregar" footer button is a disclosure (`aria-expanded`), not a menu, because its 11 options sit in a grid.

## 6. Do's and Don'ts

### Do:
- **Do** keep every touch target at 44px or larger, and keep primary navigation at the bottom on mobile.
- **Do** match the blue or red to its job: Deep Signal under white text, Link Blue for text, Signal Blue for decoration.
- **Do** separate surfaces with a 1px Hairline border and a tone shift.
- **Do** make loading, empty and error states mirror the real layout, and give failed loads a retry.
- **Do** size text in `rem` and check layouts at a 200 % text size.
- **Do** keep text at 4.5:1 or better in both themes, and measure it instead of estimating.
- **Do** give repeated controls names that include their target ("Agregar teléfono").

### Don't:
- **Don't** build a heavy corporate CRM: no endless forms, deep menus or visual noise.
- **Don't** use generic template SaaS patterns: identical card grids, gradients, hero metrics.
- **Don't** make it a decorative or childish app: no illustrations, emoji or animation that gets in the way of work.
- **Don't** add shadows to cards, rows or inputs; the floating add button is the only exception.
- **Don't** put raw `--accent` or `--danger` on text, or behind small white text.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on rows or cards.
- **Don't** use gradient text or glass effects as decoration.
- **Don't** use a generic spinning icon for loading; use a skeleton that matches the layout.
- **Don't** use `role="menu"` unless the control supports arrow-key navigation.
