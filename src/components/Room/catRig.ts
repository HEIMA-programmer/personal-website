import type { Object3D, SkinnedMesh, BufferAttribute } from 'three';
import { Vector3 } from 'three';

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
