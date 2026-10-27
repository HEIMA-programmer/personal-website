import { useEffect, useRef } from 'react';
import type { Application } from '@splinetool/runtime';
import {
  Group, Raycaster, ShaderChunk, ShaderLib,
  Vector2, type Camera, type Material, type Mesh, type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FLOOR, sampleCatStep, samplePet, smooth } from './catMotion';
import { createCatAnimator, createPawSupport, poseCat, prepareCatAnimations } from './catRig';

// The pinned Spline 1.10.13 embeds Three r149. This narrow compatibility bridge
// adds the artist's skinned mesh to the original room, renderer and depth buffer.
type SplineBridge = { _scene?: Object3D; _camera?: Camera; canvas?: HTMLCanvasElement };
const resolveShader = (source: string): string => source.replace(
  /#include <([\w]+)>/g, (_match, name: keyof typeof ShaderChunk) => resolveShader(ShaderChunk[name]),
);
const vertexShader = resolveShader(ShaderLib.standard.vertexShader);
const fragmentShader = 'layout(location = 1) out vec4 gVelocity;\n' + resolveShader(ShaderLib.standard.fragmentShader)
  .replace('void main() {','void main() {\n gVelocity = vec4(0.0, 0.0, 0.0, 1.0);');

function disposeModel(model: Object3D) {
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  model.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
  });
  materials.forEach(material => {
    Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value as Texture); });
    material.dispose();
  });
  textures.forEach(texture => texture.dispose());
}

export default function useRoomCat(app: Application | undefined, active: boolean) {
  const activeRef = useRef(active);
  const resumeRef = useRef(true);
  useEffect(() => { activeRef.current = active; resumeRef.current = true; },[active]);
  useEffect(() => {
    if (!app) return;
    const bridge = app as unknown as SplineBridge;
    const anchor = bridge._scene?.getObjectByName('Room Cat');
    const canvas = bridge.canvas;
    if (!anchor?.isObject3D || !bridge._camera || !canvas) {
      console.error('The pinned Spline scene bridge is unavailable.');
      return;
    }
    let cancelled = false;
    let frame = 0;
    let model: Object3D | undefined;
    let animator: ReturnType<typeof createCatAnimator> | undefined;
    let elapsed = 0;
    let petAge = Infinity;
    let interruptedGroom={amount:0,time:0};
    let interruptedGroomStep=-1;
    let last = performance.now();
    let lastRaycast = 0;
    const cat = new Group();
    cat.name = 'Yanbin skeletal cat';
    cat.rotation.y = .5;
    anchor.add(cat);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const raycaster = new Raycaster();
    const pointer = new Vector2();

    const pet = (event: PointerEvent) => {
      if (!activeRef.current || !model || reducedMotion.matches || petAge<10 || performance.now()-lastRaycast<120) return;
      lastRaycast = performance.now();
      const {step,time,index} = sampleCatStep(elapsed);
      if (step.activity!=='rest' && step.activity!=='sit') return;
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,bridge._camera!);
      const hits = raycaster.intersectObject(cat,true);
      if (!hits.length) return;
      // Furniture closer to the camera also blocks petting through the desk.
      const otherMeshes: Object3D[] = [];
      bridge._scene?.traverseVisible(object => {
        if (!(object as Mesh).isMesh) return;
        let parent: Object3D | null = object;
        while (parent && parent!==cat) parent=parent.parent;
        if (parent!==cat) otherMeshes.push(object);
      });
      raycaster.far = hits[0].distance;
      const blocked = raycaster.intersectObjects(otherMeshes,false).some(hit => hit.distance<hits[0].distance-.2);
      raycaster.far = Infinity;
      if (!blocked) {
        interruptedGroom={amount:step.groom&&index!==interruptedGroomStep&&time>4&&time<9?smooth(Math.min(time-4,9-time)/.8):0,time};
        if(step.groom)interruptedGroomStep=index;
        petAge=0;
      }
    };
    const resetClock = () => { resumeRef.current = true; };
    document.addEventListener('visibilitychange',resetClock);
    canvas.addEventListener('pointermove',pet,{passive:true});
    canvas.addEventListener('pointerdown',pet,{passive:true});

    void new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}cat/tuxedo/scene.gltf`).then(gltf => {
      if (cancelled) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      model.scale.setScalar(3.9);
      model.traverse(object => {
        const mesh = object as Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(material => {
            // Spline's own node shaders use a modified shadow sampler. Resolve
            // the matching stock PBR shaders before its include expansion, and
            // fill the MRT velocity attachment used by Spline's postprocessing.
            material.onBeforeCompile = shader => {
              shader.vertexShader = vertexShader;
              shader.fragmentShader = fragmentShader;
            };
            material.customProgramCacheKey = () => 'yanbin-cat-r149-pbr-mrt';
          });
        }
        if (object.type.includes('Light')) object.visible=false;
      });
      cat.add(model);
      const prepared = prepareCatAnimations(model,gltf.animations);
      animator = createCatAnimator(model,prepared.clips);
      const supportPaws = createPawSupport(model,cat);

      const tick = (now: number) => {
        frame=requestAnimationFrame(tick);
        const delta=resumeRef.current ? 0 : (now-last)/1000;
        last=now;
        resumeRef.current=false;
        if (!activeRef.current || document.hidden || !model || !animator) return;
        if (!reducedMotion.matches) {
          const response=samplePet(petAge,sampleCatStep(elapsed).step.activity==='sit');
          if (!response.active) elapsed+=delta;
          petAge+=delta;
        }
        const state=sampleCatStep(reducedMotion.matches?0:elapsed);
        const {step,index,p,time,position,facing,distance,compression}=state;
        if(index!==interruptedGroomStep)interruptedGroomStep=-1;
        const response=samplePet(petAge,step.activity==='sit');
        const petting=response.active;
        const clip=petting?response.clip:step.clip;
        const rate=clip==='IdleNorm'?.5:clip==='IdleTailSwoosh'?.35:1;
        const sampleTime=petting?undefined:step.activity==='walk'?distance/prepared.walkSpeed
          :step.activity==='crouch'||step.activity==='land'?compression*.2:undefined;
        animator.update(clip,reducedMotion.matches?0:delta,rate,sampleTime);
        let pose: Parameters<typeof poseCat>[1]='none';
        let amount=0;
        if (petting && petAge<.25 && interruptedGroom.amount>0) {pose='groom';amount=interruptedGroom.amount*(1-smooth(petAge/.25));}
        else if (petting) { pose='stretch'; amount=response.amount; }
        else if (step.groom && index!==interruptedGroomStep && time>4 && time<9) {pose='groom';amount=smooth(Math.min(time-4,9-time)/.8);}
        else if (step.activity==='jump') {pose='air';amount=Math.sin(Math.PI*p)**2;}
        // Native Spline entities disable automatic matrix updates. Keep the native
        // anchor fixed and move our own Three Group, whose matrices update normally.
        cat.position.set(position.x-FLOOR.x,position.y-FLOOR.y,position.z-FLOOR.z);
        cat.rotation.y=facing;
        poseCat(model,pose,amount,petting&&pose==='groom'?interruptedGroom.time:petting?petAge:time);
        supportPaws(step.activity!=='jump');
        app.requestRender();
      };
      frame=requestAnimationFrame(tick);
      app.requestRender();
    }).catch(error => { console.error('Unable to load the room cat.',error); });
    return () => {
      cancelled=true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange',resetClock);
      canvas.removeEventListener('pointermove',pet);
      canvas.removeEventListener('pointerdown',pet);
      animator?.dispose();
      if (model) disposeModel(model);
      cat.removeFromParent();
    };
  },[app]);
}
