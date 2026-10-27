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

const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const base = named('Front Wheel').data;
const clone = value => unpack(new Packr({ structuredClone: true }).pack(value));
const material = (name, color) => {
  const data = clone(scene.shared.materials.value['4b64b839-8430-46d6-9992-5ee23eaca02b']);
  data.name = name;
  data.layers.value = data.layers.value.filter(layer => layer.data.type !== 'depth');
  data.layers.value.find(layer => layer.data.type === 'color').data.color = color;
  scene.shared.materials.value[id(name)] = data;
  return id(name);
};
const fur = material('Cat warm ginger', { r:0.72, g:0.40, b:0.20 });
const cream = material('Cat cream', { r:0.96, g:0.87, b:0.70 });
const dark = material('Cat eyes', { r:0.045, g:0.06, b:0.045 });
const pink = material('Cat nose', { r:0.65, g:0.30, b:0.27 });
const stripe = material('Cat tabby stripes', { r:0.36, g:0.20, b:0.12 });
let sequence = 0;
const object = (name, position, geometry, mat, rotation = [0,0,0]) => {
  const data = clone(base);
  Object.assign(data, {
    name, type: geometry ? 'Mesh' : 'Empty', position, rotation, scale:[1,1,1], hiddenMatrix:identity,
    states:ordered([]), events:ordered([]), physics:{ ...data.physics, enabled:false },
    raycastLock:false, castShadow:true, receiveShadow:true, cloner:null,
  });
  if (geometry) { data.geometry=geometry; data.material=mat; }
  else { delete data.geometry; delete data.material; }
  return { fi:sequence++, id:id(name), data, children:[] };
};
const sphere = (name, position, size, mat, rotation) => object(name,position,{
  type:'SphereGeometry', width:size[0], height:size[1], depth:size[2], widthSegments:16,heightSegments:12,
  phiStart:0,phiLength:Math.PI*2,thetaStart:0,thetaLength:180,
},mat,rotation);
const cube = (name, position, size, mat, rotation) => object(name,position,{
  type:'CubeGeometry',width:size[0],height:size[1],depth:size[2],widthSegments:1,heightSegments:1,depthSegments:1,cornerRadius:Math.min(...size)*0.35,cornerSegments:3,
},mat,rotation);
const ear = (name, position, mat, size) => object(name,position,{
  type:'CylinderGeometry',width:size[0],height:size[1],depth:size[2],radiusTop:0,radiusBottom:size[0]/2,
  radialSegments:3,heightSegments:1,openEnded:false,thetaStart:0,thetaLength:360,cornerRadius:0,cornerSegments:1,hollow:0,
},mat,[0,30,0]);
const cat = object('Room Cat',[125,-178,100],null,null,[0,28,0]);
const torso = sphere('Cat Body',[0,25,-3],[32,43,32],fur);
const chest = sphere('Cat Chest',[0,29,11],[20,30,10],cream);
const head = object('Cat Head',[0,51,4],null,null);
const tongue = sphere('Cat Tongue',[-4,-10,14],[3,4,2],pink);
tongue.data.visible = false;
head.children.push(
  tongue,
  sphere('Cat Face',[0,0,0],[32,28,27],fur),
  ear('Cat Ear Left',[-10,17,-1],fur,[14,21,11]), ear('Cat Ear Right',[10,17,-1],fur,[14,21,11]),
  ear('Cat Ear Inner Left',[-10,17,3],pink,[7,13,3]), ear('Cat Ear Inner Right',[10,17,3],pink,[7,13,3]),
  sphere('Cat Muzzle Left',[-4,-6,11],[12,9,8],cream), sphere('Cat Muzzle Right',[4,-6,11],[12,9,8],cream),
  sphere('Cat Nose',[0,-3,15],[4,3,2.5],pink),
  sphere('Cat Eye Left',[-7,2,11],[4,6,3],dark), sphere('Cat Eye Right',[7,2,11],[4,6,3],dark),
  sphere('Cat Eye Glint Left',[-7.5,3,12.5],[1.4,1.4,1],cream), sphere('Cat Eye Glint Right',[6.5,3,12.5],[1.4,1.4,1],cream),
  cube('Cat Brow Stripe',[0,9,11],[3,8,2],stripe),
  cube('Cat Whisker Left',[-14,-5,13],[15,0.7,0.7],cream,[0,0,-8]),
  cube('Cat Whisker Right',[14,-5,13],[15,0.7,0.7],cream,[0,0,8]),
);
const pawLeft = object('Cat Front Left',[-10,20,13],null,null);
const pawRight = object('Cat Front Right',[10,20,13],null,null);
for (const [paw, side] of [[pawLeft,'Left'],[pawRight,'Right']]) paw.children.push(
  sphere(`Cat Foreleg ${side}`,[0,-8,0],[9,26,10],fur),
  sphere(`Cat Toes ${side}`,[0,-17,3],[12,7,15],cream),
);
const tail = object('Cat Tail',[0,10,-17],null,null,[0,-25,0]);
tail.children.push(
  sphere('Cat Tail Base',[10,0,-6],[27,9,10],fur,[0,30,0]),
  sphere('Cat Tail Tip',[23,3,-2],[10,10,21],fur,[0,-25,-12]),
  sphere('Cat Tail Stripe',[23,4,4],[10.5,10.5,4],stripe,[0,-25,-12]),
);
cat.children.push(torso,chest,head,pawLeft,pawRight,tail,
  sphere('Cat Haunch Left',[-11,11,-8],[18,22,23],fur), sphere('Cat Haunch Right',[11,11,-8],[18,22,23],fur),
  sphere('Cat Back Paw Left',[-13,4,0],[13,8,20],cream),sphere('Cat Back Paw Right',[13,4,0],[13,8,20],cream));
// An authored hover event lets the runtime expose the cat to its existing raycaster.
cat.data.events = ordered([
  {fi:0,id:id('Cat hover'),data:{type:'MouseHover',disabled:false,actions:ordered([])}},
  {fi:1,id:id('Cat pet'),data:{type:'MouseDown',disabled:false,mode:'Object',runMode:'Repeat',actions:ordered([])}},
]);
room.children.push(cat);

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
console.log(`Prepared ${output}: ${encoded.byteLength} bytes. Preserved all unrelated original scene objects; removed ${removedImages.size} photo textures; added the cat.`);
