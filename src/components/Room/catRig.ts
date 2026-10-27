import type { Object3D, SkinnedMesh, BufferAttribute, AnimationClip, AnimationAction } from 'three';
import { AnimationMixer, LoopOnce, LoopRepeat, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const GAIT_SAMPLES = 240;
const LEG_ROOTS = ['front_thighL', 'front_thighR', 'thighL', 'thighR'].map(name => name+'_metarig004');
const TOES = ['front_toeL', 'front_toeR', 'toeL', 'toeR'].map(name => name+'_metarig004');
const median = (values: number[]) => values.sort((a,b) => a-b)[Math.floor(values.length/2)];

/** Rotation-only two-bone IK: the artist's limb lengths and attachments stay fixed. */
export function solveCatLimb(upper: Object3D, lower: Object3D, foot: Object3D, target: Vector3, pole?: Vector3) {
  upper.updateWorldMatrix(true,true);
  const a=upper.getWorldPosition(new Vector3()), b=lower.getWorldPosition(new Vector3()), c=foot.getWorldPosition(new Vector3());
  const first=a.distanceTo(b), second=b.distanceTo(c);
  const direction=target.clone().sub(a), distance=Math.max(.001,Math.min(direction.length(),first+second-.001));
  direction.normalize();
  const bend=(pole?.clone()??b.clone()).sub(a);
  bend.addScaledVector(direction,-bend.dot(direction));
  if(bend.lengthSq()<1e-8)bend.set(0,0,1).addScaledVector(direction,-direction.z);
  bend.normalize();
  const along=(first*first+distance*distance-second*second)/(2*distance);
  const elbow=a.clone().addScaledVector(direction,along).addScaledVector(bend,Math.sqrt(Math.max(0,first*first-along*along)));
  const rotate=(bone:Object3D,from:Vector3,to:Vector3)=>{
    const world=bone.getWorldQuaternion(new Quaternion());
    world.premultiply(new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()));
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(world));
    bone.updateWorldMatrix(false,true);
  };
  rotate(upper,b.clone().sub(a),elbow.clone().sub(a));
  const knee=lower.getWorldPosition(new Vector3()), end=foot.getWorldPosition(new Vector3());
  rotate(lower,end.sub(knee),a.addScaledVector(direction,distance).sub(knee));
}

/** Quiet the source's 72-degree head sweep without changing its footfall paths. */
export function prepareCatAnimations(model: Object3D, clips: AnimationClip[]) {
  const authored = clips.find(clip => clip.name==='WalkCycle');
  if (!authored) throw new Error('The licensed cat is missing its walk animation.');
  // The export includes frame 25, i.e. the first moving frame of the next cycle.
  // Frame 24 (1 s) already equals frame 0; looping all 25 frames snaps the legs.
  const original=authored.clone().trim();
  original.tracks.forEach(track=>track.trim(0,1));
  original.duration=1;
  const walk = original.clone();
  const quaternion = new Quaternion();
  // The calmer torso no longer leans a shoulder toward each planted paw.
  // A small, constant walking crouch leaves the same paw targets reachable
  // without stretching the upper legs or translating their hip attachments.
  model.updateWorldMatrix(true,true);
  const root=model.getObjectByName('Root_metarig004')!;
  const rootParent=root.parent!;
  const down=rootParent.worldToLocal(rootParent.getWorldPosition(new Vector3()).add(new Vector3(0,-2.1,0)));
  const rootPosition=walk.tracks.find(track=>track.name===root.name+'.position');
  if(rootPosition)for(let i=0;i<rootPosition.values.length;i+=3){rootPosition.values[i]+=down.x;rootPosition.values[i+1]+=down.y;rootPosition.values[i+2]+=down.z;}
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
    const strength = track.name.startsWith('Root_') ? .25 : track.name.startsWith('Head_') ? .08 : .12;
    for (let i=0;i<track.values.length;i+=4) {
      quaternion.fromArray(track.values,i).slerp(center,1-strength).normalize().toArray(track.values,i);
    }
  }

  // Keep the original footfall timing, but solve with rotations rather than
  // moving the thigh roots: translating those joints stretched the shoulders.
  const source = cloneSkeleton(model), target = cloneSkeleton(model);
  const sourceMixer = new AnimationMixer(source), targetMixer = new AnimationMixer(target);
  const sourceAction=sourceMixer.clipAction(original), targetAction=targetMixer.clipAction(walk);
  sourceAction.setLoop(LoopOnce,1).play(); targetAction.setLoop(LoopOnce,1).play();
  sourceAction.clampWhenFinished=true; targetAction.clampWhenFinished=true;
  const legs = LEG_ROOTS.map(name => {
    const from=source.getObjectByName(name), to=target.getObjectByName(name);
    if (!from || !to?.parent) throw new Error('The licensed cat leg rig changed.');
    const lowerName=name.replace('front_thigh','front_shin').replace(/^thigh/,'shin');
    const footName=name.replace('front_thigh','front_foot').replace(/^thigh/,'foot');
    const lower=target.getObjectByName(lowerName)!,foot=target.getObjectByName(footName)!;
    return {from,to,lower,foot,sourceLower:source.getObjectByName(lowerName)!,sourceFoot:source.getObjectByName(footName)!,tracks:[to,lower,foot].map(bone=>({bone,values:[] as number[]}))};
  });
  const feet = TOES.map(name => {
    const bone=source.getObjectByName(name);
    if (!bone) throw new Error('The licensed cat toe rig changed.');
    return {bone,points:[] as Vector3[]};
  });
  const times: number[] = [];
  const rawPose=new Map<Object3D,Quaternion>();
  target.traverse(bone=>{if(bone.type==='Bone')rawPose.set(bone,bone.quaternion.clone());});
  for (let frame=0;frame<=GAIT_SAMPLES;frame++) {
    const time=original.duration*frame/GAIT_SAMPLES;
    for(const [bone,rotation] of rawPose)bone.quaternion.copy(rotation);
    times.push(time); sourceMixer.setTime(time); targetMixer.setTime(time);
    source.updateMatrixWorld(true); target.updateMatrixWorld(true);
    for(const [bone,rotation] of rawPose)rotation.copy(bone.quaternion);
    for (const leg of legs) {
      solveCatLimb(leg.to,leg.lower,leg.foot,leg.sourceFoot.getWorldPosition(new Vector3()),leg.sourceLower.getWorldPosition(new Vector3()));
      leg.foot.quaternion.copy(leg.foot.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(leg.sourceFoot.getWorldQuaternion(new Quaternion())));
      for(const track of leg.tracks)track.values.push(...track.bone.quaternion.toArray());
    }
    for (const foot of feet) foot.points.push(foot.bone.getWorldPosition(new Vector3()));
  }
  for (const leg of legs) {
    for(const track of leg.tracks){
      walk.tracks=walk.tracks.filter(existing=>existing.name!==track.bone.name+'.quaternion');
      walk.tracks.push(new QuaternionKeyframeTrack(track.bone.name+'.quaternion',times,track.values));
    }
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
  // Turning uses short steps, not the full traveling stride or a frozen pose.
  const turn=walk.clone();turn.name='TurnCycle';
  for(const track of turn.tracks){
    if(!/^(front_)?(thigh|shin|foot|toe)[LR]_metarig004\.quaternion$/.test(track.name))continue;
    const center=new Quaternion(0,0,0,0),first=new Quaternion().fromArray(track.values);
    for(let i=0;i<track.values.length;i+=4){quaternion.fromArray(track.values,i);const sign=first.dot(quaternion)<0?-1:1;center.x+=quaternion.x*sign;center.y+=quaternion.y*sign;center.z+=quaternion.z*sign;center.w+=quaternion.w*sign;}
    center.normalize();
    for(let i=0;i<track.values.length;i+=4)quaternion.fromArray(track.values,i).slerp(center,.55).normalize().toArray(track.values,i);
  }
  return {clips:[...clips.map(clip=>clip===authored?walk:clip),turn],walkSpeed};
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
        if(current)next.crossFadeFrom(current,once&&sampleTime!==undefined?.07:.18,false);
        current=next;currentName=name;
      }
      if(current) {
        current.paused=sampleTime!==undefined;
        current.timeScale=rate;
        if(sampleTime!==undefined){const duration=current.getClip().duration;current.time=current.loop===LoopRepeat?sampleTime%duration:Math.min(duration,sampleTime);}
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
  if(kind==='none'||amount<=0)return;
  const bone=(name:string)=>model.getObjectByName(`${name}_metarig004`)!;
  const bend = (name: string, x = 0, y = 0, z = 0) => {
    const bone = model.getObjectByName(`${name}_metarig004`);
    if (bone) { bone.rotateX(x*amount); bone.rotateY(y*amount); bone.rotateZ(z*amount); }
  };
  if (kind==='stretch') {
    model.updateWorldMatrix(true,true);
    const feet=LEG_ROOTS.map(name=>{
      const upper=model.getObjectByName(name)!,lower=model.getObjectByName(name.replace('front_thigh','front_shin').replace(/^thigh/,'shin'))!,foot=model.getObjectByName(name.replace('front_thigh','front_foot').replace(/^thigh/,'foot'))!;
      return {upper,lower,foot,point:foot.getWorldPosition(new Vector3()),rotation:foot.getWorldQuaternion(new Quaternion()),pole:lower.getWorldPosition(new Vector3())};
    });
    bend('spine007',.07); bend('spine008',.08); bend('spine009',.08);bend('Head',-.1);
    model.updateWorldMatrix(true,true);
    for(const {upper,lower,foot,point,rotation,pole} of feet){solveCatLimb(upper,lower,foot,point,pole);foot.quaternion.copy(foot.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));}
  } else if (kind==='groom') {
    // Raise the paw to the muzzle, then small head dips; no unsupported arm wave.
    bend('Head',.09+Math.sin(time*2*Math.PI*1.4)*.018,0,-.06);
    model.updateWorldMatrix(true,true);
    const orientation=model.getWorldQuaternion(new Quaternion());
    const foot=bone('front_footL'),upper=bone('front_thighL'),lower=bone('front_shinL');
    const footRotation=foot.getWorldQuaternion(new Quaternion());
    const muzzle=bone('Head').getWorldPosition(new Vector3()).add(new Vector3(.4,-1.3,2.5).applyQuaternion(orientation));
    const target=foot.getWorldPosition(new Vector3()).lerp(muzzle,amount);
    const pole=upper.getWorldPosition(new Vector3()).add(new Vector3(5,-4,1).applyQuaternion(orientation));
    solveCatLimb(upper,lower,foot,target,pole);
    foot.quaternion.copy(foot.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(footRotation));
  } else if (kind==='air') {
    for (const side of ['L','R']) {
      bend(`front_thigh${side}`,-.18);bend(`front_shin${side}`,.3);
      bend(`thigh${side}`,-.16);bend(`shin${side}`,-.12);bend(`foot${side}`,.14);
    }
    bend('Head',-.055);
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
  return (grounded=true) => {
    // In flight, leg tucking must not lift/lower the entire body to follow the
    // lowest toe. Preserve the launch offset and let the ballistic path act.
    if(!grounded)return;
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
