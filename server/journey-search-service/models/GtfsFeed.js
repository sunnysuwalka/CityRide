import mongoose from "mongoose";

const gtfsFeedSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    city: String,

    source_file: String,
    source_sha256: String,

    feed_info: {
        feed_publisher_name: String,
        feed_publisher_url: String,
        feed_lang: String,
        default_lang: String,

        feed_start_date: String,
        feed_end_date: String,

        feed_version: String,

        feed_contact_email: String,
        feed_contact_url: String
    },

    status: {
        type: String,
        enum: [
            "importing",
            "active",
            "archived",
            "failed"
        ]
    },

    imported_at: Date,
    activated_at: Date,

    last_error: String,

    imported_counts: {
        type: mongoose.Schema.Types.Mixed
    },

    created_at: Date,
    updated_at: Date

}, {
    collection: "gtfsFeeds",
    versionKey: false,
    timestamps: false
});

gtfsFeedSchema.index(
    { feed_version: 1 },
    { unique: true }
);

export const GtfsFeed = mongoose.model(
    "GtfsFeed",
    gtfsFeedSchema,
    "gtfsFeeds"
);