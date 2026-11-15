import mongoose from "mongoose";

const tripSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    route_id: {
        type: String,
        required: true
    },

    service_id: {
        type: String,
        required: true
    },

    trip_id: {
        type: String,
        required: true
    },

    trip_headsign: String,
    trip_short_name: String,
    direction_id: Number,
    block_id: String,
    shape_id: String,

    wheelchair_accessible: Number,
    bikes_allowed: Number,

    created_at: Date,
    updated_at: Date

}, {
    collection: "trips",
    versionKey: false,
    timestamps: false
});

tripSchema.index(
    { feed_version: 1, trip_id: 1 },
    { unique: true }
);

tripSchema.index({
    feed_version: 1,
    route_id: 1,
    service_id: 1
});

export const Trip = mongoose.model("Trip", tripSchema, "trips");