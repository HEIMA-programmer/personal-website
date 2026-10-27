export type CatPoint = { x: number; y: number; z: number };
export type CatActivity = 'rest' | 'sit' | 'transition' | 'walk' | 'crouch' | 'jump' | 'land';
export type CatStep = { duration: number; clip: string; activity: CatActivity; from: CatPoint; to: CatPoint; heading: number; gravity?: number };

export const FLOOR: CatPoint = { x: 125, y: -178, z: 100 };
export const LAUNCH: CatPoint = { x: 198, y: -178, z: -80 };
export const PERCH: CatPoint = { x: 110, y: -39.69, z: -190 };
export const DESK: CatPoint = { x: 110, y: -39.69, z: -190 };
const heading = (a: CatPoint, b: CatPoint) => Math.atan2(b.x-a.x,b.z-a.z);
const stay = (duration: number, clip: string, activity: CatActivity, at: CatPoint, angle: number): CatStep => ({duration,clip,activity,from:at,to:at,heading:angle});
const walk = (from: CatPoint, to: CatPoint): CatStep[] => [
  stay(.65,'IdleNorm','rest',from,heading(from,to)),
  {duration:Math.hypot(to.x-from.x,to.z-from.z)/29,clip:'WalkCycle',activity:'walk',from,to,heading:heading(from,to)},
];
const jump = (from: CatPoint, to: CatPoint, duration: number): CatStep[] => [
  stay(.65,'IdleNorm','rest',from,heading(from,to)),
  stay(.28,'IdleNorm','crouch',from,heading(from,to)),
  {duration,clip:'IdleNorm',activity:'jump',from,to,heading:heading(from,to),gravity:1500},
  stay(.24,'IdleNorm','land',to,heading(from,to)),
];
const relax = (at: CatPoint, angle: number): CatStep[] => [
  stay(3.5,'IdleTailSwoosh','rest',at,angle),
  stay(1,'SitDown','transition',at,angle),
  stay(11,'IdleSit','sit',at,angle),
  stay(1.04167,'StandUp','transition',at,angle),
];
export const CAT_STEPS: CatStep[] = [
  ...relax(FLOOR,.5), ...walk(FLOOR,LAUNCH), ...jump(LAUNCH,PERCH,.8),
  ...relax(DESK,heading(LAUNCH,PERCH)),
  ...jump(PERCH,LAUNCH,.72), ...walk(LAUNCH,FLOOR),
];
export const CAT_PERIOD = CAT_STEPS.reduce((total,step) => total+step.duration,0);

/** Constant horizontal speed and constant downward acceleration, in room units. */
export function ballisticPosition(from: CatPoint, to: CatPoint, time: number, duration: number, gravity = 1500): CatPoint {
  const t = Math.max(0,Math.min(duration,time));
  const v = (to.y-from.y + .5*gravity*duration*duration)/duration;
  return {
    x:from.x+(to.x-from.x)*t/duration,
    y:from.y+v*t-.5*gravity*t*t,
    z:from.z+(to.z-from.z)*t/duration,
  };
}
export function sampleCatStep(elapsed: number) {
  let time = elapsed % CAT_PERIOD;
  let index = 0;
  while (index<CAT_STEPS.length-1 && time>=CAT_STEPS[index].duration) time-=CAT_STEPS[index++].duration;
  const step = CAT_STEPS[index];
  const p = time/step.duration;
  const position = step.activity==='jump'
    ? ballisticPosition(step.from,step.to,time,step.duration,step.gravity)
    : {x:step.from.x+(step.to.x-step.from.x)*p,y:step.from.y,z:step.from.z+(step.to.z-step.from.z)*p};
  return {step,index,time,p,position};
}
