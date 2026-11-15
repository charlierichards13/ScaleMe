// Generates web/src/components/welcome/hero-ribbon.ts, the static data behind
// the welcome page's hero sculpture (Issue #43).
//
//   node scripts/generate-hero-art.mjs        (run from web/)
//
// The ribbon is modeled in 3D: a smooth centerline through a few control
// points, a band of tapering width that twists along it, and a small
// thickness. It's lit with a soft key light plus a satin sheen, projected
// with mild perspective, and cut into short pieces. Each piece is a single
// SVG path filled with a linear gradient that follows its shading. Pieces are
// written back-to-front, so overlapping folds occlude correctly (painter's
// algorithm). The output is deterministic: no randomness, and the same input
// always gives the same file.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// --- Art direction (edit these, then re-run) -------------------------------

/**
 * The form: one satin band rising in a widening spiral (about 1.4 turns),
 * drifting to the right as it climbs. Its width runs mostly along the spiral's
 * axis, like a curled ribbon, and tilts outward as it rises.
 */
const SPIRAL = {
  turns: 1.6,
  startAngle: -2.2, // radians; where the band begins around the axis
  radius: [0.26, 0.98], // start → end
  height: [-0.55, 0.62], // y at start → end
  drift: [-0.08, 0.12], // axis x at start → end (the spiral leans right as it rises)
  tilt: [0.45, 1.2], // band tilt from the axis toward the outside, start → end (radians)
};
const SAMPLES = 180; // segments along the ribbon
const PIECE_LENGTH = 3; // segments per SVG piece (short pieces keep the shading continuous)
const MAX_WIDTH = 0.36; // ribbon width at its widest
const THICKNESS = 0.028;
const CAMERA = { pitch: -0.88, yaw: 0.3, distance: 4.6 };
/** The projected sculpture is scaled to fit this box (SVG units; the viewBox is 560 × 500). */
const FRAME = { x: 40, y: 22, width: 480, height: 420 };
const LIGHT = normalize([0.25, 0.85, 0.6]); // key light: above, slightly right, in front
const FILL = normalize([-0.8, 0.1, 0.45]); // soft fill from the left

/** Satin lavender for the outer face, deeper violet for the inner face. */
const palette = {
  front: { shade: [124, 116, 220], base: [178, 172, 247], lit: [229, 227, 255], sheen: [253, 252, 255] },
  back: { shade: [104, 84, 196], base: [156, 132, 236], lit: [211, 198, 253], sheen: [243, 237, 255] },
};

// --- Vector helpers ----------------------------------------------------------

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return scale(a, 1 / l); }
function mix(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
function smooth(t) { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); }
const lerp = ([from, to], t) => from + (to - from) * t;

// --- Geometry ----------------------------------------------------------------

/** World-space centerline point and band direction at t ∈ [0, 1]. */
function spiral(t) {
  const eased = t * 0.88 + smooth(t) * 0.12; // climbs a little faster in the middle
  const angle = SPIRAL.startAngle + Math.PI * 2 * SPIRAL.turns * t;
  const radius = lerp(SPIRAL.radius, t);
  const radial = [Math.cos(angle), 0, Math.sin(angle)];
  const point = [lerp(SPIRAL.drift, t) + radius * radial[0], lerp(SPIRAL.height, eased), radius * radial[2]];
  const tilt = lerp(SPIRAL.tilt, smooth(t));
  const across = normalize(add(scale([0, 1, 0], Math.cos(tilt)), scale(radial, Math.sin(tilt))));
  return { point, across };
}

/** Camera space: rotate (yaw, then pitch), z toward the viewer. */
function toCamera(p) {
  const { yaw, pitch } = CAMERA;
  const x1 = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
  const z1 = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
  const y2 = p[1] * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = p[1] * Math.sin(pitch) + z1 * Math.cos(pitch);
  return [x1, y2, z2];
}

let fit = { scale: 1, x: 0, y: 0 };

function project(p) {
  const s = CAMERA.distance / (CAMERA.distance - p[2]);
  return [fit.x + p[0] * fit.scale * s, fit.y - p[1] * fit.scale * s];
}

/** Scales and centers the projection so the whole sculpture fills FRAME. */
function fitToFrame(frames) {
  fit = { scale: 1, x: 0, y: 0 };
  const pts = frames.flatMap((f) => [add(f.point, scale(f.across, f.width / 2)), sub(f.point, scale(f.across, f.width / 2))]).map(project);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(FRAME.width / (maxX - minX), FRAME.height / (maxY - minY));
  fit = {
    scale: k,
    x: FRAME.x + FRAME.width / 2 - ((minX + maxX) / 2) * k,
    y: FRAME.y + FRAME.height / 2 - ((minY + maxY) / 2) * k,
  };
}

function buildFrames() {
  const samples = Array.from({ length: SAMPLES + 1 }, (_, i) => spiral(i / SAMPLES));
  const points = samples.map((s) => toCamera(s.point));
  // Rotate the band direction into camera space (rotation only: subtract the transformed origin).
  const origin = toCamera([0, 0, 0]);
  return samples.map((sample, i) => {
    const tangent = normalize(sub(points[Math.min(i + 1, SAMPLES)], points[Math.max(i - 1, 0)]));
    const rawAcross = normalize(sub(toCamera(sample.across), origin));
    // Keep the band exactly perpendicular to the centerline.
    const across = normalize(sub(rawAcross, scale(tangent, dot(rawAcross, tangent))));
    const surfaceNormal = normalize(cross(tangent, across));
    const t = i / SAMPLES;
    const width = MAX_WIDTH * (0.16 + 0.84 * Math.pow(Math.sin(Math.PI * t), 0.55));
    return { point: points[i], across, surfaceNormal, width };
  });
}

// --- Shading -----------------------------------------------------------------

const VIEW = [0, 0, 1];

function faceOf(frame) {
  return dot(frame.surfaceNormal, VIEW) >= 0 ? "front" : "back";
}

/** Which edge's side wall faces the viewer (+1 or -1). */
function wallSideOf(frame) {
  return dot(frame.across, VIEW) >= 0 ? 1 : -1;
}

const runKey = (frame) => `${faceOf(frame)}:${wallSideOf(frame)}`;

function shade(frame, face, kind) {
  const n = face === "front" ? frame.surfaceNormal : scale(frame.surfaceNormal, -1);
  const colors = palette[face];
  const diffuse = Math.min(1, Math.max(0, dot(n, LIGHT)) + 0.35 * Math.max(0, dot(n, FILL)));
  const half = normalize(add(LIGHT, VIEW));
  const specular = Math.pow(Math.max(0, dot(n, half)), 14);
  const grazing = Math.pow(1 - Math.abs(dot(n, VIEW)), 2.2);
  let color = mix(colors.shade, colors.base, 0.42 + 0.58 * smooth(diffuse * 1.1));
  color = mix(color, colors.lit, smooth(diffuse - 0.35) * 0.85);
  color = mix(color, colors.sheen, Math.min(0.7, specular * 0.75 + grazing * 0.18));
  if (kind === "wall") color = mix(colors.shade, color, 0.45);
  return color;
}

function hex(color) {
  return `#${color.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

// --- Pieces ------------------------------------------------------------------

const round = (v) => Math.round(v * 10) / 10;
const pathFrom = (pts) => `M${pts.map(([x, y]) => `${round(x)} ${round(y)}`).join(" L")}Z`;

function gradientFor(frames, from, to, face, kind) {
  const start = project(frames[from].point);
  const end = project(frames[to].point);
  const axis = [end[0] - start[0], end[1] - start[1]];
  const lengthSq = axis[0] ** 2 + axis[1] ** 2 || 1;
  const stops = [from, Math.round((from + to) / 2), to].map((i) => {
    const p = project(frames[i].point);
    const offset = ((p[0] - start[0]) * axis[0] + (p[1] - start[1]) * axis[1]) / lengthSq;
    return [Math.round(Math.min(1, Math.max(0, offset)) * 100) / 100, hex(shade(frames[i], face, kind))];
  });
  stops.sort((a, b) => a[0] - b[0]);
  return { line: [round(start[0]), round(start[1]), round(end[0]), round(end[1])], stops };
}

function buildPieces(frames) {
  // Split into runs that show the same face, then into short pieces.
  const ranges = [];
  let runStart = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const flips = runKey(frames[i]) !== runKey(frames[runStart]);
    if (flips || i === SAMPLES) {
      const runEnd = flips ? i : SAMPLES;
      for (let a = runStart; a < runEnd; a += PIECE_LENGTH) ranges.push([a, Math.min(a + PIECE_LENGTH, runEnd)]);
      runStart = runEnd;
    }
  }

  const pieces = [];
  for (const [from, rawTo] of ranges) {
    const to = Math.min(rawTo + 1, SAMPLES); // overlap one segment to hide seams
    const face = faceOf(frames[Math.round((from + rawTo) / 2)]);
    const slice = frames.slice(from, to + 1);
    const depth = slice.reduce((sum, f) => sum + f.point[2], 0) / slice.length;

    const edgeA = slice.map((f) => project(add(f.point, scale(f.across, f.width / 2))));
    const edgeB = slice.map((f) => project(sub(f.point, scale(f.across, f.width / 2))));
    const surface = { kind: "surface", depth, d: pathFrom([...edgeA, ...edgeB.reverse()]), ...gradientFor(frames, from, to, face, "surface") };

    // Thickness: the side wall on whichever edge faces the viewer.
    const mid = frames[Math.round((from + to) / 2)];
    const side = wallSideOf(mid);
    const toward = face === "front" ? -1 : 1; // thickness extends away from the visible face
    const rim = slice.map((f) => add(f.point, scale(f.across, (side * f.width) / 2)));
    // Fade the wall in and out with how much it faces the viewer, so it never starts with a step.
    const rimInner = slice.map((f, k) => {
      const visible = smooth((Math.abs(dot(f.across, VIEW)) - 0.04) / 0.3);
      return add(rim[k], scale(f.surfaceNormal, toward * THICKNESS * visible));
    });
    const wall = {
      kind: "wall",
      depth: depth - 0.001,
      d: pathFrom([...rim.map(project), ...rimInner.map(project).reverse()]),
      ...gradientFor(frames, from, to, face, "wall"),
    };
    // Skip walls that are invisible along their whole length.
    if (slice.some((f) => Math.abs(dot(f.across, VIEW)) > 0.06)) pieces.push(wall);
    pieces.push(surface);
  }
  return pieces.sort((a, b) => a.depth - b.depth);
}

// --- Output ------------------------------------------------------------------

const frames = buildFrames();
fitToFrame(frames);
const pieces = buildPieces(frames);
const footprint = frames.map((f) => project(f.point));
const minX = Math.min(...footprint.map((p) => p[0]));
const maxX = Math.max(...footprint.map((p) => p[0]));
const maxY = Math.max(...footprint.map((p) => p[1]));

const lines = [
  "/* Generated by web/scripts/generate-hero-art.mjs. Do not edit by hand; change the script and re-run it. */",
  "",
  'export type RibbonPiece = {',
  '  /** "wall" pieces give the ribbon thickness; "surface" pieces are its faces. */',
  '  kind: "wall" | "surface";',
  "  d: string;",
  "  /** Gradient line x1, y1, x2, y2 in SVG user space. */",
  "  line: readonly [number, number, number, number];",
  "  stops: ReadonlyArray<readonly [offset: number, color: string]>;",
  "};",
  "",
  "/** Back-to-front drawing order. */",
  "export const ribbonPieces: readonly RibbonPiece[] = [",
  ...pieces.map(
    (p) =>
      `  { kind: "${p.kind}", d: "${p.d}", line: [${p.line.join(", ")}], stops: [${p.stops.map(([o, c]) => `[${o}, "${c}"]`).join(", ")}] },`,
  ),
  "];",
  "",
  `export const ribbonShadow = { cx: ${round((minX + maxX) / 2)}, cy: ${round(Math.min(492, maxY + 34))}, rx: ${round((maxX - minX) * 0.36)}, ry: 16 } as const;`,
  "",
];

const out = fileURLToPath(new URL("../src/components/welcome/hero-ribbon.ts", import.meta.url));
writeFileSync(out, lines.join("\n"));
console.log(`Wrote ${pieces.length} pieces to ${out}`);
