import mongoose from "mongoose";
const serviceExceptionSchema = new mongoose.Schema({
    feed_version: {
        type: String,
        required: true
    },

    service_id: {
        type: String,
        required: true
    },

    date: {
        type: String,
        required: true
    },

    exception_type: {
        type: Number,
        required: true,
        enum: [1, 2]
    },

    created_at: Date,
    updated_at: Date

}, {
    collection: "serviceExceptions",
    versionKey: false,
    timestamps: false
});

serviceExceptionSchema.index(
    {
        feed_version: 1,
        service_id: 1,
        date: 1
    },
    { unique: true }
);

export const ServiceException = mongoose.model(
    "ServiceException",
    serviceExceptionSchema,
    "serviceExceptions"
);