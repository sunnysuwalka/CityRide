import { LuBus, LuClock } from "react-icons/lu";

// Notch geometry: header is h-12 (48px) + 2px dashed divider -> notch centre at 49px
const NOTCH_RADIUS = 11;
const NOTCH_Y = 49;

const notchMask = `radial-gradient(circle ${NOTCH_RADIUS}px at 0 ${NOTCH_Y}px, #0000 98%, #000), radial-gradient(circle ${NOTCH_RADIUS}px at 100% ${NOTCH_Y}px, #0000 98%, #000)`;

const maskStyle = {
  WebkitMask: notchMask,
  WebkitMaskComposite: "source-in",
  mask: notchMask,
  maskComposite: "intersect",
};

export default function JourneyCard({
  headsign,
  tripId,
  from,
  to,
  departureTime,
  arrivalTime,
  duration,
  onClick,
  className = "",
}) {


  return (
    // Wrapper carries the shadow: box-shadow would be clipped by the notch mask
    <div
      onClick={onClick}
      className={`w-full drop-shadow-[0_4px_20px_rgba(11,45,107,0.10)]  ${className} opacity-90`}
    >
      <article
        className="overflow-hidden bg-surface-white font-inter text-primary dark:text-white rounded-md"
      >
        {/* Header band */}
        <header className="flex h-fit py-2 items-center justify-between gap-3 px-4 bg-primary text-white sm:px-5 ">
          <h3 className="flex items-center gap-2 font-sora text-sm">
            <LuBus className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="">{headsign}</span>
          </h3>
          <span className="shrink-0 text-2xs font-medium tabular-nums tracking-wide text-white/70">
            {tripId}
          </span>
        </header>

        {/* Perforation */}
        <div className="border-t-2 border-dashed border-neutral-border dark:border-white/15" />

        {/* Journey row */}
        <div className="grid bg-surface-white border border-t-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 pb-5 pt-4 sm:gap-3 sm:px-5">
          {/* Departure */}
          <div className="min-w-0">
            <p className="font-inter text-primary text-lg leading-none tabular-nums sm:text-2xl">
              {departureTime}
            </p>
            <p className="mt-1.5 break-words text-xs text-primary-dark/80 sm:text-sm ">
              {from}
            </p>
          </div>

          {/* Duration + connector */}
          <div className="flex min-w-16 flex-col items-center gap-1.5 sm:min-w-20">
            <span className="inline-flex text-primary items-center gap-1 whitespace-nowrap rounded-pill bg-surface-muted px-2 py-1 text-2xs font-semibold sm:px-2.5 sm:text-xs">
              <LuClock className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
              {duration}
            </span>
            <span className="h-px w-full bg-primary-light" />
          </div>

          {/* Arrival */}
          <div className="min-w-0 text-right">
            <p className="font-inter text-primary text-lg leading-none tabular-nums ">
              {arrivalTime}
            </p>
            <p className="mt-1.5 break-words text-xs text-primary-dark/80 sm:text-sm">
              {to}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}