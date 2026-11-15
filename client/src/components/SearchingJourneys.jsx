import { useEffect, useState } from "react";

// Keyframes live here so tailwind.config.js stays untouched.
// Everything is disabled for users who prefer reduced motion.
const CSS = `
.jr-road{animation:jr-road .7s linear infinite}
.jr-bob{animation:jr-bob .55s ease-in-out infinite alternate}
.jr-spin{transform-box:fill-box;transform-origin:center;animation:jr-spin .6s linear infinite}
.jr-speed{animation:jr-speed .9s ease-out infinite}
.jr-pass{animation:jr-pass 3.6s linear infinite}
.jr-ping{transform-box:fill-box;transform-origin:center;animation:jr-ping 1.8s ease-out infinite}
.jr-sweepx{animation:jr-sx 2.6s ease-in-out infinite alternate}
.jr-sweepy{animation:jr-sy 1.3s ease-in-out infinite alternate}
.jr-twinkle{transform-box:fill-box;transform-origin:center;animation:jr-tw 1.6s ease-in-out infinite}
.jr-blob{transform-box:fill-box;transform-origin:center;animation:jr-bl 2.4s ease-in-out infinite alternate}
.jr-dot{display:inline-block;animation:jr-dot 1.2s ease-in-out infinite}
.jr-fade{animation:jr-fade .4s ease-out}
@keyframes jr-road{to{stroke-dashoffset:22}}
@keyframes jr-bob{to{transform:translateY(-1.5px)}}
@keyframes jr-spin{to{transform:rotate(360deg)}}
@keyframes jr-speed{0%{opacity:0;transform:translateX(8px)}30%{opacity:1}100%{opacity:0;transform:translateX(-14px)}}
@keyframes jr-pass{to{transform:translateX(-330px)}}
@keyframes jr-ping{0%{opacity:.6;transform:scale(.6)}100%{opacity:0;transform:scale(2.2)}}
@keyframes jr-sx{from{transform:translateX(-34px)}to{transform:translateX(34px)}}
@keyframes jr-sy{from{transform:translateY(-5px)}to{transform:translateY(5px)}}
@keyframes jr-tw{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}
@keyframes jr-bl{to{transform:scale(1.04)}}
@keyframes jr-dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
@keyframes jr-fade{from{opacity:0;transform:translateY(4px)}}
@media (prefers-reduced-motion:reduce){
.jr-road,.jr-bob,.jr-spin,.jr-speed,.jr-pass,.jr-ping,.jr-sweepx,.jr-sweepy,.jr-twinkle,.jr-blob,.jr-dot,.jr-fade{animation:none!important}
}
`;

const DEFAULT_MESSAGES = [
  "Checking routes",
  "Matching stops",
  "Almost there",
];

// Background scenery drifting past (drawn off-canvas at x=260; animation moves it across)
const Scenery = () => (
  <g className="stroke-accent-light/50 dark:stroke-accent/50">
    {/* tree */}
    <g className="jr-pass" style={{ animationDelay: "0s" }}>
      <path d="M260 132V108" fill="none" strokeWidth="3" />
      <circle cx="260" cy="100" r="9" strokeWidth="0" className="fill-accent-light/50 dark:fill-accent/50" />
    </g>
    {/* lamp post */}
    <g className="jr-pass" style={{ animationDelay: "-1.2s" }}>
      <path d="M260 132V96" fill="none" strokeWidth="3" />
      <rect x="254" y="90" width="12" height="7" rx="3" strokeWidth="0" className="fill-accent-light/50 dark:fill-accent/50" />
    </g>
    {/* tree */}
    <g className="jr-pass" style={{ animationDelay: "-2.4s" }}>
      <path d="M260 132V106" fill="none" strokeWidth="3" />
      <circle cx="260" cy="97" r="10" strokeWidth="0" className="fill-accent-light/50 dark:fill-accent/50" />
    </g>
  </g>
);

const Wheel = ({ cx }) => (
  <g>
    <circle cx={cx} cy="32" r="6" className="fill-primary dark:fill-surface" />
    <g className="jr-spin">
      <circle cx={cx} cy="32" r="3.2" className="fill-surface-white dark:fill-navy" />
      <path
        d={`M${cx} 29.4V34.6`}
        strokeWidth="1.6"
        className="stroke-primary dark:stroke-surface"
      />
    </g>
  </g>
);

export default function SearchingJourneys({
  title = "Searching for journeys",
  messages = DEFAULT_MESSAGES,
  className = "",
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      2200
    );
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center px-6 py-10 text-center font-inter ${className}`}
    >
      <style>{CSS}</style>

      <svg
        viewBox="0 0 240 160"
        className="h-auto w-full max-w-[230px]"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Breathing background */}
        <ellipse
          cx="120"
          cy="86"
          rx="94"
          ry="62"
          className="jr-blob fill-surface dark:fill-primary"
        />

        {/* Twinkles */}
        {[
          [48, 52, "0s"],
          [172, 38, "0.5s"],
          [30, 92, "1s"],
        ].map(([cx, cy, delay]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="2.5"
            className="jr-twinkle fill-primary-light"
            style={{ animationDelay: delay }}
          />
        ))}

        <Scenery />

        {/* Road + moving lane marks */}
        <path
          d="M0 140H240"
          fill="none"
          strokeWidth="12"
          className="stroke-surface-muted dark:stroke-white/10"
        />
        <path
          d="M0 142H240"
          fill="none"
          strokeWidth="2"
          strokeDasharray="11 11"
          className="jr-road stroke-surface-white dark:stroke-white/40"
        />

        {/* Destination stop with radar pings */}
        <circle
          cx="206"
          cy="72"
          r="16"
          fill="none"
          strokeWidth="2"
          className="jr-ping stroke-accent dark:stroke-accent-light"
        />
        <circle
          cx="206"
          cy="72"
          r="16"
          fill="none"
          strokeWidth="2"
          className="jr-ping stroke-accent dark:stroke-accent-light"
          style={{ animationDelay: "0.9s" }}
        />
        <path
          d="M206 134V86"
          fill="none"
          strokeWidth="4"
          className="stroke-primary dark:stroke-surface"
        />
        <rect
          x="188"
          y="58"
          width="36"
          height="28"
          rx="8"
          className="fill-primary dark:fill-surface"
        />
        <rect
          x="196"
          y="65"
          width="20"
          height="12"
          rx="3"
          fill="none"
          strokeWidth="2"
          className="stroke-white dark:stroke-primary"
        />
        <path
          d="M196 71h20"
          fill="none"
          strokeWidth="2"
          className="stroke-white dark:stroke-primary"
        />

        {/* Speed lines */}
        {[
          ["M52 108H34", "0s"],
          ["M56 118H28", "0.3s"],
          ["M52 128H38", "0.6s"],
        ].map(([d, delay]) => (
          <path
            key={d}
            d={d}
            fill="none"
            strokeWidth="3"
            className="jr-speed stroke-accent-light dark:stroke-accent"
            style={{ animationDelay: delay, opacity: 0 }}
          />
        ))}

        {/* Bus */}
        <g transform="translate(60 100)">
          <g className="jr-bob">
            <rect
              width="64"
              height="32"
              rx="10"
              className="fill-accent dark:fill-accent-light"
            />
            {[7, 25, 43].map((x) => (
              <rect
                key={x}
                x={x}
                y="7"
                width="14"
                height="11"
                rx="3"
                className="fill-surface-white dark:fill-navy"
              />
            ))}
            <Wheel cx={16} />
            <Wheel cx={48} />
          </g>
        </g>

        {/* Magnifier sweeping around, scanning */}
        <g className="jr-sweepx">
          <g className="jr-sweepy">
            <g transform="translate(110 46)">
              <circle
                r="13"
                strokeWidth="4"
                className="fill-surface-white/60 stroke-accent dark:fill-navy/60 dark:stroke-accent-light"
              />
              <path
                d="M-6 -4A7 7 0 0 1 -1 -9"
                fill="none"
                strokeWidth="2"
                className="stroke-accent-light dark:stroke-accent"
              />
              <path
                d="M10 10L20 20"
                fill="none"
                strokeWidth="5"
                className="stroke-accent dark:stroke-accent-light"
              />
            </g>
          </g>
        </g>
      </svg>

      <h3 className="mt-2 font-sora text-lg font-bold text-primary dark:text-white">
        {title}
        <span aria-hidden="true" className="ml-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="jr-dot"
              style={{ animationDelay: `${i * 0.18}s` }}
            >
              .
            </span>
          ))}
        </span>
      </h3>

      <p
        key={index}
        className="jr-fade mt-1.5 h-5 text-sm text-neutral dark:text-neutral-light"
      >
        {messages[index]}
      </p>
    </div>
  );
}