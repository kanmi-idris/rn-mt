---
name: rn-mt Docs
description: Developer docs for the rn-mt multitenancy conversion platform.
colors:
  primary: "#b7cbff"
  primary-strong: "#f5f8ff"
  surface-page: "#0a1018"
  surface-shell: "#0f1723"
  surface-panel: "#121c2a"
  surface-soft: "#0d141f"
  surface-code: "#0b1118"
  border-subtle: "#2c384c"
  border-strong: "#40516d"
  text-primary: "#eef4ff"
  text-secondary: "#c6d1e6"
  text-muted: "#8e9ab1"
  accent-info: "#7fb0ff"
  accent-warm: "#d8b06b"
typography:
  display:
    fontFamily: "\"Source Sans 3\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  title:
    fontFamily: "\"Source Sans 3\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  body:
    fontFamily: "\"Source Sans 3\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: "\"Source Sans 3\", \"Segoe UI\", system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "28px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  sidebar-link:
    backgroundColor: "{colors.surface-shell}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  sidebar-link-active:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  utility-button:
    backgroundColor: "{colors.surface-shell}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
  code-block:
    backgroundColor: "{colors.surface-code}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
---

# Design System: rn-mt Docs

## 1. Overview

**Creative North Star: "The Night Desk"**

This system is built for a developer reading docs while they are already in the
work. The mood is quiet, focused, and slightly nocturnal. It should feel like a
tool that keeps its promises, not a site trying to sell one.

The visual language is restrained and app-like. Navigation, code blocks, and
supporting panels should feel dependable and easy to scan. The page should look
structured enough to trust, but not so heavy that every surface turns into a
box.

This system explicitly rejects glossy hero styling, glass-heavy cards, loud
consumer gradients, and decorative motion. The docs should look like a serious
engineering surface with a point of view.

**Key Characteristics:**

- dark, low-glare reading environment
- crisp hierarchy and compact utility controls
- strong code and command affordances
- visible structure without visual clutter

## 2. Colors

The palette stays in a restrained dark lane, with cool navy surfaces and pale
blue emphasis.

### Primary

- **Pale Signal Blue** (`#b7cbff`): used for links, active navigation, and the
  few places where the interface needs to signal “this is the thing to act on.”

### Neutral

- **Night Surface** (`#0a1018`): the page field behind the docs shell
- **Shell Navy** (`#0f1723`): primary navigation surfaces and utility buttons
- **Panel Navy** (`#121c2a`): active states and supporting panels
- **Soft Midnight** (`#0d141f`): recessed backgrounds and subtle containers
- **Code Well** (`#0b1118`): code surfaces
- **Paper White** (`#eef4ff`): main headings and button text
- **Cloud White** (`#c6d1e6`): body text
- **Steel Mist** (`#8e9ab1`): labels, supporting metadata, and quiet hints

### Named Rules

**The One Signal Rule.** Blue is reserved for active structure, linked
references, and primary attention. It should not flood inactive surfaces.

## 3. Typography

**Display Font:** Source Sans 3 (with Segoe UI / system-ui fallback)  
**Body Font:** Source Sans 3 (with Segoe UI / system-ui fallback)  
**Label/Mono Font:** IBM Plex Mono for code and command context

**Character:** plainspoken, technical, and highly legible. The typography
should feel engineered rather than editorial.

### Hierarchy

- **Display** (700, 2.75rem, 1.02): page titles only
- **Title** (700, 1.75rem, 1.12): major sections
- **Body** (400, 1.0625rem, 1.72): all long-form reading content
- **Label** (700, 0.8rem, 1.2): nav section labels, table-of-contents labels,
  utility headings

### Named Rules

**The Read-Once Rule.** The first paragraph after a page title should read like
an answer, not a preamble.

## 4. Elevation

Depth is present, but calm. The system relies more on tonal separation and
borders than dramatic lifting. Shadows are ambient, not theatrical.

### Shadow Vocabulary

- **Shell shadow** (`0 20px 56px rgba(0, 0, 0, 0.28)`): page chrome only
- **Panel shadow** (`0 14px 34px rgba(0, 0, 0, 0.22)`): support panels and
  utility surfaces when needed

### Named Rules

**The Flat-at-Rest Rule.** Reading surfaces should feel settled. Elevation
should support grouping, not compete with the content.

## 5. Components

### Buttons

- **Shape:** full pill or soft rounded utility shape
- **Primary utility buttons:** quiet dark fill, subtle border, short labels
- **Hover / Focus:** brighter border, slightly clearer background, visible
  keyboard focus

### Tabs

- **Style:** compact segmented control
- **State:** the active tab is obvious through tonal contrast, not glow

### Cards / Containers

- **Corner Style:** 16–28px depending on scale
- **Background:** dark tonal separation, not bright cards on dark background
- **Border:** always present, low-contrast, structural
- **Internal Padding:** roomy enough for code and prose, but not inflated

### Code Blocks

- **Style:** dedicated dark well, compact header, clear copy action
- **Language label:** mono, uppercase, low contrast
- **Behavior:** code should feel selectable and immediately usable

### Navigation

- **Sidebar:** stable app-shell navigation, not a marketing side rail
- **Active state:** one clear selected row at a time
- **TOC:** support surface, lighter than the main reading column

## 6. Do's and Don'ts

### Do:

- **Do** keep the docs shell calm, structured, and low-glare.
- **Do** use compact utility controls for edit/source/copy actions.
- **Do** keep the first paragraph practical and direct.
- **Do** use code, commands, and file paths as first-class visual objects.

### Don't:

- **Don't** turn the docs into a landing page.
- **Don't** use side-stripe callouts or tinted rails as the main emphasis
  device.
- **Don't** let action buttons become oversized CTAs.
- **Don't** use decorative gradients, glassmorphism, or novelty motion.
