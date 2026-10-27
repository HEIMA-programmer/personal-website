export type CatPoint = { x: number; y: number; z: number };
export type CatActivity = 'rest' | 'sit' | 'transition' | 'turn' | 'walk' | 'crouch' | 'jump' | 'land';
export type CatStep = { duration: number; clip: string; activity: CatActivity; from: CatPoint; to: CatPoint; heading: number; startHeading?: number; gravity?: number; groom?: boolean };

export const CAT_WALK_SPEED = 29;
export const WALK_RAMP = .7;
export const FLOOR: CatPoint = { x: 125, y: -178, z: 100 };
export const LAUNCH: CatPoint = { x: 198, y: -178, z: -80 };
export const PERCH: CatPoint = { x: 110, y: -39.69, z: -190 };
export const DESK = PERCH;
export const smooth = (p:number) => {const t=Math.max(0,Math.min(1,p));return t*t*(3-2*t);};
const heading = (a: CatPoint, b: CatPoint) => Math.atan2(b.x-a.x,b.z-a.z);
export const angleDifference=(from:number,to:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const stay = (duration: number, clip: string, activity: CatActivity, at: CatPoint, angle: number): CatStep => ({duration,clip,activity,from:at,to:at,heading:angle});
const turn=(at:CatPoint,from:number,to:number):CatStep=>({...stay(Math.max(1.2,Math.abs(angleDifference(from,to))/1.0+.5),'TurnCycle','turn',at,to),startHeading:from});
const walk = (from: CatPoint, to: CatPoint): CatStep[] => [
  {duration:Math.hypot(to.x-from.x,to.z-from.z)/CAT_WALK_SPEED+WALK_RAMP,clip:'WalkCycle',activity:'walk',from,to,heading:heading(from,to)},
  stay(.4,'IdleNorm','rest',to,heading(from,to)),
];
const jump = (from: CatPoint, to: CatPoint, duration: number): CatStep[] => [
  stay(.4,'IdleNorm','rest',from,heading(from,to)),
  stay(.42,'SitDown','crouch',from,heading(from,to)),
  {duration,clip:'IdleNorm',activity:'jump',from,to,heading:heading(from,to),gravity:1500},
  stay(.38,'SitDown','land',to,heading(from,to)),
];
const relax = (at: CatPoint, angle: number, duration:number, groom=false): CatStep[] => [
  stay(2.8,'IdleTailSwoosh','rest',at,angle),
  stay(1,'SitDown','transition',at,angle),
  {...stay(duration,'IdleSit','sit',at,angle),groom},
  stay(1.04167,'StandUp','transition',at,angle),
  stay(.35,'IdleNorm','rest',at,angle),
];
const outward=heading(FLOOR,LAUNCH),upward=heading(LAUNCH,PERCH),downward=heading(PERCH,LAUNCH),homeward=heading(LAUNCH,FLOOR);
export const CAT_STEPS: CatStep[] = [
  ...relax(FLOOR,.5,17,true),turn(FLOOR,.5,outward),...walk(FLOOR,LAUNCH),turn(LAUNCH,outward,upward),...jump(LAUNCH,PERCH,.8),
  ...relax(DESK,upward,29),turn(DESK,upward,downward),...jump(PERCH,LAUNCH,.72),
  turn(LAUNCH,downward,homeward),...walk(LAUNCH,FLOOR),turn(FLOOR,homeward,.5),
];
export const CAT_PERIOD = CAT_STEPS.reduce((total,step) => total+step.duration,0);

/** Integrate a smooth velocity ramp so distance, gait phase and time agree. */
export function walkDistance(time:number,duration:number) {
  const t=Math.max(0,Math.min(duration,time)),r=Math.min(WALK_RAMP,duration/2);
  const integral=(u:number)=>u*u*u-.5*u*u*u*u;
  if(t<r)return CAT_WALK_SPEED*r*integral(t/r);
  const total=CAT_WALK_SPEED*(duration-r);
  if(t>duration-r)return total-CAT_WALK_SPEED*r*integral((duration-t)/r);
  return CAT_WALK_SPEED*(t-r/2);
}
export function walkSpeed(time:number,duration:number) {
  return CAT_WALK_SPEED*smooth(Math.min(time,duration-time)/Math.min(WALK_RAMP,duration/2));
}
/** Constant horizontal speed and downward acceleration, in room units. */
export function ballisticPosition(from: CatPoint, to: CatPoint, time: number, duration: number, gravity = 1500): CatPoint {
  const t = Math.max(0,Math.min(duration,time));
  const v = (to.y-from.y + .5*gravity*duration*duration)/duration;
  return {x:from.x+(to.x-from.x)*t/duration,y:from.y+v*t-.5*gravity*t*t,z:from.z+(to.z-from.z)*t/duration};
}
export function sampleCatStep(elapsed: number) {
  let time = elapsed % CAT_PERIOD;
  let index = 0;
  while (index<CAT_STEPS.length-1 && time>=CAT_STEPS[index].duration) time-=CAT_STEPS[index++].duration;
  const step = CAT_STEPS[index],p=time/step.duration;
  const distance=step.activity==='walk'?walkDistance(time,step.duration):0;
  const pathLength=Math.hypot(step.to.x-step.from.x,step.to.z-step.from.z);
  const progress=step.activity==='walk'?distance/pathLength:p;
  const position=step.activity==='jump'?ballisticPosition(step.from,step.to,time,step.duration,step.gravity)
    :{x:step.from.x+(step.to.x-step.from.x)*progress,y:step.from.y,z:step.from.z+(step.to.z-step.from.z)*progress};
  const facing=step.startHeading===undefined?step.heading:step.startHeading+angleDifference(step.startHeading,step.heading)*smooth(p);
  // Compress, extend for takeoff; after contact, absorb then recover. Neither
  // side of the airborne phase starts with an already deeply seated pose.
  const compression=step.activity==='crouch'?(p<.72?smooth(p/.72):1-smooth((p-.72)/.28))
    :step.activity==='land'?(p<.3?smooth(p/.3):1-smooth((p-.3)/.7)):0;
  return {step,index,time,p,position,facing,distance,compression};
}

/** A seated pet responds, stretches and sits back down before resuming its day. */
export function samplePet(age:number,seated:boolean) {
  const stand=seated?1.04167:0,stretchStart=stand+.35,stretchEnd=stretchStart+2.8;
  const sitStart=stretchEnd+.35,duration=sitStart+(seated?1:0)+.22;
  const clip=age<stand?'StandUp':age<sitStart?'IdleNorm':seated?'SitDown':'IdleNorm';
  const p=(age-stretchStart)/2.8;
  return {active:age<duration,duration,clip,amount:p>0&&p<1?Math.sin(Math.PI*p)**2:0};
}
