import mongoose from "mongoose";
const stopTimeSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    trip_id: {
        type: String,
        required: true
    },

    stop_id: {
        type: String,
        required: true
    },

    arrival_time: String,
    arrival_seconds: Number,

    departure_time: String,
    departure_seconds: Number,

    stop_sequence: {
        type: Number,
        required: true
    },

    stop_headsign: String,

    pickup_type: Number,
    drop_off_type: Number,

    continuous_pickup: Number,
    continuous_drop_off: Number,

    shape_dist_traveled: Number,
    timepoint: Number,

    created_at: Date,
    updated_at: Date

}, {
    collection: "stopTimes",
    versionKey: false,
    timestamps: false
});

stopTimeSchema.index(
    {
        feed_version: 1,
        trip_id: 1,
        stop_sequence: 1
    },
    { unique: true }
);

stopTimeSchema.index({
    feed_version: 1,
    stop_id: 1,
    trip_id: 1
});

export const StopTime = mongoose.model("StopTime", stopTimeSchema, "stopTimes");