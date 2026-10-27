import type { Object3D, SkinnedMesh, BufferAttribute, AnimationClip, AnimationAction } from 'three';
import { AnimationMixer, LoopOnce, LoopRepeat, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const GAIT_SAMPLES = 240;
const LEG_ROOTS = ['front_thighL', 'front_thighR', 'thighL', 'thighR'].map(name => name+'_metarig004');
const TOES = ['front_toeL', 'front_toeR', 'toeL', 'toeR'].map(name => name+'_metarig004');
const median = (values: number[]) => values.sort((a,b) => a-b)[Math.floor(values.length/2)];

/** Quiet the source's 72-degree head sweep without changing its footfall paths. */
export function prepareCatAnimations(model: Object3D, clips: AnimationClip[]) {
  const original = clips.find(clip => clip.name==='WalkCycle');
  if (!original) throw new Error('The licensed cat is missing its walk animation.');
  const walk = original.clone();
  const quaternion = new Quaternion();
  for (const track of walk.tracks) {
    if (!/^(Root|spine\d+|Head|shoulder[LR]|pelvis[LR]|Eye[LR])_metarig004\.quaternion$/.test(track.name)) continue;
    const center = new Quaternion(0,0,0,0);
    const first = new Quaternion().fromArray(track.values);
    for (let i=0;i<track.values.length;i+=4) {
      quaternion.fromArray(track.values,i);
      const sign = first.dot(quaternion)<0 ? -1 : 1;
      center.x+=quaternion.x*sign; center.y+=quaternion.y*sign;
      center.z+=quaternion.z*sign; center.w+=quaternion.w*sign;
    }
    center.normalize();
    const strength = track.name.startsWith('Root_') ? .35 : .15;
    for (let i=0;i<track.values.length;i+=4) {
      quaternion.fromArray(track.values,i).slerp(center,1-strength).normalize().toArray(track.values,i);
    }
  }

  // Shoulder/hip tracks counter-rotate the original twisting spine. Merely
  // reducing spine angles makes the legs flail. Re-express the same authored
  // leg transforms in the calmer parents' coordinate systems instead.
  const source = cloneSkeleton(model), target = cloneSkeleton(model);
  const sourceMixer = new AnimationMixer(source), targetMixer = new AnimationMixer(target);
  const sourceAction=sourceMixer.clipAction(original), targetAction=targetMixer.clipAction(walk);
  sourceAction.setLoop(LoopOnce,1).play(); targetAction.setLoop(LoopOnce,1).play();
  sourceAction.clampWhenFinished=true; targetAction.clampWhenFinished=true;
  const legs = LEG_ROOTS.map(name => {
    const from=source.getObjectByName(name), to=target.getObjectByName(name);
    if (!from || !to?.parent) throw new Error('The licensed cat leg rig changed.');
    return {name,from,to,positions:[] as number[],quaternions:[] as number[]};
  });
  const feet = TOES.map(name => {
    const bone=source.getObjectByName(name);
    if (!bone) throw new Error('The licensed cat toe rig changed.');
    return {bone,points:[] as Vector3[]};
  });
  const times: number[] = [], matrix = new Matrix4(), position = new Vector3(), scale = new Vector3();
  for (let frame=0;frame<=GAIT_SAMPLES;frame++) {
    const time=original.duration*frame/GAIT_SAMPLES;
    times.push(time); sourceMixer.setTime(time); targetMixer.setTime(time);
    source.updateMatrixWorld(true); target.updateMatrixWorld(true);
    for (const leg of legs) {
      matrix.copy(leg.to.parent!.matrixWorld).invert().multiply(leg.from.matrixWorld).decompose(position,quaternion,scale);
      leg.positions.push(position.x,position.y,position.z);
      leg.quaternions.push(quaternion.x,quaternion.y,quaternion.z,quaternion.w);
    }
    for (const foot of feet) foot.points.push(foot.bone.getWorldPosition(new Vector3()));
  }
  for (const leg of legs) {
    walk.tracks=walk.tracks.filter(track => track.name!==leg.name+'.position' && track.name!==leg.name+'.quaternion');
    walk.tracks.push(new VectorKeyframeTrack(leg.name+'.position',times,leg.positions),new QuaternionKeyframeTrack(leg.name+'.quaternion',times,leg.quaternions));
  }
  // In-place animation: planted paws move backward at this speed. Matching the
  // clip rate to the room path speed keeps its stance phase from sliding.
  const stanceSpeeds: number[] = [];
  const dt=original.duration/GAIT_SAMPLES;
  for (const {points} of feet) {
    const low=Math.min(...points.map(point=>point.y)), high=Math.max(...points.map(point=>point.y));
    const ground=low+(high-low)*.3;
    for (let i=1;i<points.length;i++) {
      const speed=(points[i-1].z-points[i].z)/dt;
      if (points[i].y<ground && points[i-1].y<ground && speed>0) stanceSpeeds.push(speed);
    }
  }
  sourceMixer.stopAllAction(); targetMixer.stopAllAction();
  sourceMixer.uncacheRoot(source); targetMixer.uncacheRoot(target);
  const walkSpeed=median(stanceSpeeds);
  if (!Number.isFinite(walkSpeed) || walkSpeed<=0) throw new Error('Unable to calibrate the cat footfall speed.');
  return {clips:clips.map(clip=>clip===original?walk:clip),walkSpeed};
}

/** Shared by the live room and the animation regression tests. */
export function createCatAnimator(model: Object3D, clips: AnimationClip[]) {
  const mixer=new AnimationMixer(model);
  const actions=new Map(clips.map(clip=>[clip.name,mixer.clipAction(clip)]));
  const bases=new Map<Object3D,{position:Vector3;quaternion:Quaternion;scale:Vector3}>();
  model.traverse(bone=>{if(bone.type==='Bone')bases.set(bone,{position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone()});});
  let current:AnimationAction|undefined, currentName='';
  return {
    update(name:string, delta:number, rate=1, sampleTime?:number) {
      // Undo only the previous supplemental pose before the mixer runs. Its
      // cached constant tracks may legitimately skip writes on the next frame.
      for (const [bone,base] of bases) {bone.position.copy(base.position);bone.quaternion.copy(base.quaternion);bone.scale.copy(base.scale);}
      if(currentName!==name) {
        const next=actions.get(name);
        if(!next)throw new Error('Missing cat animation: '+name);
        const once=name==='SitDown'||name==='StandUp';
        next.reset().setEffectiveWeight(1).setLoop(once?LoopOnce:LoopRepeat,once?1:Infinity).play();
        next.clampWhenFinished=once;
        if(current)next.crossFadeFrom(current,.18,false);
        current=next;currentName=name;
      }
      if(current) {
        current.paused=sampleTime!==undefined;
        current.timeScale=rate;
        if(sampleTime!==undefined)current.time=sampleTime;
      }
      mixer.update(delta);
      for(const [bone,base] of bases){base.position.copy(bone.position);base.quaternion.copy(bone.quaternion);base.scale.copy(bone.scale);}
      return current?.time??0;
    },
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);},
  };
}

/** Additional small joint poses layer onto the artist's existing animations. */
export function poseCat(model: Object3D, kind: 'stretch' | 'groom' | 'air' | 'none', amount: number, time: number) {
  amount *= .65;
  const bend = (name: string, x = 0, y = 0, z = 0) => {
    const bone = model.getObjectByName(`${name}_metarig004`);
    if (bone) { bone.rotateX(x*amount); bone.rotateY(y*amount); bone.rotateZ(z*amount); }
  };
  if (kind==='stretch') {
    bend('spine007',.1); bend('spine008',.12); bend('spine009',.12);
    bend('Head',-.16);
    for (const side of ['L','R']) { bend(`front_thigh${side}`,.25); bend(`front_shin${side}`,-.22); }
  } else if (kind==='groom') {
    bend('front_thighL',-.6,0,-.12); bend('front_shinL',.55);
    bend('Head',.19+Math.sin(time*7)*.04,0,-.2);
  } else if (kind==='air') {
    for (const side of ['L','R']) { bend(`front_thigh${side}`,-.3); bend(`front_shin${side}`,.55); }
    bend('Head',-.1);
  }
}

/** The exporter has no skinned bounding boxes; sample real sole vertices. */
export function createPawSupport(model: Object3D, anchor: Object3D) {
  const samples: {mesh: SkinnedMesh; indices: number[]}[] = [];
  model.traverse(object => {
    const mesh = object as SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.name.startsWith('Cat_')) return;
    const footBones = new Set(mesh.skeleton.bones.map((bone,index) => /(?:foot|toe)/i.test(bone.name) ? index : -1));
    const skin = mesh.geometry.attributes.skinIndex as BufferAttribute;
    const weights = mesh.geometry.attributes.skinWeight as BufferAttribute;
    const indices: number[] = [];
    for (let i=0;i<skin.count;i+=2) {
      const bones = [skin.getX(i),skin.getY(i),skin.getZ(i),skin.getW(i)];
      const ws = [weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
      if (bones.some((bone,j) => footBones.has(bone) && ws[j]>.35)) indices.push(i);
    }
    if (indices.length) samples.push({mesh,indices});
  });
  const point = new Vector3();
  return () => {
    let min = Infinity;
    model.position.y = 0;
    anchor.updateMatrixWorld(true);
    for (const {mesh,indices} of samples) {
      mesh.skeleton.update();
      for (const index of indices) {
        point.fromBufferAttribute(mesh.geometry.attributes.position as BufferAttribute,index);
        mesh.boneTransform(index,point).applyMatrix4(mesh.matrixWorld);
        anchor.worldToLocal(point);
        min = Math.min(min,point.y);
      }
    }
    model.position.y = Number.isFinite(min) ? .4-min : .7;
  };
}
