```markdown
# Design System Document: The Cinematic Intelligence Framework

## 1. Overview & Creative North Star
**Creative North Star: "The Obsidian Lens"**

This design system is built to move beyond the "SaaS dashboard" cliché. For an AI video generation platform, the interface must feel like a high-end production suite—silent, powerful, and invisible. The "Obsidion Lens" philosophy treats the screen as a dark aperture where content is the light. We avoid the rigid, boxed-in layouts of traditional software in favor of **intentional asymmetry** and **tonal depth**. 

By utilizing overlapping glass layers and high-contrast typography, we communicate "High-Quality Rendering" and "Intelligence." The UI does not just sit on the screen; it floats in a 3D space, suggesting the multi-layered complexity of AI video synthesis while maintaining a clean, editorial professionality.

---

## 2. Colors: Tonal Depth & Neon Precision
We leverage a palette that mimics a professional color-grading suite. The depth is created through "Light Traps"—areas of deep black—contrasted against "Excited States"—neon accents that represent the spark of AI generation.

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to define sections. Layouts must be structured via background shifts. Use `surface-container-low` for secondary sidebars against a `background` (darker) canvas. This creates a seamless, "molded" look rather than a "constructed" one.

### Surface Hierarchy & Nesting
Depth is achieved by nesting containers within containers using the following progression:
- **Base Canvas:** `background` (#0b0e14)
- **Primary Layout Sections:** `surface-container` (#161a21)
- **Nested Content Cards:** `surface-container-high` (#1c2028)
- **Floating Modals/Popovers:** `surface-bright` (#282c36)

### The "Glass & Gradient" Rule
Floating elements (like video preview controls) must use **Glassmorphism**. 
- **Recipe:** Background `surface-variant` at 40% opacity + `backdrop-filter: blur(12px)`.
- **Signature Textures:** Use a subtle linear gradient (45-degree) from `primary` (#b6a0ff) to `secondary` (#00e3fd) for "Generation" buttons. This transition from purple to electric blue signals the "Intelligence" of the AI.

---

### 3. Typography: Editorial Authority
The type system pairs the technical precision of **Inter** with the futuristic, wide-set character of **Space Grotesk** for display elements.

- **Display & Headlines (Space Grotesk):** Used for "Moments of Impact." These should be set with tight letter-spacing (-0.02em) to feel cinematic.
- **Body & Titles (Inter):** Used for "Information Utility." This ensures that even in a high-tech environment, the platform remains professional and readable.
- **Hierarchy as Brand:** Use `display-lg` sparingly. A single, large, high-contrast headline against a dark `background` communicates more power than a cluttered page of icons.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to imply "elevation" in the traditional sense; we use them to imply "glow" or "ambient occlusion."

### The Layering Principle
To create "lift," place a `surface-container-highest` element on a `surface-container-low` background. The delta in luminance provides enough affordance for the eye to recognize hierarchy without visual noise.

### Ambient Shadows
For floating elements:
- **Shadow Color:** Use a tinted version of `on-surface` at 6% opacity. 
- **Blur:** Large (24px to 40px). This mimics the way a softbox light hits a matte surface in a studio.

### The "Ghost Border" Fallback
If contrast is needed for accessibility, use a **Ghost Border**:
- **Token:** `outline-variant` (#45484f)
- **Opacity:** 15%
- **Weight:** 1px
- *Never use 100% opaque borders for decorative containment.*

---

## 5. Components: The Premium Primitive
Every component should feel like a piece of precision-milled hardware.

*   **Buttons**: 
    *   **Primary (The Generation State):** Gradient from `primary` to `primary-dim`. Corner radius: `md` (0.75rem).
    *   **Secondary (The Control State):** `surface-container-highest` with a `Ghost Border`. Text in `on-surface`.
    *   **Tertiary:** Ghost button with `secondary` (#00e3fd) text.
*   **Input Fields**: Use `surface-container-low` with no border. On focus, transition the background to `surface-variant` and add a subtle `primary` glow (2px blur).
*   **Cards & Lists**: **Forbid divider lines.** Separate video assets in a list using 16px of vertical whitespace or by alternating between `surface` and `surface-container-low` backgrounds.
*   **Chips**: Use `full` roundedness. Selection chips should glow with `secondary_fixed_dim` backgrounds to indicate "Active" AI processing.
*   **Video Timeline (Custom Component)**: The playhead should use the `tertiary` (#ff6c95) color—a punchy pink—to ensure it is visible against the blue/purple neon theme, marking the exact point of creative "Action."

---

## 6. Do's and Don'ts

### Do:
*   **Embrace Negative Space:** Let the "Obsidian" background breathe. High-end brands aren't afraid of empty space.
*   **Use Subtle Motion:** Transition surface color shifts over 300ms using an "Ease-In-Out" curve to simulate high-quality rendering hardware.
*   **Leverage Glassmorphism:** Use it for overlays that sit on top of video content to maintain context.

### Don't:
*   **Don't use pure white (#FFFFFF):** Use `on-surface` (#ecedf6). Pure white is too harsh for "Sophisticated Dark Mode."
*   **Don't use "Drop Shadows":** Use the "Ambient Shadow" rule. Avoid hard, dark shadows that look like 2010-era web design.
*   **Don't Box Everything:** If a group of elements belongs together, let their proximity do the work. Avoid wrapping every group in a bordered box.
*   **Don't Overuse the Neon:** Neon is a "call to action," not a "background." If everything glows, nothing is important. Use `primary` and `secondary` only for interactive focal points.