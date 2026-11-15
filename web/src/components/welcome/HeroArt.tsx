import { branchRibbon, lowRibbon, mainCenterline, mainRibbon, type RibbonFace } from "./hero-art-paths";

/**
 * Original abstract hero artwork: three translucent, gently twisting ribbons
 * that branch from one point and rise toward the upper right (one person's
 * experience opening into several paths). Pure SVG with static path data, so
 * no images or libraries are needed. It's decorative only, and the CSS
 * animation classes from globals.css switch off under `prefers-reduced-motion`.
 */
export function HeroArt() {
  return (
    <svg viewBox="0 0 560 500" aria-hidden="true" focusable="false" className="h-auto w-full overflow-visible">
      <defs>
        <radialGradient id="sm-hero-glow" cx="0.56" cy="0.46" r="0.5">
          <stop offset="0" stopColor="#e2e3ff" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#eef0ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f8f9fc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sm-front" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#dcdcff" stopOpacity="0.75" />
          <stop offset="0.55" stopColor="#a9a6f7" stopOpacity="0.85" />
          <stop offset="1" stopColor="#7b77ec" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="sm-back" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8e8bf0" stopOpacity="0.8" />
          <stop offset="1" stopColor="#4f4cc8" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="sm-front-violet" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#e6dcff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#b79cf5" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="sm-back-violet" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#a58cf0" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7d5ce0" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="sm-front-low" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9ccff" stopOpacity="0.9" />
          <stop offset="0.75" stopColor="#b3baf3" stopOpacity="0.7" />
          <stop offset="1" stopColor="#c4c9f7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sm-back-low" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9fa6ef" stopOpacity="0.7" />
          <stop offset="1" stopColor="#9fa6ef" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ambient light and quiet orbit lines */}
      <circle cx="320" cy="240" r="250" fill="url(#sm-hero-glow)" />
      <g fill="none" stroke="#d9dce8" strokeWidth="1" strokeDasharray="2 8">
        <circle cx="320" cy="240" r="130" />
        <circle cx="320" cy="240" r="205" opacity="0.7" />
      </g>

      <g className="sm-float">
        <g className="sm-drift">
          <Ribbon faces={lowRibbon} front="sm-front-low" back="sm-back-low" />
        </g>
        <Ribbon faces={branchRibbon} front="sm-front-violet" back="sm-back-violet" />
        <Ribbon faces={mainRibbon} front="sm-front" back="sm-back" />

        {/* A faint dotted trail of progress along the main ribbon */}
        <path
          className="sm-trace"
          d={mainCenterline}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.7"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="0.1 11"
        />

        {/* Milestones: start, the branching point, and two destinations */}
        <circle cx="40" cy="430" r="7" fill="#ffffff" stroke="#8f8cf2" strokeWidth="2.5" />
        <circle cx="282" cy="302" r="6.5" fill="#ffffff" stroke="#6f6ce0" strokeWidth="2.5" />
        <circle cx="500" cy="58" r="5" fill="#ffffff" stroke="#9b7ef0" strokeWidth="2" />
        <circle cx="522" cy="100" r="18" fill="#5856d6" fillOpacity="0.12" />
        <circle cx="522" cy="100" r="8.5" fill="#5856d6" stroke="#ffffff" strokeWidth="3" />
      </g>

      {/* Scattered possibilities */}
      <g className="sm-drift" fill="#b4b2ff">
        <circle cx="430" cy="30" r="3" opacity="0.7" />
        <circle cx="160" cy="210" r="2.5" opacity="0.55" />
        <circle cx="530" cy="380" r="3" opacity="0.5" />
        <circle cx="90" cy="320" r="2" opacity="0.55" />
      </g>
    </svg>
  );
}

function Ribbon({ faces, front, back }: { faces: RibbonFace[]; front: string; back: string }) {
  return (
    <g stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.75" strokeLinejoin="round">
      {faces.map((piece, index) => (
        <path key={index} d={piece.d} fill={`url(#${piece.face === "front" ? front : back})`} />
      ))}
    </g>
  );
}
