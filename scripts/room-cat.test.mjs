import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { AnimationMixer, Group, Vector3, Quaternion } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ballisticPosition, CAT_STEPS, CAT_WALK_SPEED, sampleCatStep } from '../src/components/Room/catMotion.ts';
import { createPawSupport, poseCat, prepareCatAnimations, createCatAnimator } from '../src/components/Room/catRig.ts';

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

async function loadRig() {
  globalThis.ProgressEvent ??= class { constructor(type,values) {Object.assign(this,{type},values);} };
  const asset=JSON.parse(await readFile('public/cat/tuxedo/scene.gltf','utf8'));
  asset.buffers[0].uri='data:application/octet-stream;base64,'+(await readFile('public/cat/tuxedo/scene.bin')).toString('base64');
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(asset),'');
  gltf.scene.scale.setScalar(3.9);
  return gltf;
}
const angleRange = quaternions => {
  let max=0;
  for(let i=0;i<quaternions.length;i++)for(let j=i+1;j<quaternions.length;j++)max=Math.max(max,quaternions[i].angleTo(quaternions[j]));
  return max*180/Math.PI;
};

test('walk correction calms the actual head and waist while preserving all four authored foot paths',async()=>{
  const gltf=await loadRig();
  const original=gltf.animations.find(clip=>clip.name==='WalkCycle');
  const originalTracks=original.tracks.map(track=>Array.from(track.values));
  const prepared=prepareCatAnimations(gltf.scene,gltf.animations);
  assert.deepEqual(original.tracks.map(track=>Array.from(track.values)),originalTracks,'The licensed source animation must remain unchanged.');
  const source=cloneSkeleton(gltf.scene),corrected=cloneSkeleton(gltf.scene);
  const sourceMixer=new AnimationMixer(source),correctedMixer=new AnimationMixer(corrected);
  sourceMixer.clipAction(original).play();
  correctedMixer.clipAction(prepared.clips.find(clip=>clip.name==='WalkCycle')).play();
  const headBefore=[],headAfter=[],waistAfter=[];
  const toes=['front_toeL','front_toeR','toeL','toeR'].map(name=>name+'_metarig004');
  let maxFootError=0;
  // Deliberately sample between the correction's bake frames, not only its keys.
  for(let i=0;i<=241;i++){
    const time=original.duration*i/241;
    sourceMixer.setTime(time);correctedMixer.setTime(time);
    source.updateMatrixWorld(true);corrected.updateMatrixWorld(true);
    headBefore.push(source.getObjectByName('Head_metarig004').getWorldQuaternion(new Quaternion()));
    headAfter.push(corrected.getObjectByName('Head_metarig004').getWorldQuaternion(new Quaternion()));
    waistAfter.push(corrected.getObjectByName('spine004_metarig004').getWorldQuaternion(new Quaternion()));
    for(const name of toes)maxFootError=Math.max(maxFootError,source.getObjectByName(name).getWorldPosition(new Vector3()).distanceTo(corrected.getObjectByName(name).getWorldPosition(new Vector3())));
  }
  assert.ok(angleRange(headBefore)>65,'Fixture should retain the exaggerated source gait that caused the regression.');
  assert.ok(angleRange(headAfter)<15,'Walking must not swing the head dramatically.');
  assert.ok(angleRange(waistAfter)<10,'The lumbar spine should have a small gait sway.');
  assert.ok(maxFootError<.12,'Calming the spine must not alter the four paws’ authored trajectories.');
  assert.ok(prepared.walkSpeed>28&&prepared.walkSpeed<35,'Footfall calibration must stay consistent with the model scale.');
  assert.ok(CAT_WALK_SPEED/prepared.walkSpeed>.8&&CAT_WALK_SPEED/prepared.walkSpeed<1,'Playback rate should match the slower room path.');
});

test('walking stays identical to its corrected clip after repeated sitting, grooming, stretches and jumps',async()=>{
  const gltf=await loadRig(),prepared=prepareCatAnimations(gltf.scene,gltf.animations);
  const live=gltf.scene,reference=cloneSkeleton(live);
  const animator=createCatAnimator(live,prepared.clips),referenceMixer=new AnimationMixer(reference);
  referenceMixer.clipAction(prepared.clips.find(clip=>clip.name==='WalkCycle')).play();
  const names=['Head_metarig004','spine004_metarig004','front_toeL_metarig004','front_toeR_metarig004','toeL_metarig004','toeR_metarig004'];
  let samples=0,maxAngle=0,maxPosition=0;
  for(let frame=0;frame<130*30;frame++){
    const elapsed=frame/30,{step,time,p}=sampleCatStep(elapsed);
    const clip=step.activity==='crouch'||step.activity==='land'?'SitDown':step.clip;
    const rate=clip==='WalkCycle'?CAT_WALK_SPEED/prepared.walkSpeed:clip==='IdleNorm'?.5:clip==='IdleTailSwoosh'?.35:1;
    const sampleTime=step.activity==='crouch'||step.activity==='land'?(step.activity==='crouch'?p:1-p)*.2:undefined;
    const clipTime=animator.update(clip,1/30,rate,sampleTime);
    if(step.activity==='sit'&&time>3&&time<7)poseCat(live,'groom',Math.sin(Math.PI*(time-3)/4),elapsed);
    else if(step.activity==='jump')poseCat(live,'air',Math.sin(Math.PI*p),elapsed);
    else if(step.activity==='rest'&&time>1&&time<3)poseCat(live,'stretch',Math.sin(Math.PI*(time-1)/2),elapsed);
    if(step.activity==='walk'&&time>.4){
      samples++;
      referenceMixer.setTime(clipTime);reference.updateMatrixWorld(true);live.updateMatrixWorld(true);
      for(const name of names){
        const a=reference.getObjectByName(name),b=live.getObjectByName(name);
        maxAngle=Math.max(maxAngle,a.getWorldQuaternion(new Quaternion()).angleTo(b.getWorldQuaternion(new Quaternion()))*180/Math.PI);
        maxPosition=Math.max(maxPosition,a.getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3())));
      }
    }
  }
  assert.ok(samples>500,'Exercise multiple full behavior cycles.');
  assert.ok(maxAngle<.15,'Previous actions or supplemental poses must not accumulate into walking.');
  assert.ok(maxPosition<.002,'Repeated transitions must not shift the cat skeleton.');
  animator.dispose();
});
