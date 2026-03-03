---
name: NaiveDFS Theme and UI Design
description: The UI design guidelines, color scheme, and typography for the NaiveDFS project.
---

# NaiveDFS Theme and UI Design Guidelines

This skill defines the visual identity, color scheme, and UI components used across the NaiveDFS application. When creating new UI components or pages, please adhere strictly to these guidelines to ensure consistency.

## 1. Color Palette

The application uses a dark mode-first approach with slate/blue/violet tones.

- **Background:** `#0f172a` (slate-900 like)
- **Foreground (Text):** `#f8fafc` (slate-50 like)
- **Primary Accent:** `#3b82f6` (blue-500)
- **Primary Hover:** `#2563eb` (blue-600)
- **Secondary Accent:** `#8b5cf6` (violet-500)

## 2. Background and Styling

- **App Background:** A dark slate background combined with subtle radial gradients for depth.
  - Primary CSS `radial-gradient(circle at 15% 50%, rgba(59, 130, 246, 0.15), transparent 25%)`
  - Secondary CSS `radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.15), transparent 25%)`
- **Gradient Text:** Use for main headings to create a modern feel.
  - Linear gradient from `#60a5fa` (blue-400) to `#c084fc` (purple-400)

## 3. Glassmorphism Components

Cards, panels, and modals should use the "glassmorphism" aesthetic.

- **Card Background:** `rgba(30, 41, 59, 0.4)` (slate-800 at 40% opacity)
- **Card Border:** `1px solid rgba(255, 255, 255, 0.1)` (white at 10% opacity)
- **Blur Effect:** `backdrop-filter: blur(12px)`
- **Border Radius:** `1rem`
- **Shadow:** `0 4px 30px rgba(0, 0, 0, 0.1)`
- **CSS Class Mapping:** `.glass-card`

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
