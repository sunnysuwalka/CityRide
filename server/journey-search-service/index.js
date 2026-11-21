
import "dotenv/config";

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

// Models
import { Stop } from "./models/Stop.js";
import { Trip } from "./models/Trip.js";
import { StopTime } from "./models/StopTime.js";
import { Route } from "./models/Route.js";
import { GtfsFeedState } from "./models/GtfsFeedState.js";
import { ServiceCalendar } from "./models/ServiceCalendar.js";
import { ServiceException } from "./models/ServiceException.js";

// ============================================
// 1. APPLICATION CONFIGURATION
// ============================================

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());

app.use(cors({
    origin: true,
    credentials: true
}));

// ============================================
// 2. STANDARD API RESPONSE HELPERS
// ============================================

const sendSuccess = (
    res,
    {
        status = 200,
        message = "Request successful",
        data = null
    } = {}
) => {
    return res.status(status).json({
        success: true,
        message,
        data,
        error: null
    });
};

const sendError = (
    res,
    {
        status = 500,
        message = "Internal server error",
        code = "INTERNAL_SERVER_ERROR",
        details = null
    } = {}
) => {
    return res.status(status).json({
        success: false,
        message,
        data: null,
        error: {
            code,
            details
        }
    });
};

// ============================================
// 3. CUSTOM API ERROR
// ============================================

class ApiError extends Error {
    constructor(status, code, message, details = null) {
        super(message);

        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

// ============================================
// 4. ASYNC ERROR HANDLER
// ============================================

const asyncHandler = (handler) => {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next))
            .catch(next);
    };
};

// ============================================
// 5. DATABASE CONNECTION
// ============================================

const connectDB = async () => {
    const conn = await mongoose.connect(
        process.env.MONGODB_URI
    );

    console.log(
        `MongoDB Connected: ${conn.connection.host}`
    );
};

// ============================================
// 6. QUERY VALIDATION
// ============================================

const validateQuery = (query) => {

    const allowedParameters = new Set([
        "fromStopId",
        "toStopId",
        "date",
        "after"
    ]);

    if (
        !query ||
        typeof query !== "object" ||
        Array.isArray(query)
    ) {
        throw new ApiError(
            400,
            "INVALID_QUERY",
            "Malformed query parameters"
        );
    }

    for (const [key, value] of Object.entries(query)) {

        if (!allowedParameters.has(key)) {
            throw new ApiError(
                400,
                "UNEXPECTED_PARAMETER",
                `Unexpected query parameter: ${key}`
            );
        }

        if (typeof value !== "string") {
            throw new ApiError(
                400,
                "INVALID_PARAMETER",
                `${key} must be supplied once as a string`
            );
        }
    }

    const {
        fromStopId,
        toStopId,
        date
    } = query;

    if (
        fromStopId === undefined ||
        toStopId === undefined ||
        date === undefined
    ) {
        throw new ApiError(
            400,
            "MISSING_PARAMETERS",
            "Missing required query parameters",
            {
                required: [
                    "fromStopId",
                    "toStopId",
                    "date"
                ],
                optional: {
                    after: "Defaults to 00:00"
                }
            }
        );
    }

    const from = fromStopId.trim();
    const to = toStopId.trim();

    if (!from || !to) {
        throw new ApiError(
            400,
            "EMPTY_STOP_ID",
            "Stop IDs cannot be empty"
        );
    }

    if (from === to) {
        throw new ApiError(
            400,
            "SAME_STOP",
            "Departure and arrival stops cannot be the same"
        );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new ApiError(
            400,
            "INVALID_DATE_FORMAT",
            "Invalid date format. Use YYYY-MM-DD"
        );
    }

    const parsedDate = new Date(
        `${date}T00:00:00.000Z`
    );

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date
    ) {
        throw new ApiError(
            400,
            "INVALID_DATE",
            "Invalid calendar date"
        );
    }

    const after = query.after === undefined
        ? "00:00"
        : query.after;

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(after)) {
        throw new ApiError(
            400,
            "INVALID_TIME",
            "Invalid time format. Use HH:mm"
        );
    }

    return {
        fromStopId: from,
        toStopId: to,
        date,
        after
    };
};

// ============================================
// 7. TIME HELPERS
// ============================================

const timeToSeconds = (time) => {
    const [hours, minutes] = time.split(":").map(Number);

    return (hours * 3600) + (minutes * 60);
};

// Supports GTFS times beyond 24 hours.

const gtfsTimeToSeconds = (time) => {

    if (
        typeof time !== "string" ||
        !/^\d{2,}:[0-5]\d:[0-5]\d$/.test(time)
    ) {
        return null;
    }

    const [hours, minutes, seconds] = time
        .split(":")
        .map(Number);

    if (
        !Number.isSafeInteger(hours) ||
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds) ||
        minutes > 59 ||
        seconds > 59
    ) {
        return null;
    }

    const total =
        hours * 3600 +
        minutes * 60 +
        seconds;

    return Number.isSafeInteger(total)
        ? total
        : null;
};

const getStopTimeSeconds = (
    secondsValue,
    timeValue
) => {

    if (
        secondsValue === undefined ||
        secondsValue === null ||
        secondsValue === ""
    ) {
        return gtfsTimeToSeconds(timeValue);
    }

    const parsed =
        typeof secondsValue === "number"
            ? secondsValue
            : typeof secondsValue === "string" &&
              /^\d+$/.test(secondsValue)
                ? Number(secondsValue)
                : NaN;

    if (
        Number.isSafeInteger(parsed) &&
        parsed >= 0
    ) {
        return parsed;
    }

    return gtfsTimeToSeconds(timeValue);
};

// ============================================
// 8. GTFS VALUE PARSERS
// ============================================

const parseGtfsFlag = (value) => {

    if (
        value === true ||
        value === 1 ||
        value === "1"
    ) {
        return true;
    }

    if (
        value === false ||
        value === 0 ||
        value === "0"
    ) {
        return false;
    }

    return null;
};

const parseGtfsInteger = (value) => {

    if (
        typeof value === "number" &&
        Number.isSafeInteger(value)
    ) {
        return value;
    }

    if (
        typeof value === "string" &&
        /^\d+$/.test(value)
    ) {
        const parsed = Number(value);

        return Number.isSafeInteger(parsed)
            ? parsed
            : null;
    }

    return null;
};

// ============================================
// 9. GTFS SERVICE VALIDATION
// ============================================

const isServiceActive = (
    serviceId,
    date,
    calendars,
    exceptions
) => {

    const exception = exceptions.find(
        item => item.service_id === serviceId
    );

    if (exception) {

        const type = parseGtfsInteger(
            exception.exception_type
        );

        if (type === 1) return true;
        if (type === 2) return false;

        console.warn(
            `Unknown exception_type for service ${serviceId}`
        );
    }

    const calendar = calendars.find(
        item => item.service_id === serviceId
    );

    if (!calendar) return false;

    const gtfsDate = date.replaceAll("-", "");

    const startDate = String(calendar.start_date ?? "");
    const endDate = String(calendar.end_date ?? "");

    if (
        !/^\d{8}$/.test(startDate) ||
        !/^\d{8}$/.test(endDate) ||
        gtfsDate < startDate ||
        gtfsDate > endDate
    ) {
        return false;
    }

    const dayIndex = new Date(
        `${date}T00:00:00.000Z`
    ).getUTCDay();

    const weekdays = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    const flags = weekdays.map(
        day => parseGtfsFlag(calendar[day])
    );

    if (flags.some(value => value === null)) {

        console.warn(
            `Malformed weekday flags for service ${serviceId}`
        );

        return false;
    }

    return flags[dayIndex] === true;
};

// ============================================
// 10. PICKUP / DROP-OFF VALIDATION
// ============================================

const isStopTimeActionAllowed = (value) => {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return true;
    }

    const type = parseGtfsInteger(value);

    return (
        type === 0 ||
        type === 2 ||
        type === 3
    );
};

// ============================================
// 11. ACTIVE FEED HELPER
// ============================================

const getActiveFeedVersion = async () => {

    const state = await GtfsFeedState
        .findById("active")
        .lean();

    if (!state?.active_feed_version) {
        throw new ApiError(
            503,
            "ACTIVE_FEED_UNAVAILABLE",
            "No active GTFS feed is currently available"
        );
    }

    return state.active_feed_version;
};

// ============================================
// 12. JOURNEY SEARCH API
// ============================================

app.get(
    "/api/v1/journeys/search",
    asyncHandler(async (req, res) => {

        // STEP 1: Validate parameters.

        const {
            fromStopId,
            toStopId,
            date,
            after
        } = validateQuery(req.query);

        // STEP 2: Active GTFS feed.

        const feedVersion = await getActiveFeedVersion();

        // STEP 3: Fetch selected stops.

        const [from, to] = await Promise.all([

            Stop.findOne({
                feed_version: feedVersion,
                stop_id: fromStopId
            }).lean(),

            Stop.findOne({
                feed_version: feedVersion,
                stop_id: toStopId
            }).lean()

        ]);

        if (!from || !to) {
            throw new ApiError(
                404,
                "STOP_NOT_FOUND",
                "Departure or arrival stop not found"
            );
        }

        // STEP 4: Fetch departure records.

        const afterSeconds = timeToSeconds(after);

        const departureStopTimes = await StopTime.find({
            feed_version: feedVersion,
            stop_id: fromStopId
        }).lean();

        const validDepartures = departureStopTimes.filter(
            item => {

                const seconds = getStopTimeSeconds(
                    item.departure_seconds,
                    item.departure_time
                );

                return (
                    seconds !== null &&
                    seconds >= afterSeconds
                );
            }
        );

        if (validDepartures.length === 0) {

            return sendSuccess(res, {
                message: "No journeys found for the selected search criteria",

                data: {
                    fromStop: from,
                    toStop: to,
                    date,
                    after,
                    totalResults: 0,
                    journeys: []
                }
            });
        }

        // STEP 5: Find arrival records.

        const candidateTripIds = [
            ...new Set(
                validDepartures.map(item => item.trip_id)
            )
        ];

        const arrivalStopTimes = await StopTime.find({

            feed_version: feedVersion,
            stop_id: toStopId,
            trip_id: { $in: candidateTripIds }

        })
            .sort({ stop_sequence: 1 })
            .lean();

        const arrivalsByTrip = new Map();

        for (const arrival of arrivalStopTimes) {

            if (!arrivalsByTrip.has(arrival.trip_id)) {
                arrivalsByTrip.set(arrival.trip_id, []);
            }

            arrivalsByTrip.get(arrival.trip_id).push(arrival);
        }

        // STEP 6: Match valid direct journeys.

        const matchingJourneys = [];

        for (const departure of validDepartures) {

            if (
                !isStopTimeActionAllowed(
                    departure.pickup_type
                )
            ) {
                continue;
            }

            const departureSequence = Number(
                departure.stop_sequence
            );

            if (!Number.isFinite(departureSequence)) {
                continue;
            }

            const possibleArrivals =
                arrivalsByTrip.get(departure.trip_id) || [];

            const arrival = possibleArrivals.find(item => {

                const sequence = Number(item.stop_sequence);

                return (
                    Number.isFinite(sequence) &&
                    sequence > departureSequence &&
                    isStopTimeActionAllowed(item.drop_off_type)
                );
            });

            if (!arrival) continue;

            const departureSeconds = getStopTimeSeconds(
                departure.departure_seconds,
                departure.departure_time
            );

            const arrivalSeconds = getStopTimeSeconds(
                arrival.arrival_seconds,
                arrival.arrival_time
            );

            if (
                departureSeconds === null ||
                arrivalSeconds === null ||
                arrivalSeconds < departureSeconds
            ) {
                continue;
            }

            matchingJourneys.push({

                tripId: departure.trip_id,
                departure,
                arrival,
                departureSeconds,
                arrivalSeconds

            });
        }

        if (matchingJourneys.length === 0) {

            return sendSuccess(res, {
                message: "No direct journeys found between these stops",

                data: {
                    fromStop: from,
                    toStop: to,
                    date,
                    after,
                    totalResults: 0,
                    journeys: []
                }
            });
        }

        // STEP 7: Fetch trips.

        const matchingTripIds = [
            ...new Set(
                matchingJourneys.map(item => item.tripId)
            )
        ];

        const trips = await Trip.find({

            feed_version: feedVersion,
            trip_id: { $in: matchingTripIds }

        }).lean();

        const tripMap = new Map(
            trips.map(trip => [trip.trip_id, trip])
        );

        // ============================================
        // STEP 7.1: FETCH ALL STOPS FOR MATCHING TRIPS
        // ============================================

        // Fetch every stop_time belonging to matching trips.

        const allTripStopTimes = await StopTime.find({

            feed_version: feedVersion,
            trip_id: { $in: matchingTripIds }

        }).lean();

        // Collect all unique stop IDs.

        const allStopIds = [
            ...new Set(
                allTripStopTimes.map(item => item.stop_id)
            )
        ];

        // Fetch corresponding stop details.

        const allStops = await Stop.find({

            feed_version: feedVersion,
            stop_id: { $in: allStopIds }

        }).lean();

        // Create stop lookup map.

        const allStopMap = new Map(
            allStops.map(stop => [
                stop.stop_id,
                stop
            ])
        );

        // Group stop times by trip.

        const tripStopTimesMap = new Map();

        for (const item of allTripStopTimes) {

            if (!tripStopTimesMap.has(item.trip_id)) {
                tripStopTimesMap.set(item.trip_id, []);
            }

            tripStopTimesMap.get(item.trip_id).push(item);
        }

        // Sort all trip stops by stop_sequence.

        for (const stopTimes of tripStopTimesMap.values()) {

            stopTimes.sort(
                (a, b) =>
                    Number(a.stop_sequence) -
                    Number(b.stop_sequence)
            );
        }

        // STEP 8: Validate service calendars.

        const serviceIds = [
            ...new Set(
                trips.map(trip => trip.service_id)
            )
        ];

        const gtfsDate = date.replaceAll("-", "");

        const [calendars, exceptions] = await Promise.all([

            ServiceCalendar.find({

                feed_version: feedVersion,
                service_id: { $in: serviceIds }

            }).lean(),

            ServiceException.find({

                feed_version: feedVersion,
                date: gtfsDate,
                service_id: { $in: serviceIds }

            }).lean()

        ]);

        const activeTripIds = new Set(

            trips
                .filter(trip =>
                    isServiceActive(
                        trip.service_id,
                        date,
                        calendars,
                        exceptions
                    )
                )
                .map(trip => trip.trip_id)

        );

        // STEP 9: Fetch routes.

        const activeTrips = trips.filter(
            trip => activeTripIds.has(trip.trip_id)
        );

        const routeIds = [
            ...new Set(
                activeTrips.map(trip => trip.route_id)
            )
        ];

        const routes = await Route.find({

            feed_version: feedVersion,
            route_id: { $in: routeIds }

        }).lean();

        const routeMap = new Map(
            routes.map(route => [route.route_id, route])
        );

        // ============================================
        // STEP 10: CONSTRUCT JOURNEY RESPONSE
        // ============================================

        const journeys = matchingJourneys

            .filter(item => activeTripIds.has(item.tripId))

            .map(item => {

                const trip = tripMap.get(item.tripId);

                if (!trip) return null;

                const route = routeMap.get(trip.route_id);

                if (!route) return null;

                // Get ALL stop times for this trip.

                const tripStopTimes =
                    tripStopTimesMap.get(item.tripId) || [];

                // Build the complete stop list.

                const completeStops = tripStopTimes.map(stopTime => {

                    const stop = allStopMap.get(stopTime.stop_id);

                    return {

                        stopId: stopTime.stop_id,

                        stopName: stop?.stop_name || "Unknown Stop",

                        stopSequence: Number(
                            stopTime.stop_sequence
                        ),

                        arrivalTime: stopTime.arrival_time ?? null,

                        departureTime: stopTime.departure_time ?? null,

                        pickupType:
                            parseGtfsInteger(
                                stopTime.pickup_type
                            ) ?? 0,

                        dropOffType:
                            parseGtfsInteger(
                                stopTime.drop_off_type
                            ) ?? 0

                    };
                });

                // Return existing departure and arrival
                // separately, along with the complete stops list.

                return {

                    tripId: trip.trip_id,

                    route: {

                        routeId: route.route_id,
                        shortName: route.route_short_name,
                        longName: route.route_long_name,
                        routeType: route.route_type,
                        routeColor: route.route_color

                    },

                    departure: {

                        stopId: from.stop_id,
                        stopName: from.stop_name,
                        time: item.departure.departure_time,
                        stopSequence: item.departure.stop_sequence,

                        pickupType:
                            parseGtfsInteger(
                                item.departure.pickup_type
                            ) ?? 0

                    },

                    arrival: {

                        stopId: to.stop_id,
                        stopName: to.stop_name,
                        time: item.arrival.arrival_time,
                        stopSequence: item.arrival.stop_sequence,

                        dropOffType:
                            parseGtfsInteger(
                                item.arrival.drop_off_type
                            ) ?? 0

                    },

                    // NEW: Total number of stops in the complete trip.

                    totalStops: completeStops.length,

                    // NEW: Separate list containing ALL trip stops.

                    stops: completeStops,

                    durationSeconds:
                        item.arrivalSeconds -
                        item.departureSeconds,

                    tripHeadsign: trip.trip_headsign

                };

            })

            .filter(Boolean)

            .sort((a, b) =>
                a.durationSeconds - b.durationSeconds
            );

        return sendSuccess(res, {

            message: journeys.length
                ? "Journeys fetched successfully"
                : "No journeys operate on the requested date",

            data: {

                fromStop: from,
                toStop: to,
                date,
                after,

                totalResults: journeys.length,

                journeys

            }

        });

    })
);

// ============================================
// 13. STOPS API
// ============================================

app.get(
    "/api/v1/stops",
    asyncHandler(async (req, res) => {

        const feedVersion = await getActiveFeedVersion();

        const stops = await Stop.find({

            feed_version: feedVersion

        }).lean();

        const finalStops = stops.map(stop => ({

            ...stop,

            stop_name: stop.stop_name
                .replace(/Demo Stop/gi, "")
                .trim()

        }));

        return sendSuccess(res, {

            message: "Stops fetched successfully",

            data: {

                totalResults: finalStops.length,
                stops: finalStops

            }

        });

    })
);

// ============================================
// 14. HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {

    const connected =
        mongoose.connection.readyState === 1;

    return sendSuccess(res, {

        status: connected ? 200 : 503,

        message: connected
            ? "Journey Search Service is healthy"
            : "Database connection unavailable",

        data: {

            service: "Journey Search Service",

            database: connected
                ? "connected"
                : "disconnected"

        }

    });

});

// ============================================
// 15. NOT FOUND HANDLER
// ============================================

app.use((req, res) => {

    return sendError(res, {

        status: 404,

        code: "RESOURCE_NOT_FOUND",

        message: `Route not found: ${req.method} ${req.originalUrl}`

    });

});

// ============================================
// 16. CENTRALIZED ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {

    console.error("API Error:", {

        method: req.method,
        path: req.originalUrl,
        error: err.message,

        stack: process.env.NODE_ENV === "development"
            ? err.stack
            : undefined

    });

    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof ApiError) {

        return sendError(res, {

            status: err.status,
            code: err.code,
            message: err.message,
            details: err.details

        });

    }

    if (err instanceof mongoose.Error.ValidationError) {

        return sendError(res, {

            status: 400,

            code: "DATABASE_VALIDATION_ERROR",

            message: "Invalid data",

            details: Object.values(err.errors).map(
                item => ({

                    field: item.path,
                    message: item.message

                })
            )

        });

    }

    if (err instanceof mongoose.Error.CastError) {

        return sendError(res, {

            status: 400,

            code: "INVALID_RESOURCE_ID",

            message: "Invalid resource identifier"

        });

    }

    if (err.type === "entity.parse.failed") {

        return sendError(res, {

            status: 400,

            code: "INVALID_JSON",

            message: "Request body contains invalid JSON"

        });

    }

    return sendError(res, {

        status: 500,

        code: "INTERNAL_SERVER_ERROR",

        message: "An unexpected error occurred"

    });

});

// ============================================
// 17. START SERVER
// ============================================

const startServer = async () => {

    try {

        if (!process.env.MONGODB_URI) {

            throw new Error(
                "MONGODB_URI is not configured"
            );

        }

        await connectDB();

        app.listen(PORT, () => {

            console.log(
                `Journey Search Service running on port ${PORT}`
            );

        });

    } catch (error) {

        console.error(
            "Server startup failed:",
            error.message
        );

        process.exit(1);

    }

};

startServer();
