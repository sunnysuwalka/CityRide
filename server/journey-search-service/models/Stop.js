import mongoose from "mongoose";
const stopSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    stop_id: {
        type: String,
        required: true
    },

    stop_code: String,
    stop_name: {
        type: String,
        required: true
    },
    stop_desc: String,

    stop_lat: Number,
    stop_lon: Number,

    location: {
        type: {
            type: String,
            enum: ["Point"]
        },
        coordinates: {
            type: [Number],
            validate: {
                validator: v => !v || v.length === 2,
                message: "Coordinates must contain longitude and latitude."
            }
        }
    },

    zone_id: String,
    location_type: Number,
    parent_station: String,
    stop_timezone: String,
    wheelchair_boarding: Number,
    platform_code: String,

    created_at: Date,
    updated_at: Date

}, {
    collection: "stops",
    versionKey: false,
    timestamps: false
});

stopSchema.index(
    { feed_version: 1, stop_id: 1 },
    { unique: true }
);

stopSchema.index({ location: "2dsphere" });

export const Stop = mongoose.model(
    "Stop",
    stopSchema,
    "stops"
);