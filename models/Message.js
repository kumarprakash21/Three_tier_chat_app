const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
    {
        name: String,
        type: String,
        size: Number,
        url: String
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false
        },

        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: false
        },

        message: {
            type: String,
            required: false,
            default: "",
            trim: true,
            maxlength: 2000
        },

        attachment: {
            type: attachmentSchema,
            default: undefined
        },

        replyTo: {
            messageId: mongoose.Schema.Types.ObjectId,
            senderName: String,
            message: String
        },

        reactions: [{
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            emoji: String
        }],

        pinned: { type: Boolean, default: false },
        pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

        read: {
            type: Boolean,
            default: false
        },

        edited: {
            type: Boolean,
            default: false
        }
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model("Message", messageSchema);
