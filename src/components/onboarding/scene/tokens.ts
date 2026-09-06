/**
 * Choreography for the mart scene on Onboarding.
 *
 * The seven source files in src/assets/mart-svg are slices of ONE 500-unit
 * illustration, so nothing here positions artwork — src/.../art/boxes.ts holds
 * each layer's own bounds and this file only says how each one arrives.
 *
 * Distances are in viewBox units; a wrapper multiplies by the scene scale.
 */
import { Easing } from 'react-native-reanimated';

/**
 * The ground plane, measured rather than guessed.
 *
 * Every shadow in 02-shadows.svg is a parallelogram whose edges are the scene's
 * two ground axes. The shelf's shadow runs (154.42,295.94) → (195.63,319.73),
 * i.e. (41.21, 23.79) — exactly 30.0 degrees. So this is textbook 2:1 isometric
 * and the ground axes are (±cos30, ±0.5).
 *
 * This matters more than it looks: a fixture sliding along screen-x reads as a
 * flat sprite being dragged, while the same fixture sliding along its own ground
 * axis reads as being pushed into place inside the room. Every entry below is
 * expressed on these axes for that reason.
 */
const COS30 = 0.8660254;

/** Where a layer starts, as an offset from its home position. */
export type Entry = { dx: number; dy: number };

const along = (x: 1 | -1, y: 1 | -1, d: number): Entry => ({
  dx: x * COS30 * d,
  dy: y * 0.5 * d,
});

/**
 * Entries: one vector per object, and the pairs mirror.
 *
 * Each object arrives at the same moment as its opposite number and from the
 * opposite side, so a beat is two gestures converging rather than one crowd
 * moving. The shelf comes in from the left and the freezer from the right on the
 * same clock; then the woman and the baskets come from the left while the man
 * comes from the right on the next one.
 *
 * The signs are ground axes, not screen directions — a fixture sliding along
 * screen-x reads as a flat sprite being dragged, while the same fixture on its own
 * ground axis reads as being pushed across the floor. The two fixtures take the
 * two *back* axes, so they arrive away from the camera; all three of the people
 * take the two *front* axes, so they arrive towards it. That is the difference
 * between stocking a room and walking into one.
 *
 * Nothing here leaves the floor. Travelling along a ground axis moves an object
 * horizontally across the room, and the screen-y that comes with it is the
 * isometric projection of that, not a descent. It is why ShadowLayer no longer
 * grows a shadow as its owner arrives.
 *
 * Each distance is sized so its object *and its own shadow* stand clear of the slot
 * before the beat, which is what makes an entry read as coming from somewhere
 * rather than appearing. The slot spans -16 to 516 in scene units on every screen
 * size (the square is always 94% of the width, so the margin is always 3% of it),
 * and MartScene clips to exactly that, so off-slot is not merely elsewhere — it is
 * not drawn:
 *
 *               home x      starts at     clear by
 *   shelf        48..217    -203..-34       18.2
 *   freezer     343..484     534..675       15.5   set by its shadow
 *   woman        94..235    -166..-25       17.5
 *   baskets       17..84    -251..-184     168.5   rides the woman's vector
 *   man         234..437     546..749       17.8   set by its shadow
 *
 * The shadow is what sets two of them: a shadow box is not its owner's box, and the
 * man's reaches 12 units further left than he does, so 345 cleared him and left his
 * shadow's leading corner inside the frame. Sizing to the object alone is the bug
 * that produces one dark wedge sitting in the corner before anything arrives.
 *
 * The baskets share the woman's vector exactly, so the two hold their 10-unit gap
 * the whole way in and the left half arrives as one arrangement. That is also why
 * the one fixture on the people clock does not read as a stray shelf unit.
 *
 * These are 1.4x to 1.8x the distances the two old grouped entries used, because a
 * group only had to get its *leading* member off-slot while an individual object
 * has to get itself off. On a 411dp screen it works out at 193 to 278 dp/s against
 * 140 to 155 before — still far below ordinary UI motion, where a full-width
 * Material slide runs past 1000 dp/s. No duration changed, so each beat is the
 * same length with more ground covered inside it.
 */
export const ENTRY = {
  floor: { dx: 0, dy: 70 },
  /** In from the upper left, away from the camera. */
  shelf: along(-1, -1, 290),
  /** In from the upper right, mirroring the shelf. */
  freezer: along(1, -1, 220),
  /** In from the lower left, towards the camera. */
  woman: along(-1, 1, 310),
  /** The woman's vector exactly, so the pair travels as one. */
  baskets: along(-1, 1, 310),
  /** In from the lower right, mirroring the woman. */
  man: along(1, 1, 360),
} as const satisfies Record<string, Entry>;

/**
 * How long a layer takes to become present, as a fraction of its own beat.
 *
 * Two numbers because there are two kinds of arrival here. Everything that slides
 * starts outside the clip, so its fade is a guard and nothing more: at 0.05 an
 * object is fully opaque well before its leading edge reaches the frame — the
 * tightest margin in the scene is the man's shadow, which crosses at 0.057 — so the
 * fade is never actually seen and a distance shortened later degrades into
 * something soft instead of into a piece appearing beside the copy.
 *
 * The floor is the exception and needs the long one. It does not enter: it starts
 * inside the frame, 70 units low, and lifts. With the guard value it would snap on
 * at full opacity almost immediately and then slide, which is a pop. Its fade *is*
 * its entrance, so it gets 0.18 — the value everything used to share, back when
 * fixtures also started inside the canvas and needed covering.
 */
export const FADE = {
  entry: 0.05,
  rise: 0.18,
} as const;

/**
 * Stage timings, ms.
 *
 *     0   the room fades up out of the flat cyan            →  800
 *     0   floor rises from below                            →  620
 *   240   shelf in from the left, freezer from the right     → 1120
 *  1100   woman and baskets from the left, man from the right → 2100
 *  1240   headline, then the subtitle                       → 1940
 *  2100   Start button, once the scene has finished         → 2600
 *
 * Five beats where there were nine, and 2600ms where there were 3760. Both come
 * from the same change: things that used to be staged one after another now move
 * at once, so the sequence is no longer paying for six separate arrivals to each
 * be individually legible. Two arrivals are, at durations that would have been
 * too slow to afford before.
 *
 * A beat is a moment, not a body. The objects sharing one no longer share a
 * vector — the shelf and the freezer read the same number and travel opposite ways
 * on it — so simultaneity is structural here while direction stays per-object in
 * ENTRY. That is also the answer to why five objects need only two arrival beats:
 * what makes an entry legible is the pair converging, not each piece taking a turn.
 *
 * The two are all but sequential — the customers begin 20ms before the fixtures
 * land. The shop assembling and then being walked into is the order that makes
 * sense of the scene, and 20ms is enough that the second gesture inherits the
 * first's momentum instead of starting from a standstill.
 *
 * The room runs slightly longer than the floor on purpose. The floor lands first
 * and the light is still coming up under it, so the last thing to resolve in the
 * opening beat is the room rather than the object — which is the order it happens
 * in when someone turns the shop lights on.
 *
 * The title and subtitle do not wait for the customers. They sit below the scene,
 * so they compete with nothing by resolving while the two are still crossing. The
 * button is the exception and waits for all of it: it is the one thing here that
 * asks to be acted on, and offering it mid-sequence invites the user out of a
 * scene that is still playing. So its delay is exactly `people.delay + people.ms`
 * — gen_screen_preview.py asserts that equality rather than trusting this comment,
 * because the two numbers are written out separately.
 */
export const T = {
  room: { delay: 0, ms: 800 },
  floor: { delay: 0, ms: 620 },
  fixtures: { delay: 240, ms: 880 },
  people: { delay: 1100, ms: 1000 },
  title: { delay: 1240, ms: 560 },
  subtitle: { delay: 1380, ms: 560 },
  button: { delay: 2100, ms: 500 },
} as const;

/**
 * When the illustration is finished — the customers are the last thing in it. The
 * Start button's delay above is this number, written out, so anything that needs
 * to wait for the scene can compare against it.
 */
export const SCENE_MS = T.people.delay + T.people.ms;

/**
 * Easings.
 *
 * This is where the sequence used to go wrong. The previous set were expo-style
 * out-curves — bezier(0.22, 1, 0.26, 1) and relatives — which on paper look like a
 * long, luxurious deceleration and measure as the opposite. That curve covers 81% of
 * the distance in the first quarter of the beat and hits 4.5x its own average speed,
 * so an 860ms slide was visibly finished in 356ms and spent the remaining 500ms
 * creeping the last 3%. The whole scene therefore snapped into place in its first
 * third and then appeared to hang. The durations were never the problem, which is
 * why not one of the timings above changed.
 *
 * Replacements are chosen on two measurements: the distance covered at the halfway
 * point of the beat, and how much of the beat is spent between 5% and 95% of the
 * distance — the part the eye reads as movement. Shown on the longest beat each curve
 * drives (the floor, the shelf, the man, the baskets, the title):
 *
 *            visible motion         at half-beat    peak speed
 *   rise     294 → 572 of 700ms      97% → 62%      6.2x → 1.3x
 *   slide    356 → 688 of 860ms      97% → 62%      4.5x → 1.3x
 *   walk     578 → 826 of 980ms      89% → 54%      2.2x → 1.1x
 *   drop     196 → 421 of 580ms     107% → 64%      4.4x → 1.3x
 *   copy     269 → 505 of 640ms      97% → 66%      6.2x → 1.4x
 *
 * All five end at zero velocity (y2 = 1 with x2 < 1), so nothing arrives still
 * travelling, and all five start with a real ease-in (x1 >= 0.24), so nothing starts
 * at full speed. Fixtures get no overshoot — a loaded shelf that bounces on landing
 * reads as weightless.
 *
 * `drop` is currently unreferenced. It existed for the baskets being set down on
 * their own beat, and the baskets now slide in on the people clock alongside the
 * woman; the curve is kept because its numbers above were measured rather than
 * picked, and a beat that needs a settling overshoot again should reuse it rather
 * than invent one.
 *
 * The walk cycle was being quietly ruined by the old curves and comes right with
 * these, untouched: |sin| runs on progress, so the man used to take all four of his
 * steps in his first 480ms and slide the rest of the way. The shadow spread these
 * also rescued no longer exists — see SHADOW below for why it went.
 *
 * Searched, not guessed: outputs/pick_easing.py scores candidates on the numbers
 * above and discards the ones that look even but start at infinite speed (x1 = 0) or
 * never settle (x2 = 1).
 */
export const EASE = {
  rise: Easing.bezier(0.26, 0.32, 0.74, 1),
  slide: Easing.bezier(0.3, 0.32, 0.7, 1),
  drop: Easing.bezier(0.24, 0.25, 0.9, 1.3),
  walk: Easing.bezier(0.26, 0.22, 0.84, 1),
  copy: Easing.bezier(0.32, 0.42, 0.68, 1),
} as const;

/**
 * Walk cycles. Three half-strides for the woman, four for the man since he is
 * pushing a cart and covers more ground; both use |sin| so the body only ever
 * rises, and both are damped to exactly zero at the end so nobody lands
 * mid-bounce. Amplitudes are small — 2 units is 1.5dp at the drawn size, which
 * is the difference between "walking" and "hopping".
 *
 * The two share one clock (the `people` beat) and now walk in from opposite sides,
 * so the step counts are doing less work than they were — but they still set stride
 * length, which is distance ÷ steps: 103 units per half-stride for the woman
 * against 86 for the man. He is pushing a cart, so the shorter, quicker step is the
 * right way round. Change a distance in ENTRY and this moves with it silently; the
 * step counts are the only lever that puts it back.
 */
export const WALK = {
  woman: { steps: 3, lift: 2.2 },
  man: { steps: 4, lift: 1.7 },
} as const;

/**
 * How a shadow behaves under its owner.
 *
 * A shadow is exactly as present as the thing casting it, and it is on the floor for
 * the whole entry. Both of those used to be violated. It faded up over its own
 * window — 0.08 to 0.5 of progress for fixtures, 0 to 0.25 for characters — rather
 * than its owner's, so a fully opaque object crossed the frame edge trailing a
 * half-there shadow. And fixture shadows spread from 0.7 scale starting at 0.45 of
 * progress, which is the contact shadow of something being lowered onto the floor.
 * Nothing is lowered: a ground-axis entry slides an object *across* the floor, and
 * the screen-y it picks up on the way is the isometric projection of that, not a
 * fall. The spread was animating a descent that never happened, so it is gone, and
 * shadows now fade over exactly the window their owner does — FADE above, passed
 * through the same prop on both layers — and travel at full size.
 *
 * What is left is the part that is real. A foot leaving the floor does tighten and
 * lighten its shadow and land wider and darker again, so both characters and the
 * cart keep a slight pulse against the gait. It is applied here and not in WalkLayer
 * because the body's lift must never reach the shadow: one that bounced with the
 * feet would look glued to them.
 */
export const SHADOW = {
  /** Characters only: how far the shadow tightens as the body lifts. */
  pulseScale: 0.06,
  pulseOpacity: 0.18,
} as const;

/**
 * The room.
 *
 * MartBackdrop owns all of its geometry; the only thing choreography has to say
 * about it is that it comes up first and comes up by itself.
 *
 * An earlier version of this file justified a light pool behind the artwork as
 * load-bearing for legibility, on the grounds that ~16% of the freezer and the man
 * sit within a small luminance distance of the field colour. Rendering the scene
 * on bare cyan disproved it: those pixels are cyan accents sitting against each
 * object's own white and charcoal forms, so being close to the field colour costs
 * nothing unless the pixel actually touches the field. The room is therefore an
 * atmosphere job, not a rescue — which is why it is allowed to stay faint.
 *
 * It fades, and only fades. A room that slid or scaled into place would be the one
 * element in the scene contradicting the fact that the camera is not moving. So it
 * has no tokens of its own — just the `room` beat above.
 */

/** Scene square as a fraction of the slot width. */
export const SCENE_FILL = 0.94;
