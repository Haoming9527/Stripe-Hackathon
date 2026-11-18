export function CommunityGradient() {
  return (
    <div className="entry-gradient" aria-hidden="true">
      <svg
        className="gradient-art"
        viewBox="0 0 1000 680"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <path
            id="community-ink-edge"
            d="M-72-74 C215-30 565 43 804 237 C936 344 1012 487 1150 659 V-160 H-72Z"
          />
          <clipPath id="community-arc" clipPathUnits="objectBoundingBox">
            <path
              className="gradient-outer-arc"
              d="M-.15-.088 C.13-.012 .548.099 .801.44 C.917.596 .995.812 1.052 1.06 L1.2 1.12 V-.18 H-.15Z"
            />
          </clipPath>
          <linearGradient
            id="community-ground"
            gradientUnits="userSpaceOnUse"
            x1="150"
            y1="0"
            x2="925"
            y2="460"
          >
            <stop stopColor="#fc9378" />
            <stop offset=".3" stopColor="#fbbbd9" />
            <stop offset=".57" stopColor="#f9bff6" />
            <stop offset=".84" stopColor="#fab2f1" />
            <stop offset="1" stopColor="#fa8eda" />
          </linearGradient>
          <linearGradient
            id="community-ink"
            gradientUnits="userSpaceOnUse"
            x1="334"
            y1="0"
            x2="995"
            y2="155"
          >
            <stop stopColor="#f46352" />
            <stop offset=".16" stopColor="#f8666d" />
            <stop offset=".32" stopColor="#f05fad" />
            <stop offset=".46" stopColor="#d74add" />
            <stop offset=".62" stopColor="#7a2ada" />
            <stop offset=".77" stopColor="#5026d4" />
            <stop offset=".89" stopColor="#4f20c6" />
            <stop offset="1" stopColor="#7025c6" />
          </linearGradient>
          <radialGradient
            id="community-light"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1013 267) rotate(39) scale(360 75)"
          >
            <stop stopColor="#e38dee" stopOpacity=".94" />
            <stop offset=".17" stopColor="#c65be2" stopOpacity=".91" />
            <stop offset=".53" stopColor="#a336d4" stopOpacity=".58" />
            <stop offset="1" stopColor="#8c27c5" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="community-orchid"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(1030 453) rotate(37) scale(456 195)"
          >
            <stop stopColor="#c65ee7" />
            <stop offset=".48" stopColor="#b044d8" stopOpacity=".87" />
            <stop offset="1" stopColor="#8e2dcb" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="community-plum"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(936 -65) rotate(11) scale(390 155)"
          >
            <stop stopColor="#4925cf" />
            <stop offset="1" stopColor="#521fc1" stopOpacity="0" />
          </radialGradient>
          <filter id="community-brush" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".012 .37"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <pattern
            id="community-grain"
            width="240"
            height="120"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(29)"
          >
            <rect width="240" height="120" filter="url(#community-brush)" />
          </pattern>
        </defs>
        <g>
          <rect
            x="-160"
            y="-120"
            width="1400"
            height="940"
            fill="url(#community-ground)"
          />
          <g className="gradient-violet">
            <use href="#community-ink-edge" fill="url(#community-ink)" />
          </g>
          <g className="gradient-orchid">
            <rect
              x="110"
              y="-160"
              width="1190"
              height="1000"
              fill="url(#community-plum)"
            />
            <rect
              x="110"
              y="-160"
              width="1190"
              height="1000"
              fill="url(#community-orchid)"
            />
            <path
              d="M132-142 C515-52 744 148 1007 288 Q1116 345 1280 397 V-180 H132Z"
              fill="url(#community-light)"
            />
          </g>
        </g>
      </svg>
      <svg
        className="gradient-overlap"
        viewBox="-370 -105 610 297"
        focusable="false"
      >
        <defs>
          <radialGradient
            id="community-violet-shade"
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="rotate(18) scale(157 76)"
          >
            <stop stopColor="#4723bb" stopOpacity=".93" />
            <stop offset=".32" stopColor="#5024c0" stopOpacity=".84" />
            <stop offset="1" stopColor="#5826bb" stopOpacity="0" />
          </radialGradient>
          <path
            id="community-orchid-edge"
            d="M-740-117 C-590-43 -389-28 -260-26 C-142-24 -69-28 0 0 C72 29 132 98 260 120 V-260 H-740Z"
          />
          <linearGradient
            id="community-overlap-ink"
            gradientUnits="userSpaceOnUse"
            x1="-360"
            y1="-56"
            x2="123"
            y2="46"
          >
            <stop stopColor="#a936d2" stopOpacity="0" />
            <stop offset=".24" stopColor="#9e35d4" stopOpacity=".16" />
            <stop offset=".5" stopColor="#9130cd" stopOpacity=".76" />
            <stop offset=".76" stopColor="#8c27c5" />
            <stop offset="1" stopColor="#b346e0" />
          </linearGradient>
          <radialGradient
            id="community-orchid-glint"
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(56 27) rotate(27) scale(222 19)"
          >
            <stop stopColor="#e392f4" />
            <stop offset=".4" stopColor="#c465e5" stopOpacity=".88" />
            <stop offset="1" stopColor="#ad3bdd" stopOpacity="0" />
          </radialGradient>
          <radialGradient
            id="community-orchid-shade"
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="1"
            gradientTransform="translate(0 5) rotate(21) scale(111 39)"
          >
            <stop stopColor="#992a9e" />
            <stop offset=".45" stopColor="#9d309f" />
            <stop offset=".72" stopColor="#a638b9" stopOpacity=".68" />
            <stop offset="1" stopColor="#b541dc" stopOpacity="0" />
          </radialGradient>
          <pattern
            id="community-orchid-grain"
            href="#community-grain"
            patternTransform="rotate(14) scale(.81 1.1)"
          />
        </defs>
        <rect
          x="-200"
          y="-110"
          width="400"
          height="220"
          fill="url(#community-violet-shade)"
        />
        <g className="gradient-overlap-edge">
          <use
            href="#community-orchid-edge"
            fill="url(#community-overlap-ink)"
          />
          <use href="#community-orchid-edge" fill="url(#community-orchid-glint)" />
          <use
            href="#community-orchid-edge"
            fill="url(#community-orchid-shade)"
          />
          <use
            href="#community-orchid-edge"
            fill="url(#community-orchid-grain)"
            opacity=".095"
          />
        </g>
      </svg>
      <svg
        className="gradient-finish"
        viewBox="0 0 1000 680"
        preserveAspectRatio="none"
        focusable="false"
      >
        <rect
          width="1000"
          height="680"
          fill="url(#community-grain)"
          opacity=".13"
        />
      </svg>
    </div>
  );
}
