/**
 * Daak's hero film, rendered by raea: KNP-1204's real day on the road from Kanpur to Lucknow to Gorakhpur, in cut
 * paper at dawn. Ten shots over a minute, the whole flow: booked and paid by the shop's agent over x402, Ramesh's bus,
 * the three taps and the signed handoff, the sealed check on 0G and the public log, the ride, the handover to Suresh's
 * bus and Ramesh paid, the ride on, the delivery, and the held pay releasing itself along the whole road.
 * The words are not in the picture: the site lays them over it from the same timeline (web/components/landing/film-timeline.ts).
 * Frame-pure: every value comes from the frame; the only randomness is seeded.
 */
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from "raea";
import { Camera3d } from "raea/camera";
import { Quat, Transform } from "raea/transform";
import { AmbientLight, DirectionalLight, PointLight } from "raea/light";
import { Cone, Cuboid, Cylinder, Mesh3d, Sphere, Torus } from "raea/mesh";
import { Capsule3d } from "raea/mesh";
import { StandardMaterial } from "raea/pbr";
import { crossSection, manifold } from "raea/3d";
import { Bloom, Grade, Look, Shadows } from "raea/prelude";

const FPS = 30;
/** The shots, in seconds. The site's captions and stepper read the same list. */
const SHOTS = [
  { id: "dawn", t0: 0, t1: 5 }, { id: "pay", t0: 5, t1: 10 }, { id: "arrive", t0: 10, t1: 15 }, { id: "handover", t0: 15, t1: 21 },
  { id: "check", t0: 21, t1: 28 }, { id: "ride1", t0: 28, t1: 35 }, { id: "lucknow", t0: 35, t1: 41 }, { id: "ride2", t0: 41, t1: 48 },
  { id: "deliver", t0: 48, t1: 53 }, { id: "release", t0: 53, t1: 60 },
] as const;
const FRAMES = 60 * FPS;

const X = { KNP: 0, LKO: 46, GKP: 118 }; // the three stands, in metres of this world
const ROAD_Z = 4, STAND_Z = 7.2, STOP = 7.5;
const INK = "#0d0c09", GOLD = "#c9a15a", BRIGHT = "#f6d48f", PAPER = "#ece5d3";

const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const smooth = (x: number, s: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i + s * 101) * (1 - u) + hash(i + 1 + s * 101) * u; };
const fbm = (x: number, s: number) => smooth(x, s) * 0.55 + smooth(x * 2.3, s + 7) * 0.28 + smooth(x * 5.1, s + 3) * 0.12 + smooth(x * 11, s + 1) * 0.05;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => { const v = clamp01(x); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
type V3 = [number, number, number];
const mix3 = (a: V3, b: V3, p: number): V3 => [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)];

/** A ridge of cut paper: a wide outline of noise, counter-clockwise, extruded thin. */
function ridge(seed: number, height: number, freq: number) {
  const pts: [number, number][] = [[-260, -2], [460, -2]];
  for (let x = 460; x >= -260; x -= 2) pts.push([x, height * 0.35 + fbm((x + 400) * freq, seed) * height]);
  return crossSection.polygon(pts).extrude(0.4);
}
const RIDGES = [
  { z: -150, y: -2, shape: ridge(1, 38, 0.012), color: "#c09860", p: 0.75 },
  { z: -100, y: -2, shape: ridge(2, 26, 0.018), color: "#9c784a", p: 0.6 },
  { z: -64, y: -1.5, shape: ridge(3, 16, 0.026), color: "#755838", p: 0.42 },
  { z: -36, y: -1, shape: ridge(4, 9, 0.04), color: "#4b3a27", p: 0.22 },
  { z: -16, y: -0.5, shape: ridge(5, 4.5, 0.07), color: "#2e261b", p: 0 },
];
const busBody = manifold.roundedBox(10, 2.7, 2.5, 0.35);
const TREES = Array.from({ length: 40 }, (_, i) => ({ x: -70 + i * 6 + (hash(i * 3.1) - 0.5) * 4, z: -6 - hash(i * 7.7) * 7, s: 0.8 + hash(i * 1.3) * 0.7 }));
const GRASS = Array.from({ length: 1400 }, (_, i) => ({ x: -80 + hash(i * 1.7) * 260, z: 13 + hash(i * 2.9) * 8, h: 0.9 + hash(i * 4.1) * 1.4, lean: (hash(i * 6.3) - 0.5) * 0.5 }));
const MOTES = Array.from({ length: 70 }, (_, i) => ({ x: hash(i * 2.1), y: hash(i * 5.3), z: hash(i * 9.7), gold: i % 6 === 0 }));

/** Where everything is at time t (seconds): the two buses, the parcel, how far the road is proven. */
function world(t: number) {
  const a = t < 10 ? X.KNP - STOP - 70
    : t < 15 ? X.KNP - STOP - 70 * (1 - easeOut((t - 10) / 4))
    : t < 28 ? X.KNP - STOP
    : t < 35 ? lerp(X.KNP - STOP, X.LKO - STOP, easeInOut((t - 28) / 7))
    : X.LKO - STOP;
  const b = t < 41 ? X.LKO + STOP : t < 48 ? lerp(X.LKO + STOP, X.GKP - STOP, easeInOut((t - 41) / 7)) : X.GKP - STOP;
  const doorA = a + 4.2, doorB = b - 4.2, doorB2 = b + 4.2;
  const shop: V3 = [X.KNP + 1.2, 1.25, STAND_Z - 0.6], rcv: V3 = [X.GKP + 1.2, 1.25, STAND_Z - 0.6];
  const onA: V3 = [doorA, 1.9, ROAD_Z + 1.5], onB: V3 = [doorB2, 1.9, ROAD_Z + 1.5];
  const arc = (p0: V3, p1: V3, p: number): V3 => { const e = easeInOut(p); const m = mix3(p0, p1, e); return [m[0], m[1] + Math.sin(e * Math.PI) * 1.6, m[2]]; };
  const parcel: V3 = t < 16.5 ? shop
    : t < 19.5 ? arc(shop, onA, (t - 16.5) / 3)
    : t < 37 ? onA
    : t < 39.5 ? arc(onA, [doorB, 1.9, ROAD_Z + 1.5], (t - 37) / 2.5)
    : t < 49.5 ? onB
    : t < 51.5 ? arc(onB, rcv, (t - 49.5) / 2)
    : rcv;
  const proven = t < 21 ? X.KNP : t < 35 ? Math.max(X.KNP, a + 5) : t < 41 ? X.LKO : Math.max(X.LKO, b + 5);
  return { a, b, doorA, parcel, proven, aMoving: (t >= 10 && t < 14) || (t >= 28 && t < 35), bMoving: t >= 41 && t < 48 };
}

/** The camera for each shot: where it stands and what it looks at, the subject kept right of centre. */
function camera(t: number, W: ReturnType<typeof world>): { eye: V3; at: V3; fov: number } {
  const s = SHOTS.find((x) => t >= x.t0 && t < x.t1) ?? SHOTS[SHOTS.length - 1];
  const p = span(t, s.t0, s.t1);
  switch (s.id) {
    case "dawn": return { eye: mix3([-75, 16, 90], [-30, 7, 52], easeInOut(p)), at: mix3([-40, 10, 0], [-18, 4.2, 0], easeInOut(p)), fov: 34 };
    case "pay": return { eye: mix3([X.KNP - 4, 2.4, STAND_Z + 9], [X.KNP - 3.2, 2.2, STAND_Z + 7], easeInOut(p)), at: mix3([X.KNP + 0.4, 1.5, STAND_Z], [X.KNP + 0.6, 1.7 + easeInOut(span(p, 0.45, 1)) * 2.6, STAND_Z], easeInOut(p)), fov: 32 };
    case "arrive": return { eye: [W.a - 16, 3.4, 42], at: [W.a - 9, 4.0, 0], fov: 34 };
    case "handover": return { eye: mix3([X.KNP - 9, 2.7, STAND_Z + 11], [X.KNP - 7, 2.6, STAND_Z + 9.5], easeInOut(p)), at: [X.KNP - 4.5, 1.9, ROAD_Z + 1.5], fov: 32 };
    case "check": return { eye: mix3([W.doorA - 5, 2.4, ROAD_Z + 8], [W.doorA - 4, 2.6, ROAD_Z + 7], easeInOut(p)), at: [W.doorA - 1.6, 1.9 + easeInOut(span(p, 0.55, 1)) * 2.2, ROAD_Z + 1.5], fov: 34 };
    case "ride1": return { eye: [W.a - 15, 3.0, 36], at: [W.a - 8, 3.6, 0], fov: 34 };
    case "lucknow": { const m = (W.a + W.b) / 2; return { eye: mix3([m - 14, 3.2, 33], [m - 12, 3, 30], easeInOut(p)), at: [m - 6, 3.2, 0], fov: 34 }; }
    case "ride2": return { eye: [W.b - 13, 1.9, 26], at: [W.b - 6, 2.2, 0], fov: 36 };
    case "deliver": return { eye: mix3([X.GKP - 8, 2.7, STAND_Z + 11], [X.GKP - 6.5, 2.6, STAND_Z + 9.5], easeInOut(p)), at: [X.GKP - 3.5, 1.9, ROAD_Z + 1.5], fov: 32 };
    default: return { eye: mix3([X.GKP - 22, 6, 42], [X.GKP - 95, 34, 150], easeInOut(p)), at: mix3([X.GKP - 14, 3, 0], [X.GKP - 76, 3, 0], easeInOut(p)), fov: 34 };
  }
}

function Parcel({ at, s }: { at: V3; s: number }) {
  return (
    <>
      <Mesh3d transform={Transform.fromXyz(at[0], at[1], at[2])}><Cuboid half_size={[s / 2, s / 2, s / 2]} /><StandardMaterial base_color={PAPER} /></Mesh3d>
      <Mesh3d transform={Transform.fromXyz(at[0], at[1], at[2] + s / 2 + 0.01)}><Cuboid half_size={[s / 2, s * 0.08, 0.01]} /><StandardMaterial base_color={GOLD} unlit /></Mesh3d>
    </>
  );
}

function Bus({ x, moving, f }: { x: number; moving: boolean; f: number }) {
  const bob = moving ? Math.sin(f * 0.9) * 0.03 : 0, spin = moving ? f * 0.35 : 0;
  return (
    <>
      <Mesh3d transform={Transform.fromXyz(x, 1.75 + bob, ROAD_Z)} shape={busBody}><StandardMaterial base_color={INK} perceptual_roughness={0.9} /></Mesh3d>
      {Array.from({ length: 7 }, (_, i) => (
        <Mesh3d key={i} transform={Transform.fromXyz(x - 3.9 + i * 1.25, 2.25 + bob, ROAD_Z + 1.27)}><Cuboid half_size={[0.42, 0.34, 0.02]} /><StandardMaterial base_color={GOLD} unlit /></Mesh3d>
      ))}
      <Mesh3d transform={Transform.fromXyz(x + 4.98, 1.0 + bob, ROAD_Z + 0.9)}><Cuboid half_size={[0.04, 0.14, 0.2]} /><StandardMaterial base_color={BRIGHT} unlit /></Mesh3d>
      <Mesh3d transform={Transform.fromXyz(x - 0.5, 3.25 + bob, ROAD_Z)}><Cuboid half_size={[3.6, 0.1, 1.0]} /><StandardMaterial base_color={INK} /></Mesh3d>
      {[-1.8, 0.2].map((dx) => <Parcel key={dx} at={[x + dx, 3.66 + bob, ROAD_Z]} s={0.62} />)}
      {[-3, 3].map((dx) => (
        <Mesh3d key={`w${dx}`} transform={Transform.fromXyz(x + dx, 0.55, ROAD_Z + 1.1).withRotation(Quat.fromEuler("XYZ", Math.PI / 2, spin, 0))}><Cylinder radius={0.55} half_height={0.2} /><StandardMaterial base_color="#050504" /></Mesh3d>
      ))}
      {moving && <PointLight transform={Transform.fromXyz(x + 7, 1.2, ROAD_Z + 1.5)} intensity={260000} color="#f3d08a" range={8} paint />}
    </>
  );
}

function Stand({ x, lit }: { x: number; lit: boolean }) {
  return (
    <>
      {[-1.6, 1.6].map((dx) => <Mesh3d key={dx} transform={Transform.fromXyz(x + dx, 1.5, STAND_Z)}><Cuboid half_size={[0.09, 1.5, 0.09]} /><StandardMaterial base_color={INK} /></Mesh3d>)}
      <Mesh3d transform={Transform.fromXyz(x, 3.1, STAND_Z).withRotation(Quat.fromEuler("XYZ", 0, 0, -0.08))}><Cuboid half_size={[2.3, 0.08, 1.1]} /><StandardMaterial base_color={INK} /></Mesh3d>
      <Mesh3d transform={Transform.fromXyz(x + 1.6, 0.5, STAND_Z - 0.6)}><Cuboid half_size={[0.9, 0.5, 0.45]} /><StandardMaterial base_color="#16130e" /></Mesh3d>
      <Mesh3d transform={Transform.fromXyz(x, 2.75, STAND_Z + 0.3)}><Sphere radius={0.14} /><StandardMaterial base_color={lit ? BRIGHT : "#8a6c40"} unlit /></Mesh3d>
      <PointLight transform={Transform.fromXyz(x, 2.6, STAND_Z + 1.2)} intensity={lit ? 520000 : 160000} color="#f0c57a" range={9} paint />
    </>
  );
}

function Person({ x, z }: { x: number; z: number }) {
  return (
    <>
      <Mesh3d transform={Transform.fromXyz(x, 0.85, z)}><Capsule3d radius={0.28} half_length={0.55} /><StandardMaterial base_color={INK} /></Mesh3d>
      <Mesh3d transform={Transform.fromXyz(x, 1.92, z)}><Sphere radius={0.24} /><StandardMaterial base_color={INK} /></Mesh3d>
    </>
  );
}

/** Rings opening out from a point, facing the camera's side of the road. */
function Rings({ at, p, count = 3, size = 3.2 }: { at: V3; p: number; count?: number; size?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const q = p * (1 + count * 0.2) - i * 0.22;
        if (q <= 0 || q >= 1) return null;
        const r = 0.3 + q * size;
        return <Mesh3d key={`ring${i}`} transform={Transform.fromXyz(at[0], at[1], at[2] + 0.1).withScale([r, r, 1])}><Torus major_radius={1} minor_radius={0.022 / r} /><StandardMaterial base_color={GOLD} unlit /></Mesh3d>;
      })}
    </>
  );
}

/** Gold specks travelling from a point up into the sky: a payment, or a record going on the public log. */
function Thread({ from, p, n = 16, height = 14 }: { from: V3; p: number; n?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const q = p * 1.6 - (i / n) * 0.6;
        if (q <= 0 || q >= 1) return null;
        const sz = 0.13 * (1 - q * 0.4);
        return <Mesh3d key={`th${i}`} transform={Transform.fromXyz(from[0] + Math.sin(i * 1.7) * 0.4 * q, from[1] + q * height, from[2] + 0.3)}><Cuboid half_size={[sz, sz, sz]} /><StandardMaterial base_color={BRIGHT} emissive={BRIGHT} unlit /></Mesh3d>;
      })}
    </>
  );
}

function Film() {
  const f = useCurrentFrame();
  const t = f / FPS;
  const W = world(t);
  const C = camera(t, W);
  const camX = C.eye[0];
  const phone: V3 = [X.KNP + 2.1, 1.04, STAND_Z - 0.4];
  const release = span(t, 54, 59);
  const lit = { KNP: t >= 10, LKO: t >= 35, GKP: t >= 48 };

  return (
    <AbsoluteFill style={{ background: "#2a2218" }}>
      <Camera3d transform={Transform.fromXyz(...C.eye).lookingAt(C.at)} projection={{ Perspective: { fov: (C.fov * Math.PI) / 180 } }} />
      <Look mode="paint" bands={3} shadow="#5d4b35" mid="#9c7f55" grain={0.32} rag={1.7} sky={["#2a2116", "#c99a58"]} />
      <DirectionalLight transform={Transform.fromXyz(camX + 40, 14, -60).lookingAt([camX, 0, 0])} illuminance={9500} shadow_maps_enabled />
      <Shadows distance={90} firstCascade={60} cascades={1} mapSize={4096} />
      <AmbientLight brightness={140} />
      <Bloom intensity={0.6} threshold={0.85} />
      <Grade temperature={0.06} vignette={0.36} />

      {/* The low sun climbs a little through the morning. */}
      <Mesh3d transform={Transform.fromXyz(camX * 0.9 + 30, 30 + t * 0.25, -260)}><Sphere radius={20} /><StandardMaterial base_color="#d9b06a" unlit /></Mesh3d>

      {RIDGES.map((r, i) => <Mesh3d key={`ridge${i}`} transform={Transform.fromXyz(camX * r.p, r.y, r.z)} shape={r.shape}><StandardMaterial base_color={r.color} perceptual_roughness={1} /></Mesh3d>)}

      {TREES.flatMap((tr, i) => [
        <Mesh3d key={`trunk${i}`} transform={Transform.fromXyz(tr.x, 1.6 * tr.s, tr.z)}><Cylinder radius={0.16 * tr.s} half_height={1.6 * tr.s} /><StandardMaterial base_color="#1a1610" /></Mesh3d>,
        ...[[0, 0, 1], [-1.1, -0.25, 0.7], [1.2, -0.2, 0.65]].map(([dx, dy, sc], j) => (
          <Mesh3d key={`crown${i}-${j}`} transform={Transform.fromXyz(tr.x + dx * tr.s, (3.3 + dy) * tr.s, tr.z).withScale([1.9 * sc * tr.s, 0.55 * sc * tr.s, 1.4 * sc * tr.s])}><Sphere radius={1} /><StandardMaterial base_color="#1d1912" /></Mesh3d>
        )),
      ])}

      <Mesh3d transform={Transform.fromXyz(60, -0.5, 0)}><Cuboid half_size={[320, 0.5, 70]} /><StandardMaterial base_color="#2a231a" perceptual_roughness={1} /></Mesh3d>
      <Mesh3d transform={Transform.fromXyz(60, 0.01, ROAD_Z)}><Cuboid half_size={[320, 0.02, 1.8]} /><StandardMaterial base_color="#17140f" /></Mesh3d>
      {W.proven > X.KNP && <Mesh3d transform={Transform.fromXyz((X.KNP + W.proven) / 2, 0.05, ROAD_Z + 1.9)}><Cuboid half_size={[(W.proven - X.KNP) / 2, 0.03, 0.08]} /><StandardMaterial base_color={GOLD} unlit /></Mesh3d>}
      {release > 0 && release < 1 && <Mesh3d transform={Transform.fromXyz(lerp(X.GKP, X.KNP, release), 0.09, ROAD_Z + 1.9)}><Cuboid half_size={[4, 0.06, 0.16]} /><StandardMaterial base_color={BRIGHT} unlit /></Mesh3d>}

      {Array.from({ length: 22 }, (_, i) => -60 + i * 11).flatMap((px) => [
        <Mesh3d key={`pole${px}`} transform={Transform.fromXyz(px, 3.2, ROAD_Z - 2.6)}><Cuboid half_size={[0.08, 3.2, 0.08]} /><StandardMaterial base_color={INK} /></Mesh3d>,
        <Mesh3d key={`wire${px}`} transform={Transform.fromXyz(px + 5.5, 6.1, ROAD_Z - 2.6)}><Cuboid half_size={[5.5, 0.025, 0.025]} /><StandardMaterial base_color={INK} /></Mesh3d>,
      ])}

      <Stand x={X.KNP} lit={lit.KNP} />
      <Stand x={X.LKO} lit={lit.LKO} />
      <Stand x={X.GKP} lit={lit.GKP} />
      <Person x={X.KNP + 0.4} z={STAND_Z - 1.4} />
      <Person x={X.GKP + 0.9} z={STAND_Z - 1.4} />
      {/* The shop's phone on the counter at Kanpur, its screen lit while the agent books and pays. */}
      <Mesh3d transform={Transform.fromXyz(phone[0], phone[1] + 0.32, phone[2] + 0.3).withRotation(Quat.fromEuler("XYZ", -0.35, 0, 0))}><Cuboid half_size={[0.22, 0.4, 0.03]} /><StandardMaterial base_color={INK} /></Mesh3d>
      <Mesh3d transform={Transform.fromXyz(phone[0], phone[1] + 0.33, phone[2] + 0.335).withRotation(Quat.fromEuler("XYZ", -0.35, 0, 0))}><Cuboid half_size={[0.19, 0.36, 0.005]} /><StandardMaterial base_color={t >= 5 && t < 10 ? BRIGHT : "#3a3226"} unlit /></Mesh3d>

      <Bus x={W.a} moving={W.aMoving} f={f} />
      <Bus x={W.b} moving={W.bMoving} f={f} />
      <Parcel at={W.parcel} s={0.75} />

      {/* Booked and paid over x402: gold from the shop's phone up to the public network. */}
      {t >= 5.5 && t < 10 && <Thread from={phone} p={span(t, 5.5, 9.8)} n={22} height={16} />}
      {/* Three taps: the sticker, the badge, the lid photo (a flash). */}
      {t >= 15 && t < 16.2 && <Rings at={[X.KNP + 1.2, 1.25, STAND_Z - 0.2]} p={span(t, 15, 16.2)} count={2} size={0.9} />}
      {t >= 15.6 && t < 16.8 && <Rings at={[X.KNP + 0.4, 1.4, STAND_Z - 1.0]} p={span(t, 15.6, 16.8)} count={2} size={0.9} />}
      {t >= 16.2 && t < 16.6 && <PointLight transform={Transform.fromXyz(X.KNP + 1.2, 2, STAND_Z + 1)} intensity={2400000} color="#fff6e0" range={10} paint />}
      {/* The sealed check, then the record going on the public log. */}
      {t >= 21 && t < 25 && <Rings at={W.parcel} p={span(t, 21, 25)} />}
      {t >= 24.5 && t < 28 && <Thread from={W.parcel} p={span(t, 24.5, 27.8)} n={20} height={18} />}
      {/* Lucknow: Ramesh paid the moment Suresh has it. */}
      {t >= 39.5 && t < 41 && <Thread from={[W.a, 3.6, ROAD_Z + 1.3]} p={span(t, 39.5, 41)} n={14} height={9} />}
      {t >= 51.5 && t < 53 && <Thread from={[W.b, 3.6, ROAD_Z + 1.3]} p={span(t, 51.5, 53)} n={14} height={9} />}
      {/* Released: gold rising all along the road behind the sweep. */}
      {release > 0 && Array.from({ length: 50 }, (_, i) => {
        const x = X.KNP + hash(i * 3.3) * (X.GKP - X.KNP);
        const life = clamp01((release - (1 - (x - X.KNP) / (X.GKP - X.KNP))) * 2.5);
        if (life <= 0 || life >= 1) return null;
        return <Mesh3d key={`rel${i}`} transform={Transform.fromXyz(x, 0.4 + life * (3 + hash(i * 8.8) * 5), ROAD_Z + 2 + hash(i) * 2)}><Cuboid half_size={[0.09, 0.09, 0.09]} /><StandardMaterial base_color={BRIGHT} unlit /></Mesh3d>;
      })}

      {/* Grass in front, swaying. */}
      {GRASS.map((g, i) => {
        if (Math.abs(g.x - camX - 12) > 45) return null;
        const sway = Math.sin(t * 1.3 + i) * 0.06;
        return <Mesh3d key={`grass${i}`} transform={Transform.fromXyz(g.x, g.h / 2, g.z).withRotation(Quat.fromEuler("XYZ", 0, 0, g.lean * 0.3 + sway))}><Cone radius={0.07} height={g.h} /><StandardMaterial base_color="#100d09" /></Mesh3d>;
      })}

      {/* Dust in the low sun. */}
      {MOTES.map((m, i) => {
        const x = camX - 6 + ((m.x * 50 + t * (0.4 + m.z)) % 50);
        const y = 1 + m.y * 9 + Math.sin(t * 0.5 + i) * 0.2;
        return <Mesh3d key={`mote${i}`} transform={Transform.fromXyz(x, y, 6 + m.z * 12)}><Sphere radius={0.025 + m.z * 0.03} /><StandardMaterial base_color={m.gold ? BRIGHT : "#d8ccb0"} unlit /></Mesh3d>;
      })}
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="daak-hero" component={Film} width={1920} height={1080} fps={FPS} durationInFrames={FRAMES} />);
