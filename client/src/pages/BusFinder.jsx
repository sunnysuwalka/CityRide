import React, { useState, useEffect } from "react";
import axios from "axios";

import JourneyCard from "../components/JourneyCard";
import SearchingJourneys from "../components/SearchingJourneys";
import EmptyJourneys from "../components/EmptyJourneys";

import {
    ArrowLeft,
    ArrowLeftRight,
    ArrowRight
} from "lucide-react";

import MapView from "../components/MapView";

// Timeline colours (change these to restyle the timeline)
const BOARDING_COLOR = "#16a34a";    // green
const DESTINATION_COLOR = "#dc2626"; // red
const INACTIVE_COLOR = "#a3a3a3";    // grey

// Remove a trailing "(Demo Stop)" from any stop name
const cleanStopName = (name) =>
    typeof name === "string"
        ? name.replace(/\s*\(\s*demo stop\s*\)\s*$/i, "").trim()
        : name;

const BusFinder = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [Boarding, setBoarding] = useState("");
    const [Destination, setDestination] = useState("");

    const [journeyDate, setJourneyDate] = useState(() => {
        const today = new Date();

        return [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0")
        ].join("-");
    });

    const [Time, setTime] = useState("");

    const [Stops, setStops] = useState([]);
    const [AvailableTrips, setAvailableTrips] = useState(null);

    const [suggestions, setSuggestions] = useState(null);
    const [step, setStep] = useState("search");
    const [selectedTrip, setSelectedTrip] = useState(null);

    // Stop ids used for the current search (used to mark the timeline)
    const [searchedBoardingId, setSearchedBoardingId] = useState(null);
    const [searchedDestinationId, setSearchedDestinationId] = useState(null);

    const API_BASE =
        import.meta.env.VITE_BASE_URL ||
        "http://localhost:5001/api/v1";

    // Load all stops
    useEffect(() => {
        const loadStops = async () => {
            try {
                const response = await axios.get(`${API_BASE}/stops`);
                const result = response.data;

                if (
                    !result?.success ||
                    !Array.isArray(result?.data?.stops)
                ) {
                    throw new Error(
                        result?.message ||
                        "Invalid stops response from server"
                    );
                }

                setStops(result.data.stops);
                setError("");
            } catch (err) {
                console.error("Error fetching stop data:", err);

                setError(
                    err.response?.data?.message ||
                    err.message ||
                    "Unable to load stops. Please refresh the page."
                );
            }
        };

        loadStops();
    }, [API_BASE]);

    // Swap pickup and destination
    const SwapValues = () => {
        setBoarding(Destination);
        setDestination(Boarding);
        setSuggestions(null);
        setError("");
    };

    // Format duration
    const formatDuration = (seconds) => {
        if (
            seconds === null ||
            seconds === undefined ||
            !Number.isFinite(Number(seconds))
        ) {
            return "--:--";
        }

        const totalSeconds = Math.max(0, Number(seconds));

        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);

        const pad = (num) => String(num).padStart(2, "0");

        return hrs > 0
            ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
            : `${pad(mins)}:${pad(secs)}`;
    };

        // Search journeys (optionally with explicit stop names)
    const SearchJourney = async (
        fromName = Boarding,
        toName = Destination
    ) => {
        const boardingName = cleanStopName(fromName);
        const destinationName = cleanStopName(toName);

        if (!boardingName || !destinationName) {
            setError("Please enter both pickup and destination.");
            return;
        }

        if (boardingName === destinationName) {
            setError(
                "Boarding and destination stops cannot be the same."
            );
            setNotice("Retry");
            return;
        }

        if (!journeyDate) {
            setError("Please select your journey date.");
            return;
        }

        const boardingStop = Stops.find(
            item => cleanStopName(item.stop_name) === boardingName
        );

        const destinationStop = Stops.find(
            item => cleanStopName(item.stop_name) === destinationName
        );

        const BoardingCode = boardingStop?.stop_id;
        const DestinationCode = destinationStop?.stop_id;

        if (!BoardingCode || !DestinationCode) {
            setError(
                "Please select valid boarding and destination stops from the suggestions."
            );
            return;
        }

        setError("");
        setNotice("");
        setAvailableTrips(null);
        setSelectedTrip(null);
        setSearchedBoardingId(BoardingCode);
        setSearchedDestinationId(DestinationCode);
        setIsLoading(true);
        setStep("results");

        try {
            const response = await axios.get(
                `${API_BASE}/journeys/search`,
                {
                    params: {
                        fromStopId: BoardingCode,
                        toStopId: DestinationCode,
                        date: journeyDate,
                        after: Time || undefined
                    }
                }
            );

            console.log("Journey Results:", response.data);

            const journeys = response?.data?.data?.journeys;

            if (!Array.isArray(journeys)) {
                setAvailableTrips([]);
                setError(
                    "Something went wrong on our end. Please try again in a moment."
                );
                return;
            }

            setAvailableTrips(journeys);
        } catch (err) {
            console.error("Journey search failed:", err);

            setAvailableTrips([]);

            setError(
                err.response?.data?.message ||
                "Unable to fetch journeys. Please try again."
            );
        } finally {
            setIsLoading(false);
        }
    };

    // Filter stop suggestions
    const filterStops = (stops, searchValue) => {
        const search = cleanStopName(searchValue)?.toLowerCase();

        if (!search) return [];

        return stops
            .filter(item =>
                cleanStopName(item.stop_name)
                    ?.toLowerCase()
                    .includes(search)
            )
            .sort((a, b) => {
                const aStarts = cleanStopName(a.stop_name)
                    ?.toLowerCase()
                    .startsWith(search);

                const bStarts = cleanStopName(b.stop_name)
                    ?.toLowerCase()
                    .startsWith(search);

                return Number(bStarts) - Number(aStarts);
            });
    };

    const filteredBoardingStops = filterStops(Stops, Boarding);
    const filteredDestinationStops = filterStops(Stops, Destination);

    // Popular routes
    const DirectSuggestions = [
        {
            from: "Bhilwara Railway Station",
            to: "Subhash Nagar East",
            fromvalue: "Bhilwara Railway Station",
            tovalue: "Subhash Nagar East ()"

        },
        {
            from: "Roadways Bus Stand",
            to: "Shastri Nagar",
            fromvalue: "Roadways Bus Stand, Bhilwara",
            tovalue: "Shastri Nagar South Junction ()"
            
        }
    ];

    // Select popular route and search immediately
    const selectPopularRoute = (from, to) => {
        setBoarding(from);
        setDestination(to);
        setSuggestions(null);
        setError("");
        SearchJourney(from, to);   // pass the names directly
    };

    // Open trip details
    const openTripDetails = (trip) => {
        setSelectedTrip(trip);
        setStep("detail");
    };

    // Get stop time
    const getStopTime = (stop) => {
        return (
            stop.departureTime ||
            stop.arrivalTime ||
            "Time unavailable"
        );
    };

    // Find where the boarding and destination stops sit in a trip's stop list
    const getJourneyIndexes = (stops = []) => {
        const sameId = (a, b) =>
            a !== null &&
            a !== undefined &&
            b !== null &&
            b !== undefined &&
            String(a) === String(b);

        const sameName = (a, b) =>
            !!a &&
            !!b &&
            cleanStopName(a).toLowerCase() === cleanStopName(b).toLowerCase();

        let boardingIndex = stops.findIndex(s =>
            sameId(s.stopId, searchedBoardingId)
        );

        if (boardingIndex === -1) {
            boardingIndex = stops.findIndex(s =>
                sameName(s.stopName, Boarding)
            );
        }

        // Destination must come after the boarding stop
        const searchFrom = boardingIndex === -1 ? 0 : boardingIndex + 1;

        let destinationIndex = -1;

        for (let i = searchFrom; i < stops.length; i++) {
            if (
                sameId(stops[i].stopId, searchedDestinationId) ||
                (searchedDestinationId == null &&
                    sameName(stops[i].stopName, Destination))
            ) {
                destinationIndex = i;
                break;
            }
        }

        if (destinationIndex === -1) {
            for (let i = searchFrom; i < stops.length; i++) {
                if (sameName(stops[i].stopName, Destination)) {
                    destinationIndex = i;
                    break;
                }
            }
        }

        return { boardingIndex, destinationIndex };
    };

    // Get timeline styling for each stop
    const getTimelineStyles = (index, stops, boardingIndex, destinationIndex) => {
        const isBoarding = index === boardingIndex;
        const isDestination = index === destinationIndex;
        const isLast = index === stops.length - 1;

        // The line below a stop is solid only between boarding and destination
        const isSolid =
            boardingIndex !== -1 &&
            destinationIndex !== -1 &&
            index >= boardingIndex &&
            index < destinationIndex;

        const connectorStyle = isLast
            ? { borderLeftColor: "transparent", borderLeftStyle: "solid" }
            : {
                  borderLeftStyle: isSolid ? "solid" : "dashed",
                  borderLeftColor: isSolid ? BOARDING_COLOR : INACTIVE_COLOR
              };

        let circleStyle = {
            backgroundColor: "transparent",
            borderColor: INACTIVE_COLOR
        };

        if (isBoarding) {
            circleStyle = {
                backgroundColor: BOARDING_COLOR,
                borderColor: BOARDING_COLOR
            };
        } else if (isDestination) {
            circleStyle = {
                backgroundColor: DESTINATION_COLOR,
                borderColor: DESTINATION_COLOR
            };
        }

        return {
            isBoarding,
            isDestination,
            isLast,
            connectorStyle,
            circleStyle
        };
    };

    // Indexes for the currently opened trip
    const { boardingIndex, destinationIndex } = getJourneyIndexes(
        selectedTrip?.stops || []
    );

    return (
        <main className="grid grid-cols-1 lg:grid-cols-2 px-4 gap-4">

            <div>
                {step === "search" ? (
                    <>
                        <div className="p-3 pt-6">
                            <div className="mt-4 font-semibold font-inter text-black text-[2.5rem] leading-none">
                                Which bus gets you <br /> there?
                            </div>

                            <p className="font-inter text-sm pt-2 text-neutral mt-3">
                                Choose where you start and where you are going
                                to see direct demo routes, every stop and the
                                scheduled times.
                            </p>

                            {/* Booking Box */}
                            <div className="h-fit bg-surface-white px-3 py-10 border rounded-xl flex flex-col gap-6 mt-3">

                                {/* Stop Selectors */}
                                <div className="relative flex items-center gap-2 justify-between">

                                    {/* Boarding */}
                                    <div className="w-full">
                                        <label
                                            htmlFor="boarding"
                                            className="block text-xs font-inter text-neutral pl-1"
                                        >
                                            From
                                        </label>

                                        <input
                                            id="boarding"
                                            value={Boarding}
                                            onChange={(e) => {
                                                setBoarding(e.target.value);
                                                setSuggestions(
                                                    e.target.value
                                                        ? "boarding"
                                                        : null
                                                );
                                            }}
                                            onFocus={() => {
                                                if (Boarding) {
                                                    setSuggestions("boarding");
                                                }
                                            }}
                                            name="boarding"
                                            placeholder="Select Start Stop"
                                            autoComplete="off"
                                            className="w-full appearance-none px-3 py-2 border border-primary rounded-md outline-none focus:outline-none font-inter placeholder:font-inter placeholder:text-black"
                                            type="text"
                                        />
                                    </div>

                                    {/* Swap */}
                                    <button
                                        type="button"
                                        onClick={SwapValues}
                                        className="border-[1px] border-primary text-primary h-fit mt-3 p-2 rounded-md font-extralight"
                                    >
                                        <ArrowLeftRight size={16} />
                                    </button>

                                    {/* Destination */}
                                    <div className="w-full">
                                        <label
                                            htmlFor="destination"
                                            className="block text-xs font-inter text-neutral pl-1"
                                        >
                                            To
                                        </label>

                                        <input
                                            id="destination"
                                            value={Destination}
                                            onChange={(e) => {
                                                setDestination(e.target.value);
                                                setSuggestions(
                                                    e.target.value
                                                        ? "destination"
                                                        : null
                                                );
                                            }}
                                            onFocus={() => {
                                                if (Destination) {
                                                    setSuggestions("destination");
                                                }
                                            }}
                                            name="destination"
                                            placeholder="Select Destination Stop"
                                            autoComplete="off"
                                            className="w-full appearance-none px-3 py-2 border border-primary rounded-md outline-none focus:outline-none font-inter placeholder:font-inter placeholder:text-black"
                                            type="text"
                                        />
                                    </div>

                                    {/* Suggestions */}
                                    {suggestions && (
                                        <div className="absolute z-50 bg-surface left-0 w-full top-18 h-[30vh] p-3 pt-1 rounded-lg border border-neutral-border overflow-y-auto">

                                            {(suggestions === "boarding"
                                                ? filteredBoardingStops
                                                : filteredDestinationStops
                                            ).map((item) => (
                                                <button
                                                    type="button"
                                                    key={item.stop_id}
                                                    onClick={() => {
                                                        const name = cleanStopName(
                                                            item.stop_name
                                                        );

                                                        if (suggestions === "boarding") {
                                                            setBoarding(name);
                                                        } else {
                                                            setDestination(name);
                                                        }

                                                        setSuggestions(null);
                                                    }}
                                                    className="block w-full text-left my-3 px-2 py-1 rounded-md hover:border border-primary hover:translate-x-1 font-inter text-neutral transition-all ease-in"
                                                >
                                                    {cleanStopName(item.stop_name)}
                                                </button>
                                            ))}

                                            {(suggestions === "boarding"
                                                ? filteredBoardingStops
                                                : filteredDestinationStops
                                            ).length === 0 && (
                                                <p className="text-sm text-neutral p-2">
                                                    No matching stops found.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Date and Search */}
                                <div className="flex items-center gap-3">

                                    <div className="w-full">
                                        <label
                                            htmlFor="date"
                                            className="block text-xs font-inter text-neutral pl-1"
                                        >
                                            Date
                                        </label>

                                        <input
                                            id="date"
                                            name="date"
                                            value={journeyDate}
                                            onChange={(e) =>
                                                setJourneyDate(e.target.value)
                                            }
                                            className="w-full appearance-none px-3 py-2 border border-primary rounded-md outline-none focus:outline-none font-inter placeholder:font-inter"
                                            type="date"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={()=>SearchJourney()}
                                        disabled={isLoading || Stops.length === 0}
                                        className="w-full bg-primary font-semibold text-surface-white px-4 py-3 rounded-md self-end disabled:opacity-50"
                                    >
                                        {isLoading ? "Searching..." : "Search Buses"}
                                    </button>
                                </div>

                                {error && (
                                    <p className="font-inter text-alert-error text-sm leading-normal">
                                        {error}
                                    </p>
                                )}

                                {notice && (
                                    <p className="font-inter text-sm text-neutral">
                                        {notice}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Popular Routes */}
                        <div>
                            <div className="text-neutral-light font-semibold text-xs font-inter mb-1">
                                Try the popular routes
                            </div>

                            {DirectSuggestions.map((item, key) => (
                                <button
                                    type="button"
                                    key={key}
                                    onClick={() =>
                                        selectPopularRoute(item.fromvalue, item.tovalue)
                                    }
                                    className="mx-1 items-center gap-1 text-xs font-inter text-neutral bg-surface border border-neutral rounded-full px-3 py-1"
                                >
                                    {item.from}
                                    <ArrowRight className="inline" size={12} />
                                    {item.to}
                                </button>
                            ))}
                        </div>
                    </>
                ) : step === "results" ? (
                    <div className="h-[85vh] flex flex-col overflow-hidden">

                        <div className="w-full flex justify-between items-center py-2">
                            <button
                                type="button"
                                onClick={() => setStep("search")}
                                className="shrink-0 font-inter text-primary text-xs flex items-center gap-1 underline underline-offset-2"
                            >
                                <ArrowLeft size={12} /> Back
                            </button>

                            <div className="text-xs font-inter text-neutral pr-2">
                                {cleanStopName(Boarding)} to{" "}
                                {cleanStopName(Destination)} •{" "}
                                {AvailableTrips?.length ?? 0} Trips Found
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="pt-20">
                                <SearchingJourneys />
                            </div>
                        ) : error ? (
                            <div className="pt-10">
                                <p className="text-alert-error text-sm">
                                    {error}
                                </p>
                            </div>
                        ) : AvailableTrips?.length === 0 ? (
                            <div className="pt-20">
                                <EmptyJourneys variant="noResults" />
                            </div>
                        ) : (
                            <div className="p-3 px-8 mt-1 flex flex-col gap-6 min-h-0 overflow-y-auto">

                                {AvailableTrips?.map((item, key) => (
                                    <JourneyCard
                                        key={item.tripId || key}
                                        headsign={cleanStopName(item.tripHeadsign)}
                                        tripId={item.tripId}
                                        from={cleanStopName(item.departure?.stopName)}
                                        to={cleanStopName(item.arrival?.stopName)}
                                        departureTime={item.departure?.time}
                                        arrivalTime={item.arrival?.time}
                                        duration={formatDuration(item.durationSeconds)}
                                        className="cursor-pointer"
                                        onClick={() => openTripDetails(item)}
                                    />
                                ))}

                            </div>
                        )}
                    </div>
                ) : step === "detail" && selectedTrip ? (
                    <div className="h-[85vh] overflow-y-auto">

                        <button
                            type="button"
                            onClick={() => setStep("results")}
                            className="shrink-0 font-inter text-primary text-xs flex items-center gap-1 pt-2 underline underline-offset-2"
                        >
                            <ArrowLeft size={12} /> Back to journeys
                        </button>

                        <div className="w-full max-w-[520px] font-inter text-neutral-dark">

                            {/* Route heading */}
                            <div className="flex items-center gap-2.5 mt-3">

                                <span
                                    className="inline-flex h-7 min-w-[38px] items-center justify-center rounded-badge px-2 font-sora text-[13px] font-bold"
                                    style={{
                                        backgroundColor: `#${selectedTrip.route?.routeColor || "333333"}`,
                                        color: "#ffffff"
                                    }}
                                >
                                    {selectedTrip.route?.shortName || "Bus"}
                                </span>

                                <h2 className="font-sora text-2xl font-bold text-neutral-dark">
                                    {cleanStopName(Boarding)} to{" "}
                                    {cleanStopName(Destination)}
                                </h2>
                            </div>

                            {/* Journey summary */}
                            <div className="mt-3 text-sm text-neutral">
                                <p>
                                    Departure:{" "}
                                    <b>{selectedTrip.departure?.time || "--"}</b>
                                </p>
                                <p>
                                    Arrival:{" "}
                                    <b>{selectedTrip.arrival?.time || "--"}</b>
                                </p>
                            </div>

                            {/* Complete Stops Timeline */}
                            <div className="rounded-card border border-neutral-border bg-surface-light p-4 mt-4">

                                <div className="mb-4 flex items-center justify-between gap-2">
                                    <b>
                                        {selectedTrip.totalStops ??
                                            selectedTrip.stops?.length ??
                                            0}{" "}
                                        stops ·{" "}
                                        {formatDuration(selectedTrip.durationSeconds)}
                                    </b>

                                    <span className="rounded-pill bg-accent-light px-[9px] py-[3px] text-chip font-semibold text-accent">
                                        Scheduled times
                                    </span>
                                </div>

                                {selectedTrip.stops?.length > 0 ? (
                                    <ul className="ml-2">

                                        {selectedTrip.stops.map((stop, i) => {
                                            const {
                                                isBoarding,
                                                isDestination,
                                                connectorStyle,
                                                circleStyle
                                            } = getTimelineStyles(
                                                i,
                                                selectedTrip.stops,
                                                boardingIndex,
                                                destinationIndex
                                            );

                                            const sub = [
                                                isBoarding && "Board here",
                                                isDestination && "Get off",
                                                stop.pickupType === 1 &&
                                                    "No pickup",
                                                stop.dropOffType === 1 &&
                                                    "No drop-off"
                                            ]
                                                .filter(Boolean)
                                                .join(" · ");

                                            return (
                                                <li
                                                    key={`${stop.stopId}-${stop.stopSequence}`}
                                                    className="relative flex justify-between gap-3 border-l-2 pb-6 pl-7 last:pb-0"
                                                    style={connectorStyle}
                                                >

                                                    {/* Stop Circle */}
                                                    <span
                                                        className="absolute -left-[8px] top-0.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px]"
                                                        style={{
                                                            ...circleStyle,
                                                            left: "-1px"
                                                        }}
                                                    />

                                                    {/* Stop Name */}
                                                    <span className="min-w-0">
                                                        <b
                                                            className={
                                                                isBoarding || isDestination
                                                                    ? "text-neutral-dark"
                                                                    : "text-neutral"
                                                            }
                                                        >
                                                            {cleanStopName(stop.stopName)}
                                                        </b>

                                                        {sub && (
                                                            <span className="block text-[13px] text-neutral">
                                                                {sub}
                                                            </span>
                                                        )}
                                                    </span>

                                                    {/* Stop Time */}
                                                    <span
                                                        className={
                                                            isBoarding || isDestination
                                                                ? "shrink-0 font-sora text-base font-bold"
                                                                : "shrink-0 text-sm text-neutral"
                                                        }
                                                    >
                                                        {getStopTime(stop)}
                                                    </span>

                                                </li>
                                            );
                                        })}

                                    </ul>
                                ) : (
                                    <p className="text-sm text-neutral">
                                        No stop details are available for this trip.
                                    </p>
                                )}
                            </div>

                            <p className="mt-3 text-[13px] text-neutral">
                                Indicative demo fare. No booking in this version.
                            </p>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Map */}
            <div>
                <MapView
                    pickup={[75.8577, 26.9124]}
                    destination={[75.8267, 26.8851]}
                    height="550px"
                />
            </div>

        </main>
    );
};

export default BusFinder;