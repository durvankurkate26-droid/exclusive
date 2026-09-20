# EXCLUSIVE — ceramic chai cup and saucer

A real, editable 3D reconstruction guided by the supplied single reference image. The hidden surfaces and absolute scale are modeled estimates, not a photogrammetry scan. The package is independent of the Next.js project; no website files were changed.

## Deliverables

- `exclusive-tea.glb`: preferred web asset. Embedded PBR materials and one 1024 × 1024 albedo texture. No external file requests required.
- `exclusive-tea.obj` + `exclusive-tea.mtl` + `textures/chai-basecolor.png`: geometry/material backup. Keep these files together. OBJ/MTL cannot retain the GLB's full PBR/clearcoat response.
- `preview.html` + `viewer/`: an offline-capable Three.js inspector when served over localhost. No CDN is required. Camera, studio lighting, and ground are viewer-only and are not in the model.
- `preview-hero.png`, `preview-front.png`, `preview-side.png`, `preview-top.png`: rendered views of the actual GLB.
- `preview-hollow.png`: tea hidden to show the modeled inner bowl.
- `preview-neutral.png`: neutral direct-light inspection.
- `geometry-report.json` and `gltf-validation.json`: export checks.
- `source/build_model.py`: editable procedural modeling source.

## Model structure

```text
EXCLUSIVE_TEA (identity transform; common ground-centered pivot)
├── Cup      23,874 triangles — continuous hollow body and welded handle
├── Tea       8,352 triangles — closed liquid volume with level top and meniscus
└── Saucer   13,824 triangles — closed shallow plate with an underside support ring
```

Total: **46,050 triangles**, approximately **1.18 MB GLB** (uncompressed). No Draco or Meshopt decoder is needed. Ceramic surfaces have smooth normals, rounded profiles, and locally softened handle roots. Each named mesh is one watertight component; the handle is intentionally joined to `Cup`.

## Dimensions and axes

- Units: **meters**. Y points up, handle points along +X.
- Cup opening/body outside diameter: **100 mm**.
- Cup height above its contact plane: approximately **73.7 mm**.
- Cup width including handle: approximately **127.8 mm**.
- Saucer outside diameter: approximately **164.2 mm**.
- Saucer overall height: approximately **13.8 mm**.
- Saucer ground contact: **Y = 0**.
- Cup contact ring and saucer center: **Y = 0.004 m**.
- Chai flat surface: **Y = 0.07205 m**, below the ceramic rim; the meniscus rises to 0.07255 m at the edge.
- All transforms are applied to the geometry. All node transforms are identity. Shared origin makes cup-and-liquid grouping straightforward.

## Materials

**Midnight_Plum_Ceramic**

- sRGB base-color equivalent: `#231A2B`; stored in glTF as linear color factors.
- Metallic: 0; roughness: 0.28; opaque.
- Optional standard `KHR_materials_clearcoat`: 0.18, clearcoat roughness 0.22.
- No transmission or emission; no baked pink illumination, reflection, shadow, or environment map.
- No ceramic texture is needed. Violet studio reflections come from runtime lighting.

**Warm_Milk_Chai**

- Opaque warm caramel, approximately `#B77E4D`, with very faint cream variation.
- Metallic: 0; roughness: 0.29.
- One 1K base-color texture with planar UVs. It contains albedo variation only, not lighting.
- The standard portable material does not use subsurface scattering. The opaque warm base color provides the milk-tea appearance across glTF viewers.
- No modeled bubbles or baked red/magenta lighting.

## Steam

Steam is deliberately **omitted** from the physical model. Opaque tubes would resemble glass or solid ceramic, and glTF does not provide a universally portable volumetric steam material. Add two separately animated transparent ribbons, sprites, or a shader effect in the website. A sensible emitter is around the cup center at Y ≈ 0.079 m.

No cameras, lights, floor, background, decorative sparkle, text, logos, or UI are exported in the GLB or OBJ.

## Inspect locally

From this folder, serve the files with any static server, for example:

```sh
python -m http.server 8766
```

Then visit `http://localhost:8766/preview.html`. Drag to orbit; scroll to zoom. Buttons show front/side/elevated views, wireframe, neutral direct lighting, and the empty bowl. Opening via `file://` will not work in browsers that restrict module and GLB fetches.

## Three.js integration

Load the GLB using the standard `GLTFLoader`. Keep the root scale at 1 for meters, or scale the whole assembly uniformly. Use a soft studio environment for the ceramic to reflect. Do not make the ceramic metallic to obtain reflections.

```js
loader.load('/exclusive/tea/exclusive-tea.glb', ({ scene: asset }) => {
  scene.add(asset);
  const cup = asset.getObjectByName('Cup');
  const tea = asset.getObjectByName('Tea');
  const saucer = asset.getObjectByName('Saucer');

  // Group liquid with the cup for orbital translation and restrained yaw.
  const cupRig = new THREE.Group();
  cupRig.name = 'CupRig';
  asset.add(cupRig);
  cupRig.attach(cup);
  cupRig.attach(tea);
  // Animate cupRig; saucer remains independently addressable.
});
```

The liquid surface is modeled level at rest. For a convincing scroll orbit, favor translation and Y-axis rotation. If the cup tilts substantially, additional liquid-level animation or simulation is needed; it is not built into this static asset.

## Verification

- Khronos glTF Validator: **0 errors, 0 warnings** on the delivered GLB.
- All three physical meshes: watertight, positive enclosed volume, consistent winding, one connected component, no boundary/non-manifold edges, and no degenerate faces.
- Boolean volume tests: no overlap between cup/tea, cup/saucer, or tea/saucer.
- Actual GLB loaded and rendered through Three.js without browser errors.
- Front, three-quarter, side, elevated, and hollow-bowl views inspected.

These checks cover export validity and the modeled geometry. Final lighting, scroll choreography, and target-device frame rate should be checked in the destination website after integration.

## Rebuild

Requires Python 3.12 or compatible Python, plus `numpy`, `trimesh`, `manifold3d`, `networkx`, `scipy`, and `pillow`:

```sh
pip install numpy trimesh manifold3d networkx scipy pillow
python source/build_model.py
```

The source regenerates the GLB, OBJ/MTL, chai texture, and geometry report in this folder. The JavaScript validator and screenshot script are provenance helpers from this workspace, not required for using the delivered model.

The bundled Three.js viewer code is MIT-licensed; see `viewer/three/LICENSE`.
