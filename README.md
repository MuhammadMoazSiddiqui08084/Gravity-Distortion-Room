# Gravity Distortion Room

**CS 440 — Project 1: Virtual Worlds (Spring 2026)**

An interactive 3D scene built with **raw WebGL** where floating objects in an enclosed room respond to user-controlled gravity. Experience zero-gravity floating, directional gravity, and real-time physics — all rendered with switchable shading modes.

---

## Running the Project

1. Open a terminal and navigate to the project directory:
   ```
   cd path/to/Gravity-Distortion-Room
   ```
2. Start a local Python HTTP server:
   ```
   python -m http.server
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8000/index.html
   ```

---

## Controls

| Control | Action |
|---------|--------|
| **Click on canvas** | Activate mouse-look (pointer lock) |
| **W / A / S / D** | Move forward / left / backward / right |
| **Space** | Move up |
| **Shift** | Move down |
| **Mouse movement** | Look around (pitch & yaw) |
| **Q / E** | Roll camera left / right |
| **+ / −** | Increase / decrease movement speed |
| **1** | Wireframe shading (edges only) |
| **2** | Flat shading (Gouraud — per-face normals) |
| **3** | Smooth shading (Phong — per-vertex normals) |
| **R** | Reset all objects to initial floating positions |
| **H** | Toggle help panel visibility |
| **Gravity Slider** | Adjust gravity magnitude (0–20 m/s²) |
| **Direction Buttons** | Set gravity direction (↓↑←→ and forward/backward) |
| **RESET button** | Reset objects and set gravity to zero |
| **View Sliders** | Adjust FOV, near plane, far plane |

---

## Shading Modes

1. **Wireframe (1)**: Renders only the edges of all meshes using `gl.LINES`. No lighting.
2. **Flat Shading (2)**: Each triangle face is lit uniformly using per-face normals. Produces a faceted appearance.
3. **Smooth Shading (3)**: Per-vertex normals are interpolated and lighting is calculated per-fragment (Phong reflection model). Produces smooth, realistic surfaces.

---

## Scene Description

- **Room**: A 16×10×16 enclosed room with dark walls and a grid-patterned floor.
- **Objects** (8 total, all generated programmatically):
  - 3 Cubes (varying sizes and colors: cyan, gold, green)
  - 3 Icospheres (generated via icosahedron subdivision, colors: magenta, lime, amber)
  - 2 Tori (parametric generation, colors: coral, violet)

---

## Gravity System

- **Zero Gravity (0 m/s²)**: Objects drift freely with slight ambient rotation.
- **Earth Gravity (9.8 m/s²)**: Objects accelerate downward and bounce off the floor.
- **Extreme (20 m/s²)**: Heavy downward pull.
- **Directional**: Gravity can be applied in 6 directions (up, down, left, right, forward, back).
- **Physics**: Includes sphere-sphere collision detection and elastic response, plus wall bounce with damping.

---

## Technical Notes

- Built entirely with **raw WebGL** (no Three.js, no external libraries except `webgl-utils.js` for context setup).
- All 3D geometry is generated **programmatically** using mathematical formulas.
- Camera uses a **first-person perspective** with full pitch/roll/yaw control and bounded movement.
- Projection matrix uses a **frustum** with dynamically adjustable left/right/top/bottom/near/far bounds.
- Shaders are embedded in the HTML as `<script>` tags with GLSL source code.
- The fragment shader implements the **Phong reflection model** with ambient + diffuse + specular + fill lighting.
