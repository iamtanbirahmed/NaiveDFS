---
name: NaiveDFS Theme and UI Design
description: The UI design guidelines, color scheme, and typography for the NaiveDFS project.
---

# NaiveDFS Theme and UI Design Guidelines

This skill defines the visual identity, color scheme, and UI components used across the NaiveDFS application. When creating new UI components or pages, please adhere strictly to these guidelines to ensure consistency.

## 1. Color Palette

The application emphasizes a deep dark background with intense, glowing neon accents (Cyan, Emerald, and Violet).

- **Background:** `#030712` (gray-950 / almost black)
- **Foreground (Text):** `#f8fafc` (slate-50)
- **Primary Accent (Neon Cyan):** `#06b6d4` (cyan-500)
- **Secondary Accent (Neon Emerald):** `#10b981` (emerald-500)
- **Tertiary Accent (Neon Violet):** `#8b5cf6` (violet-500)

## 2. Background and Styling

- **App Background:** Pure dark or deep slate background combined with subtle radial gradients for depth.
  - Primary CSS `radial-gradient(circle at 15% 50%, rgba(6, 182, 212, 0.15), transparent 25%)`
  - Secondary CSS `radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.15), transparent 25%)`
- **Gradient Text:** Use for main headings to create a glowing neon feel.
  - Linear gradient from cyan-400 to emerald-400.

## 3. Glassmorphism Components

Cards, panels, and modals MUST use an intense "glassmorphism" aesthetic with neon glows.

- **Card Background:** `rgba(15, 23, 42, 0.6)` (slate-900 at 60% opacity)
- **Card Border:** `1px solid rgba(6, 182, 212, 0.3)` (cyan neon border trace)
- **Blur Effect:** `backdrop-filter: blur(16px)`
- **Border Radius:** `1rem`
- **Shadow (Neon Glow):** `0 0 20px rgba(6, 182, 212, 0.15)`
- **CSS Class Mapping:** `.glass-card`, `.neon-border`

## 4. Typography & Icons

- **Font Family:** Arial, Helvetica, sans-serif or system-ui defaults.
- **Icons:** Use the `lucide-react` library for consistent, clean vector icons.

## 5. Micro-Animations

Incorporate subtle micro-animations to make the UI feel alive:

- **Fade In Up (`.animate-fade-in-up`):** Used for staggered list animations or revealing content blocks. Duration `0.6s` with `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Pulse Ring (`.pulse-ring`):** Used for highlighting active states or server nodes in the telemetry dashboard.

## Checklists for Implementation

When adding a new Next.js / React component:

- [ ] Incorporate the `.glass-card` global class for containers.
- [ ] Use Tailwind CSS for utility classes matching the primary hex codes (e.g. `bg-slate-900`, `text-slate-50`, `text-blue-500`).
- [ ] Add staggered `.animate-fade-in-up` for loading elements.
- [ ] Include an appropriate `lucide-react` icon to accompany the text.
