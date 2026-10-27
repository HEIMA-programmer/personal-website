# Room customization

The room remains the upstream Spline scene from [niehaus1301/personal-website](https://github.com/niehaus1301/personal-website), based on commit `c5198583b41468baf4dee184e53f6fdac4120af5`. Its room geometry, furniture, camera, lighting, music, airplane animation, object hover effects and scene physics are retained.

The local asset is `public/scene/room.splinecode`. `scripts/prepare-room.mjs` makes a reproducible edit to the original exported asset. It checks the upstream SHA-256 and performs a lossless MessagePack round-trip, including typed geometry arrays. It then asserts that every unrelated top-level room object is unchanged.

## Changes to the scene

- The four alternating photographs inside the two wall frames become plain ivory inserts. The frames remain. The four embedded photo image payloads and their slideshow transitions are removed.
- The Roomba subtree and its keyboard/touch game controller are removed. Other objects' physics remain.
- The previous travel pins are removed from the wall map; the map and its navigation remain.
- The notebook remains, including its hover effect; its former CV click-camera action is removed.
- A small ginger cat is added as native Spline geometry. It shares the original camera, lighting, shadowing and depth buffer, so the room correctly occludes it. No second canvas or screen-position overlay is used.

## Cat behavior and placement

`src/components/Room/useRoomCat.ts` controls sitting, breathing, blinking, grooming, napping, walking, desk jumps and the hover/tap stretch. It uses the existing Spline runtime's public object transforms and event listeners. No keyboard or joystick movement is attached to the cat.

The cat starts on the right side of the floor. Its route passes to the right of the chair and table. The table surface height is calculated from the original tabletop transform: approximately `-39.69` in scene world units. Its desk resting position is the rear-right corner, clear of the laptop, notebook and mug. The upward jump first rises outside the table edge before moving across it; the downward jump reverses that same path. This prevents the head and paws from passing through the table edge. The tail may extend over the rear edge, while the paws remain on the desk.

Animation pauses when the tab is hidden or another room panel is open. Reduced-motion preference suppresses autonomous walking/jumping. Hovering or tapping the cat during a resting pose triggers a short stretch; petting does not interrupt a jump.

## Research and implementation choice

- [Miso 3D Cat](https://github.com/echoscarrie-lab/miso-3d-cat) demonstrates a lightweight procedural cat with articulated geometry and has an MIT license.
- [threejs-cat](https://github.com/DevTakao/threejs-cat) demonstrates an animated imported cat, crediting Omabuarts Studio's Toon Cat model under CC BY 4.0. Its separate Three.js renderer and movement controls would require a larger integration change here.
- [Spline runtime API](https://www.npmjs.com/package/@splinetool/runtime) documents scene-object queries, transform changes and event listeners. The implementation keeps the original runtime major version and does not depend on newer object-creation APIs.

These projects informed the comparison; no third-party cat code or model was copied. The cat's primitive geometry and animation controller are authored specifically for this room, avoiding a second rendering engine and preserving the original scene's spatial relationships.

## Rebuild the asset

With dependencies installed, run `node scripts/prepare-room.mjs`. It downloads the pinned original export, verifies its hash, and regenerates the local customized asset. An optional argument supplies the original export from a local file. If the upstream export changes, the script stops instead of applying edits to unknown geometry.

Future photos can replace the materials of `Blank landscape` and `Blank portrait`. Keep only one visible image insert per frame, or restore a deliberate slideshow using new user-supplied images. The current blank materials contain none of the previous owner's photographs.
