---
name: Contacts
description: A contact management app where every person is a rich, quickly scannable record.
colors:
  accent: "#0a84ff"
  danger: "#ff453a"
  bg-light: "#f2f2f7"
  surface-light: "#ffffff"
  surface-2-light: "#e5e5ea"
  text-light: "#1c1c1e"
  text-2-light: "#6c6c70"
  border-light: "#d1d1d6"
  bg-dark: "#000000"
  surface-dark: "#1c1c1e"
  surface-2-dark: "#2c2c2e"
  text-dark: "#ffffff"
  text-2-dark: "#8e8e93"
  border-dark: "#38383a"
typography:
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.3px"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
    fontSize: "13px"
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
    backgroundColor: "{colors.accent}"
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
    textColor: "{colors.accent}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
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
---

# Design System: Contacts

## 1. Overview

**Creative North Star: "The Field Ledger"**

A ledger is read, not admired. Every contact is a row of facts (a phone, a document number, a birthday) and the interface exists to put the right fact under the thumb quickly. The system is flat and ruled: white or near-black surfaces separated by hairline borders, one blue accent for the things you can act on, and system type that disappears into the content. It inherits the calm, native feel of iOS so it reads as familiar on a phone, but it earns its own identity through density, consistent structure and honest states rather than ornament.

The register is a working tool for people who manage many records. Hierarchy comes from size, weight and position, never from decoration. Loading, empty and error states reuse the real layout so the screen never jumps. Light and dark are both first-class and both meet contrast requirements.

The system explicitly rejects: a heavy corporate CRM (endless forms, deep menus, visual noise), generic template SaaS (identical card grids, gradients, hero metrics), and decorative or childish apps (illustrations, emoji, animation that gets in the way of work).

**Key Characteristics:**
- Flat surfaces separated by 1px borders; depth through tone, not shadow.
- One accent color, used only for actionable and active elements.
- System font stack, hierarchy through weight and size.
- 44px minimum touch targets; navigation reachable by thumb on mobile.
- Skeletons and states that mirror the final layout.

## 2. Colors

A restrained palette: tinted-neutral surfaces in light and dark, one iOS-blue accent, one red for destruction.

### Primary
- **Signal Blue** (#0a84ff): the only accent. Primary buttons, links, active tab and nav item, focus rings, the floating add button, avatar initials.

### Secondary
- **Alert Red** (#ff453a): destructive actions, form errors and the deceased-contact status. Never decorative.

### Neutral
- **Light:** Mist Canvas (#f2f2f7) page background; Paper (#ffffff) cards and list rows; Pale Slate (#e5e5ea) inputs, secondary buttons and skeleton base; Ink (#1c1c1e) text; Graphite (#6c6c70) secondary text and labels; Hairline (#d1d1d6) borders.
- **Dark:** True Black (#000000) page background; Charcoal (#1c1c1e) cards and list rows; Deep Slate (#2c2c2e) inputs and secondary buttons; White (#ffffff) text; Ash (#8e8e93) secondary text; Dark Hairline (#38383a) borders.

### Named Rules
**The One Voice Rule.** Signal Blue marks what can be acted on or what is current. If a blue element is neither, remove the blue.

**The Contrast Floor Rule.** Secondary text on a surface must keep at least 4.5:1. Graphite on Paper passes; never lighten it for elegance, and never put it on Pale Slate without checking.

## 3. Typography

**Display Font:** system UI stack (-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif)
**Body Font:** the same stack
**Label/Mono Font:** none

**Character:** One native family in several weights. It looks at home on iOS and neutral elsewhere; the work is done by weight and size contrast, not by font choice.

### Hierarchy
- **Title** (700, 24px, 1.25): contact name on the detail page.
- **Headline** (600, 18px, 1.3): form and modal titles.
- **Body** (400-500, 15-16px, 1.5): field values, list names (16px, 500), inputs (16px to avoid iOS zoom).
- **Label** (600, 13px, 0.5px tracking, uppercase): section card titles only, short labels of a few words.

### Named Rules
**The Short Caps Rule.** Uppercase is reserved for section labels of four words or fewer. Body copy and values are never uppercased.

## 4. Elevation

Flat by default. Depth is conveyed by tone (Paper on Mist Canvas, Charcoal on True Black) and a 1px Hairline border on every container. The only shadow in the system belongs to the floating add button, where it signals that the element sits above scrolling content. Overlays use a dimmed scrim instead of shadow.

### Shadow Vocabulary
- **Floating action** (`box-shadow: 0 4px 16px rgba(10, 132, 255, 0.4)`): the add-contact button only.

### Named Rules
**The Flat-By-Default Rule.** Cards, rows and inputs carry no shadow at rest or on hover. State is shown by a background shift to Pale Slate, never by a lift.

## 5. Components

### Buttons
- **Shape:** gently rounded (12px); ghost variant 10px.
- **Primary:** Signal Blue fill, white text, 44px min height, padding 10px 20px, weight 600.
- **Hover / Focus:** hover brightens slightly (brightness 1.06); press scales to 0.97; focus shows a 3px ring of the accent at 45% with 2px offset. Disabled drops to 50% opacity.
- **Secondary:** Pale Slate fill with Ink text. **Ghost:** Pale Slate fill, accent text, 1px Hairline border. **Danger:** Alert Red fill, white text.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper in light, Charcoal in dark.
- **Border:** 1px Hairline. No shadow.
- **Internal Padding:** 14px 16px. Section cards add a header row separated by a hairline.

### Inputs / Fields
- **Style:** Pale Slate fill, 1px Hairline stroke, 12px radius, 12px 16px padding, 16px text.
- **Focus:** border shifts to Signal Blue.
- **Error:** 13px Alert Red message under the field.

### List Item (contact row)
- **Style:** a full-width row with a 44px initials avatar, name (16px, 500), up to two secondary lines in Graphite, and a trailing chevron. Hover shifts the background to Pale Slate.

### Navigation
- **Mobile:** a fixed bottom tab bar with icon and 11px label per destination, active item in Signal Blue, a count badge on Contacts. The top bar is hidden on mobile because it adds nothing.
- **Desktop (601px and up):** a fixed 56px top bar with the app name and text links; the active link gets a blue tint.

### Loading skeleton
- **Style:** placeholder blocks in Pale Slate with a soft left-to-right shimmer, shaped like the final rows and cards. Animation stops under `prefers-reduced-motion`.

## 6. Do's and Don'ts

### Do:
- **Do** keep every touch target at 44px or larger, and keep primary navigation at the bottom on mobile.
- **Do** use Signal Blue (#0a84ff) only for actionable or active elements.
- **Do** separate surfaces with a 1px Hairline border and a tone shift.
- **Do** make loading, empty and error states mirror the real layout.
- **Do** keep secondary text at 4.5:1 or better in both themes.

### Don't:
- **Don't** build a heavy corporate CRM: no endless forms, deep menus or visual noise.
- **Don't** use generic template SaaS patterns: identical card grids, gradients, hero metrics.
- **Don't** make it a decorative or childish app: no illustrations, emoji or animation that gets in the way of work.
- **Don't** add shadows to cards, rows or inputs; the floating add button is the only exception.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on rows or cards.
- **Don't** use gradient text or glass effects as decoration.
- **Don't** use a generic spinning icon for loading; use a skeleton that matches the layout.
