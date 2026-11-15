const CONTENT = {
  idle: {
    title: "Find your bus",
    description:
      "Pick where you’re starting and where you’re headed to see journeys.",
  },
  noResults: {
    title: "No journeys found",
    description: "Nothing matches this route. Try different stops.",
  },
};

// Bus stop: ground, pole and sign (shared by both variants)
const BusStop = () => (
  <>
    <path
      d="M36 132H204"
      fill="none"
      strokeWidth="3"
      className="stroke-surface-muted dark:stroke-white/20"
    />
    <path
      d="M156 132V54"
      fill="none"
      strokeWidth="4"
      className="stroke-primary dark:stroke-surface"
    />
    <rect
      x="138"
      y="30"
      width="36"
      height="28"
      rx="8"
      className="fill-primary dark:fill-surface"
    />
    <rect
      x="146"
      y="37"
      width="20"
      height="12"
      rx="3"
      fill="none"
      strokeWidth="2"
      className="stroke-white dark:stroke-primary"
    />
    <path
      d="M146 43h20"
      fill="none"
      strokeWidth="2"
      className="stroke-white dark:stroke-primary"
    />
  </>
);

// Bus pulling in (idle state)
const Bus = () => (
  <>
    <g transform="translate(40 100)">
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
      {[16, 48].map((cx) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy="32"
            r="6"
            className="fill-primary dark:fill-surface"
          />
          <circle
            cx={cx}
            cy="32"
            r="2"
            className="fill-surface-white dark:fill-navy"
          />
        </g>
      ))}
    </g>
    <path
      d="M30 106H18M34 118H12M30 129H20"
      fill="none"
      strokeWidth="3"
      className="stroke-accent-light dark:stroke-accent"
    />
  </>
);

// Missing bus (no-results state): dotted outline + amber "?"
const MissingBus = () => (
  <>
    <rect
      x="40"
      y="100"
      width="64"
      height="32"
      rx="10"
      fill="none"
      strokeWidth="3"
      strokeDasharray="1 7"
      opacity="0.7"
      className="stroke-accent-light dark:stroke-accent"
    />
    <circle cx="184" cy="34" r="11" className="fill-primary-light" />
    <text
      x="184"
      y="39"
      textAnchor="middle"
      fontSize="14"
      fontWeight="700"
      className="fill-primary-dark font-sora"
    >
      ?
    </text>
  </>
);

export default function EmptyJourneys({
  variant = "idle", // "idle" | "noResults"
  title,
  description,
  className = "",
  children, // optional action, e.g. a button
}) {
  const content = CONTENT[variant] ?? CONTENT.idle;

  return (
    <div
      className={`flex flex-col items-center px-6 py-10 text-center font-inter ${className}`}
    >
      <svg
        viewBox="0 0 240 160"
        className="h-auto w-full max-w-[230px]"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <ellipse
          cx="120"
          cy="86"
          rx="94"
          ry="62"
          className="fill-primary"
        />
        <BusStop />
        {variant === "noResults" ? <MissingBus /> : <Bus />}
      </svg>

      <h3 className="mt-2 font-sora text-lg font-bold text-primary dark:text-white">
        {title ?? content.title}
      </h3>
      <p className="mt-1.5 max-w-[250px] text-sm leading-relaxed text-neutral dark:text-neutral-light">
        {description ?? content.description}
      </p>

      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
