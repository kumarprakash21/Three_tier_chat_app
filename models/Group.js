const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        description: { type: String, trim: true, maxlength: 160, default: "" },
        profilePicture: { type: String, default: "", maxlength: 2000000 },
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
    },
    { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
