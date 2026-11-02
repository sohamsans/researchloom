# Stylus Studio & Hardware Pen Integration

Stylus Studio is designed specifically for mathematical derivation, paper annotation, and freeform research sketching on modern Android tablets.

---

## 🖊️ Hardware Stylus Support (Xiaomi Smart Pen & S-Pen)

ResearchLoom features native barrel button support optimized for the **Xiaomi Smart Pen 2 / Focus Pen** (Xiaomi Pad 7 / Pad 6 series) and Samsung S-Pen:

### Button Actions
- **Primary Barrel Button (Button 1 / PageUp 92)**:
  - Single click: Cycles active tools (`Pen` $\to$ `Highlighter` $\to$ `Stroke Eraser` $\to$ `Pixel Eraser` $\to$ `Pen`).
  - Hold down: Temporarily activates eraser while held; returns to previous writing tool upon release.
- **Secondary Barrel Button (Button 2 / PageDown 93)**:
  - Instant undo / secondary tool trigger.

### OEM Gesture Neutralization
On Xiaomi HyperOS / MIUI tablets:
- Long-pressing the pen button normally triggers the native Xiaomi Notes app.
- Pressing the second button triggers the partial screenshot editor.
- **ResearchLoom's `MainActivity.java`** intercepts these hardware keycodes when the app is in the foreground, consuming the event so your drawing flow is never interrupted. Standard system 3-finger swipe screenshots continue working normally.

---

## 🧹 Dual Eraser Modes

1. **Stroke Eraser (Vector)**:
   - Uses line-segment distance computation (`distToSegment`).
   - Any stroke intersected by the eraser path is deleted in its entirety with a single swipe.
2. **Pixel Eraser (Raster)**:
   - Uses HTML5 canvas `destination-out` blending.
   - Cleans up exact touched pixels without deleting the surrounding stroke, ideal for fine mathematical corrections.

---

## 📐 Geometric Shape Auto-Snap

Toggle the **Snap** button on the top toolbar:
- Sketch a rough circle, ellipse, rectangle, triangle, or straight line.
- The engine computes the isoperimetric quotient and corner angles.
- Upon pen lift, the rough sketch is automatically replaced with a clean geometric shape.
