import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { AnimationMixer, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ballisticPosition, CAT_STEPS } from '../src/components/Room/catMotion.ts';
import { createPawSupport, poseCat } from '../src/components/Room/catRig.ts';

// Bounds calculated from the upstream tabletop Cube and table_large transforms.
const table={minX:-181.4135,maxX:139.0495,minZ:-213.3004,maxZ:-72.2817,top:-39.6867,bottom:-53.2405};

test('desk jumps have exact endpoints and constant downward acceleration',() => {
  for (const step of CAT_STEPS.filter(step => step.activity==='jump')) {
    assert.ok(step.duration<=.8,'A room jump must not last multiple seconds.');
    assert.deepEqual(ballisticPosition(step.from,step.to,0,step.duration),step.from);
    const end=ballisticPosition(step.from,step.to,step.duration,step.duration);
    for (const axis of ['x','y','z']) assert.ok(Math.abs(end[axis]-step.to[axis])<1e-8);
    const h=.001,t=step.duration*.5;
    const y=dt=>ballisticPosition(step.from,step.to,t+dt,step.duration).y;
    assert.ok(Math.abs((y(h)-2*y(0)+y(-h))/(h*h)+1500)<.001);
  }
});

test('licensed skeletal asset has its six authored clips and clears the original tabletop during both jumps',async () => {
  globalThis.ProgressEvent ??= class { constructor(type,values) {Object.assign(this,{type},values);} };
  const asset=JSON.parse(await readFile('public/cat/tuxedo/scene.gltf','utf8'));
  assert.match(asset.asset.extras.license,/CC-BY-4.0/);
  assert.match(asset.asset.extras.author,/DreamNoms/);
  assert.equal(asset.skins.length,1);
  assert.deepEqual(asset.animations.map(clip=>clip.name),['IdleNorm','WalkCycle','IdleTailSwoosh','SitDown','IdleSit','StandUp']);
  asset.buffers[0].uri='data:application/octet-stream;base64,'+(await readFile('public/cat/tuxedo/scene.bin')).toString('base64');
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(asset),'');
  const anchor=new Group(),cat=new Group();anchor.add(cat);cat.add(gltf.scene);gltf.scene.scale.setScalar(3.9);
  const mixer=new AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find(clip=>clip.name==='IdleNorm')).play();
  mixer.setTime(.2);
  const pose=[];gltf.scene.traverse(object=>{if(object.isBone)pose.push({bone:object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()});});
  const support=createPawSupport(gltf.scene,anchor);
  const meshes=[];gltf.scene.traverse(object=>{if(object.isSkinnedMesh) meshes.push(object);});
  const vertex=new Vector3();
  for (const step of CAT_STEPS.filter(step=>step.activity==='jump')) {
    for (let frame=0;frame<=80;frame++) {
      const p=frame/80,at=ballisticPosition(step.from,step.to,p*step.duration,step.duration);
      anchor.position.set(at.x,at.y,at.z);cat.rotation.y=step.heading;
      pose.forEach(({bone,position,quaternion,scale})=>{bone.position.copy(position);bone.quaternion.copy(quaternion);bone.scale.copy(scale);});poseCat(gltf.scene,'air',Math.sin(Math.PI*p),p*step.duration);support();anchor.updateMatrixWorld(true);
      for (const mesh of meshes) {
        const positions=mesh.geometry.attributes.position;
        for (let i=0;i<positions.count;i++) {
          vertex.fromBufferAttribute(positions,i);mesh.boneTransform(i,vertex).applyMatrix4(mesh.matrixWorld);
          const inside=vertex.x>table.minX && vertex.x<table.maxX && vertex.z>table.minZ && vertex.z<table.maxZ && vertex.y>table.bottom+.1 && vertex.y<table.top-.1;
          assert.ok(!inside,`Cat clips tabletop at jump ${step.from.y} → ${step.to.y}, progress ${p}, vertex ${vertex.toArray()}`);
        }
      }
    }
  }
});
