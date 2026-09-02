const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 30
        },

        password: {
            type: String,
            required: true
        },

        displayName: {
            type: String,
            trim: true,
            maxlength: 50,
            default: ""
        },

        bio: {
            type: String,
            trim: true,
            maxlength: 160,
            default: ""
        },

        profilePicture: {
            type: String,
            default: ""
        },

        notifications: {
            type: Boolean,
            default: true
        },

        lastSeen: {
            type: Date,
            default: Date.now
        },

        hiddenChats: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
