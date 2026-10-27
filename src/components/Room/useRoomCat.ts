import { useEffect } from 'react';
import type { Application, SPEObject, SplineEvent } from '@splinetool/runtime';

/** Cat poses use the original room's world units, camera, shadows and depth buffer. */
export default function useRoomCat(app: Application | undefined, active: boolean) {
  useEffect(() => {
    if (!app) return;
    const get = (name: string) => app.findObjectByName(name);
    const cat = get('Room Cat');
    const body = get('Cat Body');
    const chest = get('Cat Chest');
    const head = get('Cat Head');
    const left = get('Cat Front Left');
    const right = get('Cat Front Right');
    const tail = get('Cat Tail');
    const tongue = get('Cat Tongue');
    const eyes = [get('Cat Eye Left'), get('Cat Eye Right')];
    if (!cat || !body || !chest || !head || !left || !right || !tail) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const floor = { x:125, y:-178, z:100 };
    // Walk around the right of the chair/table, then clear the tabletop edge.
    const launch = { x:168, y:-178, z:-100 };
    // Rear-right free corner; keeps clear of the laptop, notebook and coffee.
    const desk = { x:108, y:-39.69, z:-190 };
    let elapsed = 0;
    let previous = performance.now();
    let frame = 0;
    let petStart = -100;

    const pet = (event: SplineEvent) => {
      if (event.target.name === 'Room Cat' || event.target.name.startsWith('Cat ')) {
        const phase = elapsed % 72;
        const travelling = (phase >= 30 && phase < 37) || (phase >= 61 && phase < 68);
        if (!travelling && elapsed - petStart > 3.5) petStart = elapsed;
      }
    };
    app.addEventListener('mouseHover', pet);
    app.addEventListener('mouseDown', pet); // Touch visitors can pet the cat too.

    const smooth = (value: number) => value * value * (3 - 2 * value);
    const place = (from: typeof floor, to: typeof floor, progress: number, arc = 0) => {
      const p = Math.max(0, Math.min(1, progress));
      cat.position.x = from.x + (to.x - from.x) * p;
      cat.position.y = from.y + (to.y - from.y) * p + Math.sin(p * Math.PI) * arc;
      cat.position.z = from.z + (to.z - from.z) * p;
    };
    const jump = (progress: number) => {
      const p = Math.max(0, Math.min(1, progress));
      // Rise outside the desk first. Moving horizontally from the very start
      // would send the head through its right edge before the paws clear it.
      const horizontal = smooth(Math.max(0, (p - 0.3) / 0.7));
      cat.position.x = launch.x + (desk.x - launch.x) * horizontal;
      cat.position.z = launch.z + (desk.z - launch.z) * horizontal;
      cat.position.y = launch.y + (desk.y - launch.y) * p + Math.sin(p * Math.PI) * 130;
    };
    const rotate = (object: SPEObject, x = 0, y = 0, z = 0) => {
      object.rotation.x = x; object.rotation.y = y; object.rotation.z = z;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (!active || document.hidden) return;
      elapsed += delta;
      const phase = reducedMotion.matches ? 0 : elapsed % 72;
      let walking = false;
      let jumping = false;
      let grooming = (phase >= 12 && phase < 19) || (phase >= 48 && phase < 54);
      const sleeping = phase >= 21 && phase < 29;

      place(floor, floor, 0);
      cat.rotation.y = 28 * Math.PI / 180;
      if (phase >= 30 && phase < 35) {
        place(floor, launch, smooth((phase - 30) / 5));
        cat.rotation.y = Math.atan2(launch.x-floor.x, launch.z-floor.z);
        walking = true;
      } else if (phase >= 35 && phase < 37) {
        jump((phase - 35) / 2);
        cat.rotation.y = Math.atan2(desk.x-launch.x, desk.z-launch.z);
        jumping = true;
      } else if (phase >= 37 && phase < 61) {
        place(desk, desk, 0);
        cat.rotation.y = 20 * Math.PI / 180;
      } else if (phase >= 61 && phase < 63) {
        jump(1 - (phase - 61) / 2);
        cat.rotation.y = Math.atan2(launch.x-desk.x, launch.z-desk.z);
        jumping = true;
      } else if (phase >= 63 && phase < 68) {
        place(launch, floor, smooth((phase - 63) / 5));
        cat.rotation.y = Math.atan2(floor.x-launch.x, floor.z-launch.z);
        walking = true;
      }

      const petAge = elapsed - petStart;
      const stretch = !walking && !jumping && petAge < 3.5
        ? Math.sin(Math.PI * Math.max(0,petAge) / 3.5) : 0;
      grooming = grooming && stretch === 0;
      if (tongue) tongue.visible = grooming && Math.sin(elapsed * 6) > 0;
      const breath = reducedMotion.matches ? 0 : Math.sin(elapsed * 2.2) * 0.007;
      body.scale.y = 1 + breath - stretch * 0.25;
      body.scale.z = 1 + stretch * 0.55;
      body.position.y = 25 - stretch * 5;
      chest.position.y = 29 - stretch * 6;
      chest.position.z = 11 + stretch * 9;
      head.position.y = 51 - stretch * 14 - (sleeping ? 5 : 0);
      head.position.z = 4 + stretch * 23;
      rotate(head, sleeping ? 0.18 : stretch * 0.22, 0,
        grooming ? -0.25 + Math.sin(elapsed * 6) * 0.12 : Math.sin(elapsed * 0.6) * 0.025);
      left.position.y = grooming ? 36 : 20 - stretch * 8;
      left.position.z = grooming ? 17 : 13 + stretch * 19;
      right.position.y = 20 - stretch * 8;
      right.position.z = 13 + stretch * 19;
      rotate(left, grooming ? -1.6 + Math.sin(elapsed * 6) * 0.12 : walking ? Math.sin(elapsed*13)*0.45 : -stretch*0.35, 0, grooming ? -0.4 : 0);
      rotate(right, walking ? -Math.sin(elapsed*13)*0.45 : -stretch*0.35);
      tail.rotation.y = -0.44 + (reducedMotion.matches ? 0 : Math.sin(elapsed*1.5)*0.3);
      if (walking) cat.position.y += Math.abs(Math.sin(elapsed*13))*1.5;
      if (jumping) { head.rotation.x = -0.12; left.rotation.x = -0.8; right.rotation.x = -0.8; }
      const blink = sleeping || (elapsed % 5.3 > 5.12);
      eyes.forEach(eye => { if (eye) eye.scale.y = blink ? 0.15 : 1; });
      app.requestRender();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      app.removeEventListener('mouseHover', pet);
      app.removeEventListener('mouseDown', pet);
    };
  }, [app, active]);
}
