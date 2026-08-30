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

        lastSeen: {
            type: Date,
            default: Date.now
        }
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);