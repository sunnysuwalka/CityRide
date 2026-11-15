import mongoose from "mongoose";
const serviceCalendarSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    service_id: {
        type: String,
        required: true
    },

    monday: Boolean,
    tuesday: Boolean,
    wednesday: Boolean,
    thursday: Boolean,
    friday: Boolean,
    saturday: Boolean,
    sunday: Boolean,

    start_date: {
        type: String,
        required: true
    },

    end_date: {
        type: String,
        required: true
    },

    created_at: Date,
    updated_at: Date

}, {
    collection: "serviceCalendars",
    versionKey: false,
    timestamps: false
});

serviceCalendarSchema.index(
    { feed_version: 1, service_id: 1 },
    { unique: true }
);

export const ServiceCalendar = mongoose.model(
    "ServiceCalendar",
    serviceCalendarSchema,
    "serviceCalendars"
);