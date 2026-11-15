import "dotenv/config";
import express from "express";
import cors from "cors"
import mongoose from "mongoose";

// Models
import { Stop } from "./models/Stop.js";
import { Trip } from "./models/Trip.js";
import { StopTime } from "./models/StopTime.js";
import { Route } from "./models/Route.js";
import { GtfsFeedState } from "./models/GtfsFeedState.js";
import { ServiceCalendar } from "./models/ServiceCalendar.js";
import { ServiceException } from "./models/ServiceException.js";

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cors({
    origin: true,
    credentials: true
}));

// ============================================
// 1. DATABASE CONNECTION
// ============================================

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        console.log(`MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        console.error("MongoDB Connection Error:", error.message);
        throw error;
    }
};

// ============================================
// 2. QUERY VALIDATION
// ============================================

const ValidateQuery = (query) => {

    if (!query || typeof query !== "object" || Array.isArray(query)) {
        return {
            success: false,
            message: "Malformed query parameters"
        };
    }

    const allowedParameters = new Set([
        "fromStopId",
        "toStopId",
        "date",
        "after"
    ]);

    // Reject unexpected parameters, arrays and nested objects.
    for (const [key, value] of Object.entries(query)) {

        if (!allowedParameters.has(key)) {
            return {
                success: false,
                message: `Unexpected query parameter: ${key}`
            };
        }

        if (typeof value !== "string") {
            return {
                success: false,
                message: `Invalid query parameter: ${key} must be supplied once as a string`
            };
        }
    }

    const { fromStopId, toStopId, date } = query;

    // after is optional.
    const after = query.after === undefined
        ? "00:00"
        : query.after;

    if (
        fromStopId === undefined ||
        toStopId === undefined ||
        date === undefined
    ) {
        return {
            success: false,
            message: "Missing required parameters",
            required: [
                "fromStopId",
                "toStopId",
                "date"
            ],
            optional: {
                after: "Defaults to 00:00 when omitted"
            }
        };
    }

    // Trim stop IDs.
    const normalizedFromStopId = fromStopId.trim();
    const normalizedToStopId = toStopId.trim();

    // Reject empty or whitespace-only stop IDs.
    if (!normalizedFromStopId || !normalizedToStopId) {
        return {
            success: false,
            message: "Stop IDs cannot be empty or whitespace-only"
        };
    }

    // Departure and arrival cannot be the same.
    if (normalizedFromStopId === normalizedToStopId) {
        return {
            success: false,
            message: "Departure and arrival stops cannot be the same"
        };
    }

    // Validate actual calendar date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return {
            success: false,
            message: "Invalid date format. Use YYYY-MM-DD"
        };
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== date
    ) {
        return {
            success: false,
            message: "Invalid calendar date"
        };
    }

    // Validate requested departure time.
    // Explicitly empty after values are invalid.
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(after)) {
        return {
            success: false,
            message: "Invalid time format. Use HH:mm"
        };
    }

    return {
        success: true,
        data: {
            fromStopId: normalizedFromStopId,
            toStopId: normalizedToStopId,
            date,
            after
        }
    };
};

// ============================================
// 3. TIME HELPERS
// ============================================

// Convert HH:mm into seconds.

const timeToSeconds = (time) => {

    const [hours, minutes] = time.split(":").map(Number);

    return (hours * 3600) + (minutes * 60);
};


// Convert GTFS HH:mm:ss into seconds.
//
// GTFS allows times greater than 24:00:00.
// Example: 25:15:00 represents 1:15 AM
// on the following calendar day within the same service day.

const gtfsTimeToSeconds = (time) => {

    if (
        typeof time !== "string" ||
        !/^\d{2,}:[0-5]\d:[0-5]\d$/.test(time)
    ) {
        return null;
    }

    const [hours, minutes, seconds] = time.split(":").map(Number);

    if (
        !Number.isSafeInteger(hours) ||
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds) ||
        hours < 0 ||
        minutes < 0 ||
        minutes > 59 ||
        seconds < 0 ||
        seconds > 59
    ) {
        return null;
    }

    const totalSeconds =
        (hours * 3600) +
        (minutes * 60) +
        seconds;

    return Number.isSafeInteger(totalSeconds)
        ? totalSeconds
        : null;
};


// Get StopTime seconds.
//
// Prefer precomputed seconds.
// If unavailable or invalid, parse the GTFS time string.

const getStopTimeSeconds = (secondsValue, timeValue) => {

    if (
        secondsValue === undefined ||
        secondsValue === null ||
        secondsValue === ""
    ) {
        return gtfsTimeToSeconds(timeValue);
    }

    const parsedSeconds =
        typeof secondsValue === "number"
            ? secondsValue
            : typeof secondsValue === "string" && /^\d+$/.test(secondsValue)
                ? Number(secondsValue)
                : NaN;

    if (
        Number.isSafeInteger(parsedSeconds) &&
        parsedSeconds >= 0
    ) {
        return parsedSeconds;
    }

    return gtfsTimeToSeconds(timeValue);
};

// ============================================
// 4. GTFS SERVICE CALENDAR VALIDATION
// ============================================

// Validate GTFS calendar weekday fields.
//
// Supports:
// true / false
// 1 / 0
// "1" / "0"

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


// Parse an integer stored as a number or digit-only string.

const parseGtfsInteger = (value) => {

    if (
        typeof value === "number" &&
        Number.isInteger(value)
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
// SERVICE ACTIVE VALIDATION
// ============================================

const IsServiceActive = (
    serviceId,
    date,
    calendars,
    exceptions
) => {

    const exception = exceptions.find(
        item => item.service_id === serviceId
    );

    // GTFS calendar_dates exception_type:
    //
    // 1 = Service added
    // 2 = Service removed

    if (exception) {

        const exceptionType = parseGtfsInteger(
            exception.exception_type
        );

        if (exceptionType === 1) {
            return true;
        }

        if (exceptionType === 2) {
            return false;
        }

        // Unknown exception types are ignored.
        // Fall back to the normal weekly calendar.

        console.warn(
            `Ignoring unknown GTFS exception_type for service ${serviceId}:`,
            exception.exception_type
        );
    }

    const calendar = calendars.find(
        item => item.service_id === serviceId
    );

    if (!calendar) {
        return false;
    }

    const gtfsDate = date.replaceAll("-", "");

    const startDate = String(calendar.start_date ?? "");
    const endDate = String(calendar.end_date ?? "");

    // Validate calendar date boundaries.

    if (
        !/^\d{8}$/.test(startDate) ||
        !/^\d{8}$/.test(endDate) ||
        gtfsDate < startDate ||
        gtfsDate > endDate
    ) {
        return false;
    }

    // Determine weekday in UTC.
    // This avoids timezone shifts.

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

    // Verify all weekday fields and their stored values.

    const normalizedWeekdays = weekdays.map(
        weekday => parseGtfsFlag(calendar[weekday])
    );

    if (
        normalizedWeekdays.some(
            value => value === null
        )
    ) {
        console.warn(
            `Ignoring malformed weekday flags for GTFS service ${serviceId}`
        );

        return false;
    }

    return normalizedWeekdays[dayIndex] === true;
};


// ============================================
// 5. PICKUP / DROP-OFF VALIDATION
// ============================================

// GTFS pickup_type:
//
// 0 = Regular pickup
// 1 = No pickup
// 2 = Arrange by phone
// 3 = Arrange with driver
//
// GTFS drop_off_type:
//
// 0 = Regular drop-off
// 1 = No drop-off
// 2 = Arrange by phone
// 3 = Arrange with driver
//
// Types 2 and 3 are retained because they
// represent services requiring arrangements.

const isStopTimeActionAllowed = (value) => {

    // GTFS default value is 0 when blank.

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return true;
    }

    const actionType = parseGtfsInteger(value);

    return (
        actionType === 0 ||
        actionType === 2 ||
        actionType === 3
    );
};

// ============================================
// 6. JOURNEY SEARCH API
// ============================================

app.get("/api/v1/journeys/search", async (req, res) => {

    try {

        // STEP 1: Validate query parameters.

        const validation = ValidateQuery(req.query);

        if (!validation.success) {
            return res.status(400).json(validation);
        }

        const {
            fromStopId,
            toStopId,
            date,
            after
        } = validation.data;


        // STEP 2: Get active GTFS feed version.

        const feedState = await GtfsFeedState.findById(
            "active"
        ).lean();

        if (
            !feedState ||
            !feedState.active_feed_version
        ) {
            return res.status(503).json({
                success: false,
                message: "No active GTFS feed found"
            });
        }

        const feedVersion = feedState.active_feed_version;


        // STEP 3: Find departure and arrival stops.

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
            return res.status(404).json({
                success: false,
                message: "Departure or arrival stop not found"
            });
        }


        // STEP 4: Find departure StopTime records.

        const afterSeconds = timeToSeconds(after);

        const departureStopTimes = await StopTime.find({
            feed_version: feedVersion,
            stop_id: fromStopId
        }).lean();


        // Filter departures by requested time.

        const validDepartures = departureStopTimes.filter(item => {

            const departureSeconds = getStopTimeSeconds(
                item.departure_seconds,
                item.departure_time
            );

            return (
                departureSeconds !== null &&
                departureSeconds >= afterSeconds
            );

        });


        if (validDepartures.length === 0) {

            return res.status(200).json({
                success: true,
                message: "No journeys found",
                journeys: [],
                totalResults: 0
            });

        }


        // STEP 5: Find matching arrival StopTimes.

        const candidateTripIds = [
            ...new Set(
                validDepartures.map(
                    item => item.trip_id
                )
            )
        ];

        const arrivalStopTimes = await StopTime.find({

            feed_version: feedVersion,

            stop_id: toStopId,

            trip_id: {
                $in: candidateTripIds
            }

        }).sort({

            stop_sequence: 1

        }).lean();


        // Group arrival records by trip ID.

        const arrivalsByTrip = new Map();

        for (const arrival of arrivalStopTimes) {

            if (!arrivalsByTrip.has(arrival.trip_id)) {
                arrivalsByTrip.set(arrival.trip_id, []);
            }

            arrivalsByTrip.get(arrival.trip_id).push(arrival);

        }


        // STEP 6: Match departure and arrival sequence.
        //
        // Check:
        // 1. Departure pickup_type.
        // 2. Arrival drop_off_type.
        // 3. Arrival stop_sequence > departure stop_sequence.

        const matchingJourneys = [];

        for (const departure of validDepartures) {

            // Check whether passengers can board
            // at the selected departure stop.

            if (
                !isStopTimeActionAllowed(
                    departure.pickup_type
                )
            ) {
                continue;
            }


            const possibleArrivals =
                arrivalsByTrip.get(departure.trip_id) || [];

            const departureSequence = Number(
                departure.stop_sequence
            );

            if (!Number.isFinite(departureSequence)) {
                continue;
            }


            // Find the first later arrival where
            // passengers are permitted to alight.

            const arrival = possibleArrivals.find(item => {

                const arrivalSequence = Number(
                    item.stop_sequence
                );

                return (
                    Number.isFinite(arrivalSequence) &&
                    arrivalSequence > departureSequence &&
                    isStopTimeActionAllowed(
                        item.drop_off_type
                    )
                );

            });


            if (!arrival) {
                continue;
            }


            // Get departure and arrival seconds.

            const departureSeconds = getStopTimeSeconds(
                departure.departure_seconds,
                departure.departure_time
            );

            const arrivalSeconds = getStopTimeSeconds(
                arrival.arrival_seconds,
                arrival.arrival_time
            );


            // Validate journey times.

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

            return res.status(200).json({
                success: true,
                message: "No direct journeys found between these stops",
                journeys: [],
                totalResults: 0
            });

        }


        // STEP 7: Fetch matching trips.

        const matchingTripIds = [
            ...new Set(
                matchingJourneys.map(
                    item => item.tripId
                )
            )
        ];

        const trips = await Trip.find({

            feed_version: feedVersion,

            trip_id: {
                $in: matchingTripIds
            }

        }).lean();


        // Create trip lookup map.

        const tripMap = new Map(
            trips.map(
                trip => [
                    trip.trip_id,
                    trip
                ]
            )
        );


        // STEP 8: Check service calendars and exceptions.

        const serviceIds = [
            ...new Set(
                trips.map(
                    trip => trip.service_id
                )
            )
        ];

        const gtfsDate = date.replaceAll("-", "");


        const [calendars, exceptions] = await Promise.all([

            ServiceCalendar.find({

                feed_version: feedVersion,

                service_id: {
                    $in: serviceIds
                }

            }).lean(),


            ServiceException.find({

                feed_version: feedVersion,

                date: gtfsDate,

                service_id: {
                    $in: serviceIds
                }

            }).lean()

        ]);


        // Keep only trips operating on requested date.

        const activeTrips = trips.filter(trip =>

            IsServiceActive(
                trip.service_id,
                date,
                calendars,
                exceptions
            )

        );


        const activeTripIds = new Set(
            activeTrips.map(
                trip => trip.trip_id
            )
        );


        // STEP 9: Fetch route details.

        const routeIds = [
            ...new Set(
                activeTrips.map(
                    trip => trip.route_id
                )
            )
        ];

        const routes = await Route.find({

            feed_version: feedVersion,

            route_id: {
                $in: routeIds
            }

        }).lean();


        // Create route lookup map.

        const routeMap = new Map(
            routes.map(
                route => [
                    route.route_id,
                    route
                ]
            )
        );


        // STEP 10: Construct final journey response.

        const journeys = matchingJourneys

            // Keep only active trips.

            .filter(item =>
                activeTripIds.has(item.tripId)
            )

            .map(item => {

                const trip = tripMap.get(item.tripId);

                const route = trip
                    ? routeMap.get(trip.route_id)
                    : null;


                if (!trip || !route) {
                    return null;
                }


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

                        stopSequence:
                            item.departure.stop_sequence,

                        pickupType:
                            parseGtfsInteger(
                                item.departure.pickup_type
                            ) ?? 0

                    },


                    arrival: {

                        stopId: to.stop_id,

                        stopName: to.stop_name,

                        time: item.arrival.arrival_time,

                        stopSequence:
                            item.arrival.stop_sequence,

                        dropOffType:
                            parseGtfsInteger(
                                item.arrival.drop_off_type
                            ) ?? 0

                    },


                    durationSeconds:
                        item.arrivalSeconds -
                        item.departureSeconds,


                    tripHeadsign: trip.trip_headsign

                };

            })

            // Remove invalid results.

            .filter(Boolean)

            // Sort by journey duration.

            .sort((a, b) =>
                a.durationSeconds - b.durationSeconds
            );


        // STEP 11: Return response.

        return res.status(200).json({
            success: true,
            message: journeys.length > 0
                ? "Journeys found successfully"
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


    } catch (error) {

        console.error("Journey Search Error:", error);

        return res.status(500).json({

            success: false,

            message: "Internal server error"

        });

    }

});


app.get("/api/v1/stops", async (req, res) => {
    try {
        const stops = await Stop.find({});

        if (stops.length === 0) {
            return res.status(500).json({
                success: false,
                message: "error fetching stops"
            })
        }

        const stop_names = stops.map((item) =>
            item.stop_name.replace(/\s*\(Demo Stop\)/gi, "").trim()
        );

        return res.status(200).json({
            success: true,
            message: "Stops fetched successfully",
            stops: stop_names
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
});


// ============================================
// 7. HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {

    return res.status(200).json({

        success: true,

        database:
            mongoose.connection.readyState === 1
                ? "connected"
                : "disconnected",

        message: "Journey Search Service is healthy"

    });

});


// ============================================
// 8. START SERVER
// ============================================

const startServer = async () => {

    try {

        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not configured");
        }

        await connectDB();

        app.listen(PORT, () => {

            console.log(
                `Journey Search Service is running on port ${PORT}`
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