# Cat motion: diagnosis, measurements and limits

The room still uses DreamNoms' licensed Tuxedo Cat mesh, skeleton and six original animation clips. The glTF and binary are unchanged. Corrections are derived at load time; the Spline room, its camera, renderer, lights and shared depth buffer are retained. This document supersedes the earlier gait notes in `room-customization.md`.

## What was actually wrong

- **An extra frame in the walk loop.** The authored clip is 1.04167 seconds long, but the pose at 1.000 seconds already equals the first pose. The final frame belongs to the next stride. Replaying the entire export produced an approximately 21.7-degree joint discontinuity and a 2.92-room-unit skeletal position discontinuity at every loop. The derived clip now ends at the matching 1.000-second pose.
- **Moving limb attachments.** The previous torso correction preserved feet by translating the thigh roots. That moved joints relative to their shoulders/hips and stretched the skinned body. The replacement uses a rotation-only, two-bone inverse-kinematics solution. A 2.1-room-unit walking crouch keeps the existing foot targets reachable without stretching the limbs. Local limb positions and lengths remain constant.
- **Conflicting movement clocks.** Constant root speed started and stopped instantly, while the leg animation faded independently. Ground travel now accelerates and decelerates over 0.7 seconds, and clip phase comes from integrated distance. At full speed, 29 room units/second corresponds to 0.909 strides/second for this model. Neither is presented as a universal physical cat measurement.
- **Frozen-foot turns and incomplete gestures.** Turning previously rotated an idle pose. It now uses a derived short-step cycle and an explicit smooth heading curve with continuous endpoints. A seated touch response includes standing, stretching, settling and sitting back down. Stretching solves the limbs back to their planted foot positions. Grooming lifts a paw to the muzzle instead of swinging an arm near the floor.
- **Grounding during flight.** Recomputing the model's height from the lowest paw while airborne moved the body whenever its legs tucked. Ground support now stops correcting model height in flight. The original constant-gravity, 0.80/0.72-second table trajectories remain; takeoff compression extends before launch and landing compression starts after contact.

## Research used, and how it was applied

These are primary research sources, not animation tutorials or a claim that one parameter set determines cuteness.

- [Zubair et al., *Head movement during walking in the cat* (2016)](https://pubmed.ncbi.nlm.nih.gov/27339731/) measured small, actively controlled head movements: about 3 degrees of pitch and 1.5–3 degrees of roll, with different stride-related frequencies. This supports reducing the source's very large head sweep while retaining movement. The site's 6.90-degree total three-dimensional orientation range is a separate measurement, not directly equivalent to a single-axis laboratory amplitude.
- [Weißig et al., *Repeatability and reliability of kinetic and temporospatial gait parameters…* (2025)](https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2025.1707477/full) reports stance fractions around 62% for forelimbs and 59% for hindlimbs in its treadmill cohort. [Frigon et al., *Speed-dependent modulation of phase variations…* (2014)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4044364/) describes lateral-sequence walking. The artist's four-paw sequence and its left/right alternation are retained. Our geometric low-paw-height proxy was approximately 68% front and 58–61% rear; it is not a force-plate measurement of contact and was not forced to equal the experimental values.
- [Wu et al., *Contributions of Limb Joints to Energy Absorption during Landing in Cats* (2019)](https://pubmed.ncbi.nlm.nih.gov/31531125/) describes limb-joint energy absorption during landing, including elbow and hip contributions. We use this as support for compression after contact and recovery, not as validation of a full dynamic simulation.
- [Noel and Hu, *Cats use hollow papillae to wick saliva into fur* (2018)](https://hu.gatech.edu/wp-content/uploads/2019/02/Hu18-cats.pdf) reports grooming at 1.4 ± 0.6 licks/second in its recorded cats. A small 1.4 Hz head dip accompanies the raised paw. This model has no authored tongue animation; the gesture suggests paw grooming without claiming to reproduce tongue mechanics.

The 0.7-second acceleration ramp, turn-step amplitude, longer rests and touch timing are artistic choices constrained by this mesh and room. The character remains stylized. Turning is a kinematic stepping approximation, not a contact-force simulation, and visual review is still necessary.

## Reproducible checks

Run `node --experimental-strip-types --test scripts/room-cat.test.mjs` (also included in `npm test`). Seven tests cover:

1. Both ballistic trajectories' exact endpoints and constant downward acceleration.
2. Actual skinned vertices against the original tabletop volume during both jumps, with airborne model height fixed.
3. Unmodified source clips, fixed limb attachment positions, nonzero but small head movement, and preserved foot paths.
4. No pose accumulation after two complete schedules with sitting, grooming, stretching and jumping.
5. Matching positions and normalized quaternions at both ends of the walk and turn loops.
6. Continuous headings, smooth root speed, distance/velocity agreement and a complete seated touch response.
7. Four planted feet during stretching and a grooming paw that reaches below/in front of the muzzle.

Measured on 242 samples spanning one corrected stride at the actual 3.9 model scale: head orientation range **6.904°**, waist range **5.006°**, maximum toe-path deviation from the artist's first complete stride **0.0392 room units**, calibrated stance speed **31.896 room units/second**. The regression allows 0.12 units for toe error. At peak stretch, measured foot drift is below 0.00002 room units; its regression allows 0.02. These are geometric measurements, not a biological validation or a rendered appearance claim.

## Browser review times

Keep the room foreground, do not open an overlay or hover the cat, and count from when the model loads. The complete schedule is **86.80 seconds**. Hot reload resets it; background tabs and room overlays pause it. Reduced-motion preference disables the autonomous schedule.

| Active time | Observable action |
| --- | --- |
| 7.80–12.80 s | Seated paw grooming on the rug |
| 22.19–24.95 s | Turn with short steps |
| 24.95–32.35 s | Accelerate, walk toward the desk, slow down |
| 35.13–35.93 s | Jump onto the rear-right tabletop |
| 40.11–69.11 s | Rest seated on the desk |
| 70.50–74.14 s | Turn toward the floor |
| 74.96–75.68 s | Jump down and absorb landing |
| 77.62–85.02 s | Walk home and slow down |

Hover/tap during a stationary pose should produce a small planted-foot stretch. When initially seated, the full response lasts about 5.76 seconds, including getting up and sitting back down. It pauses the daily schedule, and a 10-second cooldown prevents repeated pointer motion from constantly restarting it.
