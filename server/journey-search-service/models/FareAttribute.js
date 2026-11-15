import mongoose from "mongoose";
const fareAttributeSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    fare_id: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true
    },

    price_minor_units: Number,

    currency_type: {
        type: String,
        required: true
    },

    payment_method: Number,
    transfers: Number,
    agency_id: String,
    transfer_duration: Number,

    created_at: Date,
    updated_at: Date

}, {
    collection: "fareAttributes",
    versionKey: false,
    timestamps: false
});

fareAttributeSchema.index(
    { feed_version: 1, fare_id: 1 },
    { unique: true }
);

export const FareAttribute = mongoose.model(
    "FareAttribute",
    fareAttributeSchema,
    "fareAttributes"
);