import mongoose from "mongoose";
const routeSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    route_id: {
        type: String,
        required: true
    },

    agency_id: String,

    route_short_name: String,
    route_long_name: String,
    route_desc: String,

    route_type: {
        type: Number,
        required: true
    },

    route_url: String,
    route_color: String,
    route_text_color: String,

    route_sort_order: Number,

    continuous_pickup: Number,
    continuous_drop_off: Number,

    created_at: Date,
    updated_at: Date

}, {
    collection: "routes",
    versionKey: false,
    timestamps: false
});

routeSchema.index(
    { feed_version: 1, route_id: 1 },
    { unique: true }
);

routeSchema.index({
    feed_version: 1,
    route_short_name: 1
});

export const Route = mongoose.model("Route", routeSchema, "routes");