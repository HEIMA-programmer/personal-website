/** Reproducible, narrowly scoped edit of the upstream Spline scene. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { addExtension, Packr, unpack } from 'msgpackr';

const originalUrl = 'https://prod.spline.design/NkSduNGlzit-O-p1/scene.splinecode';
const originalSha256 = 'fc9cfc5cbfd475a7f6e9784cae8f748464701112e8475407e19ea5ad9d66aebb';
const output = path.resolve('public/scene/room.splinecode');
const extensions = new Map();
for (const type of [1, 2, 3, 6]) {
  // Preserve Spline's ordered-map/list wrappers instead of flattening them.
  const Extension = class { constructor(value) { this.value = value; } };
  extensions.set(type, Extension);
  addExtension({ Class: Extension, type, read: value => new Extension(value), write: value => value.value });
}
const ordered = value => new (extensions.get(2))(value);
const id = name => {
  const h = crypto.createHash('sha256').update(`yanbin-room:${name}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
const source = process.argv[2]
  ? await fs.readFile(process.argv[2])
  : Buffer.from(await (await fetch(originalUrl)).arrayBuffer());
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), originalSha256,
  'Upstream scene changed. Review it before regenerating; never silently replace the room.');
const scene = unpack(source);
const original = unpack(source);
const room = scene.scene.objects.value[0];
scene.scene.publish.settings.web.logo = false;
// Runtime 1.10.13 keys its overlay off this exported image, not web.logo.
delete scene.shared.images.value.SplineWatermark;
const objects = [];
const walk = list => list.forEach(object => { objects.push(object); walk(object.children ?? []); });
walk(scene.scene.objects.value);
const named = name => {
  const object = objects.find(item => item.data.name === name);
  assert.ok(object, `Expected upstream object: ${name}`);
  return object;
};

const photoNames = ['Picture Door James', 'Picture Defqon', 'Picture Leo Sophie', 'Picture Beluga'];
const removedImages = new Set();
for (const name of photoNames) {
  const object = named(name);
  for (const layer of object.data.material.layers.value) {
    if (layer.data.texture?.image) removedImages.add(layer.data.texture.image);
  }
  object.data.material = '4b64b839-8430-46d6-9992-5ee23eaca02b'; // Existing ivory material.
  object.data.name = name.includes('Leo') || name.includes('Beluga') ? 'Blank portrait' : 'Blank landscape';
  object.data.states = ordered([]);
  object.data.events = ordered([]);
}
for (const name of ['Picture Horizontal', 'Picture Vertical']) named(name).data.events = ordered([]);
for (const imageId of removedImages) delete scene.shared.images.value[imageId];

// Remove only the old vehicle and its game controls, retaining all other physics.
room.children = room.children.filter(object => object.id !== named('Roomba Game Controls').id);
room.data.publish.gameControlObject = null;
// The empty travel map must not still show the previous owner's physical pins.
named('TravelMap').children = named('TravelMap').children.filter(object => object.data.name !== 'Darts');
// Keep the notebook and its hover effect; it no longer opens the previous CV.
named('Notebook').data.events.value = named('Notebook').data.events.value.filter(event => event.data.type !== 'MouseDown');

// A native empty anchor hosts the separately licensed skeletal cat at runtime.
// It remains in the original room hierarchy and shares its depth/camera/light.
const base = named('Front Wheel').data;
const data = unpack(new Packr({ structuredClone: true }).pack(base));
Object.assign(data, {
  name: 'Room Cat', type: 'Empty', position: [125,-178,100], rotation: [0,0,0],
  scale: [1,1,1], hiddenMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  states: ordered([]), events: ordered([]), physics: {...data.physics, enabled:false},
  cloner: null, raycastLock: true,
});
delete data.geometry;
delete data.material;
room.children.push({fi:0, id:id('Room Cat'), data, children:[]});

// All untouched top-level objects must remain byte-equivalent at the data level.
const edited = new Set(['Roomba Game Controls','Picture Horizontal','Picture Vertical','TravelMap','Notebook']);
for (const object of original.scene.objects.value[0].children) {
  if (edited.has(object.data.name)) continue;
  assert.deepEqual(room.children.find(current => current.id === object.id), object, `Unrelated object changed: ${object.data.name}`);
}
const encoded = new Packr({ structuredClone:true }).pack(scene);
assert.deepEqual(unpack(encoded), scene, 'Lossless scene round-trip failed');
await fs.mkdir(path.dirname(output), {recursive:true});
await fs.writeFile(output, encoded);
console.log(`Prepared ${output}: ${encoded.byteLength} bytes. Preserved all unrelated original scene objects; removed ${removedImages.size} photo textures; added the skeletal cat anchor.`);
