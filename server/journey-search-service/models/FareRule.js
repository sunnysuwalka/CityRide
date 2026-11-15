import mongoose from "mongoose";
const fareRuleSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    rule_id: {
        type: Number,
        required: true
    },

    fare_id: {
        type: String,
        required: true
    },

    route_id: String,
    origin_id: String,
    destination_id: String,
    contains_id: String,

    created_at: Date,
    updated_at: Date

}, {
    collection: "fareRules",
    versionKey: false,
    timestamps: false
});

fareRuleSchema.index(
    {
        feed_version: 1,
        fare_id: 1,
        rule_id: 1
    },
    { unique: true }
);

fareRuleSchema.index({
    feed_version: 1,
    route_id: 1
});

export const FareRule = mongoose.model("FareRule", fareRuleSchema, "fareRules");