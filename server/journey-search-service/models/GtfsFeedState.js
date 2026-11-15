import mongoose from "mongoose";

const gtfsFeedStateSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: "active"
    },

    active_feed_version: {
        type: String,
        required: true
    },

    created_at: Date,
    updated_at: Date

}, {
    collection: "gtfsFeedState",
    versionKey: false,
    timestamps: false
});

export const GtfsFeedState = mongoose.model(
    "GtfsFeedState",
    gtfsFeedStateSchema,
    "gtfsFeedState"
);