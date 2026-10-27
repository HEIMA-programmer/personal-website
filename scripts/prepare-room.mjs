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
const patch = value => new (extensions.get(6))(value);
const clone = value => unpack(new Packr({ structuredClone: true }).pack(value));
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
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
}
for (const imageId of removedImages) delete scene.shared.images.value[imageId];

function jpegDimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'Expected an original JPEG photograph');
  for (let offset = 2; offset < bytes.length;) {
    assert.equal(bytes[offset++], 0xff, 'Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  throw new Error('JPEG dimensions were not found');
}

// Keep the upstream frame geometry and native Start → Transition slideshow.
// Each frame now crossfades three archive photographs through material alpha states.
const collection = JSON.parse(await fs.readFile('public/photos/collection.json', 'utf8'));
for (const group of collection.groups) {
  const frame = named(group.frame);
  const basePhoto = frame.children[0];
  const overlay = frame.children[1];
  const { width: frameWidth, height: frameHeight } = basePhoto.data.geometry;
  const backing = clone(basePhoto);
  backing.id = id(`${group.id}:mat`);
  backing.data.name = `${group.photographer} photo mat`;
  backing.data.material = '4b64b839-8430-46d6-9992-5ee23eaca02b';
  backing.data.position = [0,0,18.2];
  backing.data.states = ordered([]); backing.data.events = ordered([]);
  const actions = [];
  const photos = [];
  assert.equal(group.images.length, 3, 'Each archive collection must contain three photographs');
  for (const [index, photo] of group.images.entries()) {
    const bytes = await fs.readFile(path.join('public/photos', photo.file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), photo.sha256,
      `Photograph changed; verify its provenance before regenerating: ${photo.file}`);
    const imageId = id(photo.file);
    scene.shared.images.value[imageId] = { data: bytes, name: `${group.photographer} — ${photo.title}` };
    const object = clone(overlay);
    object.id = id(`${group.id}:photo:${index}`);
    object.fi = index + 1;
    object.data.name = `${group.photographer} — ${photo.title}`;
    object.data.position = [0,0,18.4 + index * 0.1];
    object.data.hiddenMatrix = identity.slice();
    object.data.physics.enabled = false;
    const dimensions = jpegDimensions(bytes);
    const fit = Math.min(frameWidth / dimensions.width, frameHeight / dimensions.height);
    object.data.geometry.width = dimensions.width * fit;
    object.data.geometry.height = dimensions.height * fit;
    const textureLayer = object.data.material.layers.value.find(layer => layer.data.type === 'texture');
    textureLayer.data.texture.image = imageId;
    textureLayer.data.alpha = index === 0 ? 1 : 0;
    textureLayer.data.crop = false;
    object.data.material.name = `${group.photographer} photograph ${index + 1}`;
    const visibleId = id(`${group.id}:visible:${index}`);
    const hiddenId = id(`${group.id}:hidden:${index}`);
    object.data.states = ordered([
      { fi: 0, id: visibleId, data: { name: 'Visible', material: { layers: patch({ [textureLayer.id]: patch({ alpha: 1 }) }) } } },
      { fi: 1, id: hiddenId, data: { name: 'Hidden', material: { layers: patch({ [textureLayer.id]: patch({ alpha: 0 }) }) } } },
    ]);
    object.data.events = ordered([]);
    // Each native timeline has a 27-second period: 8-second holds, 1-second fades.
    const phases = index === 0
      ? [[visibleId,8000],[hiddenId,1000],[hiddenId,17000],[visibleId,1000]]
      : index === 1
        ? [[hiddenId,8000],[visibleId,1000],[visibleId,8000],[hiddenId,1000],[hiddenId,9000]]
        : [[hiddenId,17000],[visibleId,1000],[visibleId,8000],[hiddenId,1000]];
    assert.equal(phases.reduce((sum, phase) => sum + phase[1], 0), 27000);
    const tween = (state, duration, tweenIndex) => ({
      fi: tweenIndex, id: id(`${group.id}:tween:${index}:${tweenIndex}`),
      data: { state, duration, repeat: 0, delay: 0, delayDirection: 'start-once', direction: 'normal', easing: 4 },
    });
    const first = tween(null, 0, 0);
    first.data.repeat = -1; // The first tween configures the whole Spline timeline.
    actions.push({ fi: index, id: id(`${group.id}:slideshow:${index}`), data: {
      type: 'Transition', object: object.id,
      tweens: ordered([first, ...phases.map(([state,duration], i) => tween(state,duration,i + 1))]),
      repeat: 0, delay: 0, delayDirection: 'start-once', direction: 'normal', runMode: 'Once',
    } });
    photos.push(object);
  }
  frame.children = [backing, ...photos, ...frame.children.slice(2)];
  frame.data.events = ordered([{ fi: 0, id: id(`${group.id}:start`), data: {
    type: 'Start', disabled: false, actions: ordered(actions),
  } }]);
}

// Remove only the old vehicle and its game controls, retaining all other physics.
room.children = room.children.filter(object => object.id !== named('Roomba Game Controls').id);
room.data.publish.gameControlObject = null;
// Reuse the original dart meshes on the original wall map, now for Yanbin's cities.
// This small stylized world-map texture needs slight point offsets to keep nearby
// cities distinguishable; the full-screen map remains the precise geographic view.
const darts = named('Darts');
const dartMeshes = darts.children.filter(object => object.data.type === 'Mesh');
assert.equal(dartMeshes.length, 2, 'Expected the upstream metal dart and colored tail');
const pinTemplate = darts.children.find(object => object.data.type === 'Empty');
const cities = JSON.parse(await fs.readFile('public/travel-map/locations.json', 'utf8')).features;
const offsets = { beijing:[3,0], shanghai:[-3,-4], changsha:[-4,2], wuhan:[3,3], dali:[-2,5], osaka:[3,-2], nara:[-3,-7] };
Object.assign(darts.data, { type:'Empty', position:[0,0,0], rotation:[0,0,0], scale:[1,1,1], hiddenMatrix:identity.slice(), states:ordered([]), events:ordered([]), cloner:null });
darts.children = cities.map((city,index) => {
  const [lon,lat] = city.geometry.coordinates;
  const [dy,dz] = offsets[city.id] ?? [0,0];
  const pin = clone(pinTemplate);
  pin.id = id(`pin:${city.id}`); pin.fi = index;
  Object.assign(pin.data, {
    name: `${city.properties.name} travel pin`, position: [-29.49, -16 + lat * 160 / 150 + dy - 2.96, -lon * 245 / 360 + dz + 0.0125],
    rotation:[0,180,0], scale:[0.2,0.2,0.2], hiddenMatrix:identity.slice(),
    states:ordered([]), events:ordered([]), cloner:null,
  });
  pin.children = dartMeshes.map((mesh,part) => {
    const copy = clone(mesh); copy.id = id(`pin:${city.id}:mesh:${part}`);
    copy.data.events = ordered([]); copy.data.states = ordered([]);
    copy.data.physics.enabled = false;
    return copy;
  });
  return pin;
});
assert.equal(darts.children.length, 7, 'Expected exactly the seven visited-city pins');
// Notebook hover and MouseDown camera transition remain exactly as upstream.

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
const edited = new Set(['Roomba Game Controls','Picture Horizontal','Picture Vertical','TravelMap']);
for (const object of original.scene.objects.value[0].children) {
  if (edited.has(object.data.name)) continue;
  assert.deepEqual(room.children.find(current => current.id === object.id), object, `Unrelated object changed: ${object.data.name}`);
}
assert.deepEqual(named('TravelMap').data, original.scene.objects.value[0].children.find(object => object.data.name === 'TravelMap').data,
  'Travel-map hover/camera behavior must remain unchanged');
for (const frameName of ['Picture Horizontal','Picture Vertical']) {
  const before = original.scene.objects.value[0].children.find(object => object.data.name === frameName);
  assert.deepEqual(named(frameName).children.at(-1), before.children.at(-1), 'Original picture-frame mesh changed');
}
const encoded = new Packr({ structuredClone:true }).pack(scene);
assert.deepEqual(unpack(encoded), scene, 'Lossless scene round-trip failed');
await fs.mkdir(path.dirname(output), {recursive:true});
await fs.writeFile(output, encoded);
console.log(`Prepared ${output}: ${encoded.byteLength} bytes. Preserved all unrelated original scene objects, Notebook transitions and frame meshes; replaced ${removedImages.size} old photo textures with six credited archive photos; restored seven city darts; kept the skeletal cat anchor.`);
