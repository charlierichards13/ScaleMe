import { ribbonPieces, ribbonShadow } from "./hero-ribbon";

/**
 * Original hero sculpture: one continuous satin ribbon that sweeps in from
 * the lower left, curls once around itself, and rises to the upper right,
 * i.e. experience folding back on itself and opening into growth.
 *
 * The 3D form (centerline, twist, thickness, lighting, perspective) is baked
 * into static SVG pieces by `web/scripts/generate-hero-art.mjs`. Each piece is
 * one path with its own shading gradient, drawn back-to-front so the folds
 * overlap correctly. There's no canvas, WebGL or runtime geometry, so server
 * and client render identical markup.
 *
 * Decorative only. Motion (a slow float plus a faint travelling highlight)
 * comes from globals.css and is off under `prefers-reduced-motion`.
 */
export function HeroArt() {
  const surfaces = ribbonPieces.flatMap((piece, index) => (piece.kind === "surface" ? [index] : []));

  return (
    <svg viewBox="0 0 560 500" aria-hidden="true" focusable="false" className="h-auto w-full overflow-visible">
      <defs>
        <radialGradient id="smr-ambient" cx="0.55" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#e6e4ff" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#eef0ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#f8f9fc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="smr-shadow">
          <stop offset="0" stopColor="#3f3a8f" stopOpacity="0.2" />
          <stop offset="0.55" stopColor="#5856d6" stopOpacity="0.07" />
          <stop offset="1" stopColor="#5856d6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="smr-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.38" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="0.62" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {ribbonPieces.map((piece, index) => (
          <linearGradient
            key={index}
            id={`smr-g${index}`}
            gradientUnits="userSpaceOnUse"
            x1={piece.line[0]}
            y1={piece.line[1]}
            x2={piece.line[2]}
            y2={piece.line[3]}
          >
            {piece.stops.map(([offset, color], stop) => (
              <stop key={stop} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
        ))}
        {surfaces.map((index) => (
          <path key={index} id={`smr-p${index}`} d={ribbonPieces[index].d} />
        ))}
        <clipPath id="smr-faces">
          {surfaces.map((index) => (
            <use key={index} href={`#smr-p${index}`} />
          ))}
        </clipPath>
      </defs>

      <circle cx="300" cy="235" r="245" fill="url(#smr-ambient)" />
      <ellipse className="sm-shadow" {...ribbonShadow} fill="url(#smr-shadow)" />

      <g className="sm-float">
        {ribbonPieces.map((piece, index) =>
          piece.kind === "surface" ? (
            <use key={index} href={`#smr-p${index}`} fill={`url(#smr-g${index})`} />
          ) : (
            <path key={index} d={piece.d} fill={`url(#smr-g${index})`} />
          ),
        )}

        {/* Faint satin highlight that drifts slowly across the faces */}
        <g clipPath="url(#smr-faces)">
          <g transform="rotate(-24 280 250)">
            <rect className="sm-sheen" x="-260" y="-60" width="560" height="620" fill="url(#smr-sheen)" />
          </g>
        </g>
      </g>
    </svg>
  );
}
