# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

### Navbar

**File:** `components/layout/Navbar.tsx`
**Type:** Client component (`"use client"` — uses `usePathname`)

```text
header: w-full bg-surface border-b border-border h-16 flex items-center px-6 shrink-0
inner: max-w-[1440px] mx-auto w-full flex items-center justify-between
logo: next/image, width=130 height=36
nav link active: text-sm font-medium text-accent
nav link inactive: text-sm font-medium text-text-dark hover:text-text-primary
cta button: bg-overlay-dark text-accent-foreground text-sm font-medium px-4 py-2 rounded-lg
```

### Footer

**File:** `components/layout/Footer.tsx`
**Type:** Server component

```text
footer: bg-surface border-t border-border py-10 px-6
inner: max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6
logo: next/image, width=120 height=34
links: text-sm text-text-secondary hover:text-text-primary transition-colors
copyright: text-sm text-text-muted
```

### Hero

**File:** `components/homepage/Hero.tsx`
**Type:** Server component

```text
section: bg-surface pt-20 pb-0 px-6 flex flex-col items-center text-center overflow-hidden
badge: bg-accent-muted border border-accent-light text-accent text-sm font-medium px-4 py-1.5 rounded-full
h1: text-[56px] font-bold leading-[1.1] tracking-tight text-text-primary
h1 accent span: text-accent
subtitle: text-lg text-text-secondary leading-relaxed max-w-[560px]
primary cta: bg-overlay-dark text-accent-foreground text-sm font-medium px-6 py-3 rounded-lg
secondary cta: flex items-center gap-2 text-sm font-medium text-text-primary border border-border px-6 py-3 rounded-lg
dashboard image: max-w-[1100px] rounded-t-2xl border border-border shadow-[0_8px_40px_rgba(0,0,0,0.12)]
```

### Features

**File:** `components/homepage/Features.tsx`
**Type:** Server component

```text
section wrapper: bg-background / bg-surface border-y border-border (alternating)
section inner: max-w-300 mx-auto px-6 py-24
grid: grid grid-cols-1 lg:grid-cols-2 gap-16 items-center
category label: text-xs font-medium text-accent uppercase tracking-widest mb-3
section heading: text-[32px] font-bold leading-tight text-text-primary
feature icon container: w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center text-accent
feature title: text-sm font-semibold text-text-primary mb-1
feature description: text-sm text-text-secondary leading-relaxed
bullet dot: w-1.5 h-1.5 rounded-full bg-accent shrink-0
image card: rounded-2xl overflow-hidden border border-border shadow-[0_4px_24px_rgba(0,0,0,0.08)]
```

### Testimonial

**File:** `components/homepage/Testimonial.tsx`
**Type:** Server component

```text
section: bg-surface border-y border-border py-24 px-6
inner: max-w-[760px] mx-auto flex flex-col items-center text-center gap-8
quote: text-[22px] font-medium leading-[1.6] text-text-primary
avatar: w-12 h-12 rounded-full overflow-hidden border-2 border-border
name: text-sm font-medium text-text-primary
title: text-sm text-text-muted
```

### BottomCta

**File:** `components/homepage/BottomCta.tsx`
**Type:** Server component

```text
section: py-28 px-6 flex flex-col items-center text-center
background: linear-gradient(135deg, #7c5cfc 0%, #9b7dff 40%, #b8a0ff 70%, #d4c5ff 100%) — inline style
heading: text-[40px] font-bold leading-tight text-white max-w-[640px]
subtitle: text-lg text-white/80 leading-relaxed
primary cta: bg-white text-text-primary text-sm font-medium px-6 py-3 rounded-lg
secondary cta: text-white/90 text-sm font-medium px-6 py-3 rounded-lg border border-white/30
```
