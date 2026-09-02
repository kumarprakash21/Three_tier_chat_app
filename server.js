require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const User = require("./models/User");
const Message = require("./models/Message");
const Group = require("./models/Group");
const authenticateToken = require("./middleware/auth");


/*
==================================================
APP CONFIGURATION
==================================================
*/

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 3000;
const uploadDirectory = path.join(__dirname, "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });


/*
==================================================
MIDDLEWARE
==================================================
*/

app.use(cors());

// Profile pictures are sent as Base64 JSON. A 1 MB image expands when
// encoded, so the request limit must be larger than the image limit.
app.use(express.json({ limit: "2mb" }));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.use("/uploads", express.static(uploadDirectory));


/*
==================================================
UPLOAD ATTACHMENT
==================================================
*/

app.post(
    "/api/upload",
    authenticateToken,
    express.raw({ type: () => true, limit: "50mb" }),
    async (req, res) => {

        try {

            const originalName = decodeURIComponent(
                req.headers["x-file-name"] || "attachment"
            ).replace(/[\\/]/g, "_");

            const extension = path.extname(originalName).toLowerCase();
            const documentExtension =
                [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"].includes(extension);

            const allowedType =
                /^(image\/|video\/|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.|text\/plain$)/.test(req.headers["content-type"] || "") || documentExtension;

            if (!allowedType || !req.body || !req.body.length) {
                return res.status(400).json({
                    message: "Unsupported or empty file"
                });
            }

            const storedName = `${crypto.randomBytes(16).toString("hex")}${extension}`;
            const storedPath = path.join(uploadDirectory, storedName);

            await fs.promises.writeFile(storedPath, req.body);

            return res.status(201).json({
                name: originalName,
                type: req.headers["content-type"],
                size: req.body.length,
                url: `/uploads/${storedName}`
            });

        } catch (error) {
            console.error("Upload error:", error);
            return res.status(500).json({ message: "Unable to upload file" });
        }
    }
);


/*
==================================================
MONGODB
==================================================
*/

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {

        console.log(
            "MongoDB connected successfully"
        );

    })
    .catch((error) => {

        console.error(
            "MongoDB connection failed:",
            error
        );

    });


/*
==================================================
ONLINE USERS

userId -> socketId
==================================================
*/

const onlineUsers = new Map();


/*
==================================================
REGISTER
==================================================
*/

app.post(
    "/api/register",
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;


            if (!username || !password) {

                return res.status(400).json({
                    message:
                        "Username and password are required"
                });

            }


            const cleanUsername =
                username.trim();


            if (
                cleanUsername.length < 3 ||
                cleanUsername.length > 30
            ) {

                return res.status(400).json({
                    message:
                        "Username must be between 3 and 30 characters"
                });

            }


            if (password.length < 6) {

                return res.status(400).json({
                    message:
                        "Password must be at least 6 characters"
                });

            }


            const existingUser =
                await User.findOne({
                    username: cleanUsername
                });


            if (existingUser) {

                return res.status(409).json({
                    message:
                        "Username already exists"
                });

            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );


            const user =
                await User.create({

                    username:
                        cleanUsername,

                    password:
                        hashedPassword

                });


            res.status(201).json({

                message:
                    "Registration successful",

                user: {

                    id:
                        user._id,

                    username:
                        user.username,

                    displayName:
                        user.displayName || "",

                    bio:
                        user.bio || "",

                    profilePicture:
                        user.profilePicture || "",

                    notifications:
                        user.notifications !== false

                }

            });


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error"
            });

        }

    }
);


/*
==================================================
LOGIN
==================================================
*/

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;


            if (!username || !password) {

                return res.status(400).json({
                    message:
                        "Username and password are required"
                });

            }


            const user =
                await User.findOne({
                    username:
                        username.trim()
                });


            if (!user) {

                return res.status(401).json({
                    message:
                        "Invalid username or password"
                });

            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                return res.status(401).json({
                    message:
                        "Invalid username or password"
                });

            }


            const token =
                jwt.sign(

                    {
                        id:
                            user._id.toString(),

                        username:
                            user.username

                    },

                    process.env.JWT_SECRET,

                    {
                        expiresIn:
                            "24h"
                    }

                );


            res.json({

                message:
                    "Login successful",

                token,

                user: {

                    id:
                        user._id.toString(),

                    username:
                        user.username

                }

            });


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            res.status(500).json({
                message:
                    "Server error"
            });

        }

    }
);


/*
==================================================
DELETE ACCOUNT
==================================================
*/

app.delete(
    "/api/account",
    authenticateToken,
    async (req, res) => {

        try {

            const userId = req.user.id;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    message: "Account not found"
                });
            }

            await Message.deleteMany({
                $or: [
                    { sender: userId },
                    { receiver: userId }
                ]
            });

            await User.deleteOne({ _id: userId });

            const socketId = onlineUsers.get(userId);

            if (socketId) {
                io.to(socketId).emit("account deleted");
                io.sockets.sockets.get(socketId)?.disconnect(true);
                onlineUsers.delete(userId);
            }

            io.emit("user deleted", { userId });
            sendOnlineUsers();

            return res.json({
                message: "Account deleted successfully"
            });

        } catch (error) {

            console.error("Delete account error:", error);

            return res.status(500).json({
                message: "Unable to delete account"
            });

        }
    }
);


/*
==================================================
PROFILE
==================================================
*/

app.get(
    "/api/profile",
    authenticateToken,
    async (req, res) => {

        try {

            const user = await User.findById(
                req.user.id,
                "username displayName bio profilePicture notifications lastSeen"
            );

            if (!user) {
                return res.status(404).json({ message: "Profile not found" });
            }

            return res.json(user);

        } catch (error) {
            console.error("Get profile error:", error);
            return res.status(500).json({ message: "Unable to load profile" });
        }
    }
);

app.patch(
    "/api/profile",
    authenticateToken,
    async (req, res) => {

        try {

            const { displayName, bio, profilePicture, notifications } = req.body;

            if (displayName !== undefined && String(displayName).trim().length > 50) {
                return res.status(400).json({ message: "Display name must be 50 characters or fewer" });
            }

            if (bio !== undefined && String(bio).trim().length > 160) {
                return res.status(400).json({ message: "Bio must be 160 characters or fewer" });
            }

            if (profilePicture && (!String(profilePicture).startsWith("data:image/") || String(profilePicture).length > 1500000)) {
                return res.status(400).json({ message: "Profile picture must be a valid image under 1 MB" });
            }

            const update = {};

            if (displayName !== undefined) update.displayName = String(displayName).trim();
            if (bio !== undefined) update.bio = String(bio).trim();
            if (profilePicture !== undefined) update.profilePicture = profilePicture;
            if (notifications !== undefined) update.notifications = Boolean(notifications);

            const user = await User.findByIdAndUpdate(
                req.user.id,
                { $set: update },
                { new: true, runValidators: true }
            ).select("username displayName bio profilePicture notifications lastSeen");

            io.emit("profile updated", {
                userId: req.user.id,
                displayName: user.displayName,
                profilePicture: user.profilePicture
            });

            return res.json(user);

        } catch (error) {
            console.error("Update profile error:", error);
            return res.status(500).json({ message: "Unable to update profile" });
        }
    }
);

app.patch(
    "/api/password",
    authenticateToken,
    async (req, res) => {

        try {

            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword || newPassword.length < 6) {
                return res.status(400).json({ message: "New password must be at least 6 characters" });
            }

            const user = await User.findById(req.user.id);

            if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
                return res.status(401).json({ message: "Current password is incorrect" });
            }

            user.password = await bcrypt.hash(newPassword, 12);
            await user.save();

            return res.json({ message: "Password changed successfully" });

        } catch (error) {
            console.error("Change password error:", error);
            return res.status(500).json({ message: "Unable to change password" });
        }
    }
);


/*
==================================================
REMOVE CHAT
==================================================
*/

app.delete(
    "/api/chats/:userId",
    authenticateToken,
    async (req, res) => {

        try {

            const userId = req.user.id;
            const otherUserId = req.params.userId;

            if (userId === otherUserId) {
                return res.status(400).json({
                    message: "You cannot remove yourself"
                });
            }

            await User.findByIdAndUpdate(
                userId,
                { $addToSet: { hiddenChats: otherUserId } }
            );

            return res.json({
                message: "Chat removed from your list"
            });

        } catch (error) {

            console.error("Remove chat error:", error);

            return res.status(500).json({
                message: "Unable to remove chat"
            });

        }
    }
);


/*
==================================================
GET USERS

V2.1

Returns:

- username
- online status
- last seen
- last message
- unread count
==================================================
*/

app.get(
    "/api/users",
    authenticateToken,
    async (req, res) => {

        try {

            const currentUserId =
                req.user.id;

            const currentUser =
                await User.findById(
                    currentUserId,
                    "hiddenChats"
                );

            const hiddenChats =
                currentUser?.hiddenChats || [];


            /*
            Get all users except current user
            */

            const users =
                await User.find(
                    {
                        _id: {
                            $ne: currentUserId,
                            $nin: hiddenChats
                        }
                    },
                    "username displayName bio profilePicture lastSeen"
                )
                .sort({
                    username: 1
                });


            /*
            Build conversation information
            */

            const result = [];


            for (const user of users) {

                const otherUserId =
                    user._id.toString();


                /*
                Find latest message
                between current user
                and this user
                */

                const lastMessage =
                    await Message.findOne({

                        $or: [

                            {
                                sender:
                                    currentUserId,

                                receiver:
                                    otherUserId
                            },

                            {
                                sender:
                                    otherUserId,

                                receiver:
                                    currentUserId
                            }

                        ]

                    })
                    .sort({
                        createdAt: -1
                    });


                /*
                Count unread messages

                Messages where:

                sender = other user
                receiver = current user
                read = false
                */

                const unreadCount =
                    await Message.countDocuments({

                        sender:
                            otherUserId,

                        receiver:
                            currentUserId,

                        read:
                            false

                    });


                result.push({

                    id:
                        otherUserId,

                    username:
                        user.username,

                    displayName:
                        user.displayName,

                    profilePicture:
                        user.profilePicture,

                    online:
                        onlineUsers.has(
                            otherUserId
                        ),

                    lastSeen:
                        user.lastSeen,

                    lastMessage:
                        lastMessage
                            ? {

                                id:
                                    lastMessage._id,

                                message:
                                    lastMessage.message,

                                sender:
                                    lastMessage.sender.toString(),

                                receiver:
                                    lastMessage.receiver.toString(),

                                read:
                                    lastMessage.read,

                                timestamp:
                                    lastMessage.createdAt

                            }
                            : null,

                    unreadCount:
                        unreadCount

                });

            }


            /*
            Sort conversations:

            1. Users with messages first
            2. Latest message first
            3. Users without messages alphabetically
            */

            result.sort(
                (a, b) => {

                    if (
                        a.lastMessage &&
                        !b.lastMessage
                    ) {

                        return -1;

                    }


                    if (
                        !a.lastMessage &&
                        b.lastMessage
                    ) {

                        return 1;

                    }


                    if (
                        a.lastMessage &&
                        b.lastMessage
                    ) {

                        return (
                            new Date(
                                b.lastMessage.timestamp
                            ) -
                            new Date(
                                a.lastMessage.timestamp
                            )
                        );

                    }


                    return a.username.localeCompare(
                        b.username
                    );

                }
            );


            res.json(result);


        } catch (error) {

            console.error(
                "Get users error:",
                error
            );


            res.status(500).json({
                message:
                    "Unable to get users"
            });

        }

    }
);


/*
==================================================
GET CHAT HISTORY
==================================================
*/

app.get(
    "/api/messages/:userId",
    authenticateToken,
    async (req, res) => {

        try {

            const currentUser =
                req.user.id;

            const otherUser =
                req.params.userId;


            /*
            Get messages
            */

            const messages =
                await Message.find({

                    $or: [

                        {
                            sender:
                                currentUser,

                            receiver:
                                otherUser
                        },

                        {
                            sender:
                                otherUser,

                            receiver:
                                currentUser
                        }

                    ]

                })
                .sort({
                    createdAt: 1
                });


            /*
            Mark incoming messages
            as read
            */

            await Message.updateMany(

                {

                    sender:
                        otherUser,

                    receiver:
                        currentUser,

                    read:
                        false

                },

                {

                    $set: {
                        read: true
                    }

                }

            );


            /*
            Notify sender that messages
            have been read
            */

            const senderSocket =
                onlineUsers.get(
                    otherUser
                );


            if (senderSocket) {

                io.to(
                    senderSocket
                ).emit(
                    "messages read",
                    {
                        userId:
                            currentUser
                    }
                );

            }


            res.json(messages);


        } catch (error) {

            console.error(
                "Get messages error:",
                error
            );


            res.status(500).json({
                message:
                    "Unable to load messages"
            });

        }

    }
);


/*
==================================================
SOCKET AUTHENTICATION
==================================================
*/

io.use(
    (socket, next) => {

        try {

            const token =
                socket.handshake.auth.token;


            if (!token) {

                return next(
                    new Error(
                        "Authentication required"
                    )
                );

            }


            const decoded =
                jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );


            socket.user =
                decoded;


            next();


        } catch (error) {

            next(
                new Error(
                    "Invalid token"
                )
            );

        }

    }
);


/*
==================================================
GROUP API
==================================================
*/

app.get("/api/groups", authenticateToken, async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user.id })
            .populate("members", "username displayName profilePicture")
            .sort({ updatedAt: -1 });
        res.json(groups.map(group => ({
            ...group.toObject(),
            isAdmin: group.admins.some(id => id.toString() === req.user.id),
            muted: group.mutedBy.some(id => id.toString() === req.user.id)
        })));
    } catch (error) {
        console.error("Get groups error:", error);
        res.status(500).json({ message: "Unable to load groups" });
    }
});

app.post("/api/groups", authenticateToken, async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
        if (!name || name.length > 60) return res.status(400).json({ message: "Group name is required" });

        const members = [...new Set([req.user.id, ...memberIds])];
        const group = await Group.create({
            name,
            description: String(req.body.description || "").trim().slice(0, 160),
            owner: req.user.id,
            admins: [req.user.id],
            members
        });
        res.status(201).json(group);
    } catch (error) {
        console.error("Create group error:", error);
        res.status(500).json({ message: "Unable to create group" });
    }
});

app.get("/api/groups/:groupId/messages", authenticateToken, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.groupId, members: req.user.id });
        if (!group) return res.status(403).json({ message: "You are not a group member" });
        const messages = await Message.find({ group: group._id }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Unable to load group messages" });
    }
});

app.patch("/api/groups/:groupId/members", authenticateToken, async (req, res) => {
    try {
        const { userId, action } = req.body;
        const group = await Group.findOne({ _id: req.params.groupId, admins: req.user.id });
        if (!group) return res.status(403).json({ message: "Only group admins can manage members" });
        if (action === "add") group.members.addToSet(userId);
        else if (action === "remove" && group.owner.toString() !== userId) {
            group.members.pull(userId);
            group.admins.pull(userId);
        }
        else if (action === "promote" && group.members.some(id => id.toString() === userId)) group.admins.addToSet(userId);
        else if (action === "demote" && group.owner.toString() !== userId) group.admins.pull(userId);
        else return res.status(400).json({ message: "Invalid member action" });
        await group.save();
        io.emit("group updated", { groupId: group._id.toString() });
        res.json(group);
    } catch (error) {
        res.status(500).json({ message: "Unable to update group members" });
    }
});

app.patch("/api/groups/:groupId/mute", authenticateToken, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.groupId, members: req.user.id });
        if (!group) return res.status(403).json({ message: "You are not a group member" });
        if (req.body.muted) group.mutedBy.addToSet(req.user.id);
        else group.mutedBy.pull(req.user.id);
        await group.save();
        res.json({ muted: req.body.muted === true });
    } catch (error) {
        res.status(500).json({ message: "Unable to update mute setting" });
    }
});


/*
==================================================
SOCKET CONNECTION
==================================================
*/

io.on(
    "connection",
    (socket) => {

        const userId =
            socket.user.id;

        const username =
            socket.user.username;


        console.log(
            `${username} connected`
        );


        /*
        Add user to online map
        */

        onlineUsers.set(
            userId,
            socket.id
        );


        /*
        Update user's last seen
        */

        User.findByIdAndUpdate(
            userId,
            {
                lastSeen:
                    new Date()
            }
        ).catch(
            error => console.error(error)
        );


        /*
        Notify everyone
        */

        io.emit(
            "user online",
            {
                userId,
                username
            }
        );


        sendOnlineUsers();

        socket.on("join groups", async groupIds => {
            if (!Array.isArray(groupIds)) return;
            const groups = await Group.find({ _id: { $in: groupIds }, members: userId }, "_id");
            groups.forEach(group => socket.join(`group:${group._id}`));
        });

        socket.on("group message", async data => {
            try {
                const group = await Group.findOne({ _id: data.groupId, members: userId });
                const cleanMessage = String(data.message || "").trim();
                if (!group || (!cleanMessage && !data.attachment) || cleanMessage.length > 2000) return;

                const newMessage = await Message.create({
                    sender: userId,
                    group: group._id,
                    message: cleanMessage,
                    attachment: data.attachment || undefined,
                    replyTo: data.replyTo || undefined
                });

                await Group.updateOne({ _id: group._id }, { $set: { updatedAt: new Date() } });

                io.to(`group:${group._id}`).emit("group message", {
                    id: newMessage._id.toString(),
                    groupId: group._id.toString(),
                    sender: userId,
                    senderName: username,
                    message: cleanMessage,
                    attachment: data.attachment || null,
                    replyTo: data.replyTo || null,
                    reactions: [],
                    pinned: false,
                    timestamp: newMessage.createdAt
                });
            } catch (error) {
                console.error("Group message error:", error);
            }
        });

        socket.on("message reaction", async data => {
            try {
                const message = await Message.findOne({ _id: data.messageId });
                if (!message || !message.group) return;
                const group = await Group.findOne({ _id: message.group, members: userId });
                if (!group || !data.emoji) return;
                message.reactions = message.reactions.filter(reaction => reaction.user.toString() !== userId);
                message.reactions.push({ user: userId, emoji: String(data.emoji).slice(0, 8) });
                await message.save();
                io.to(`group:${group._id}`).emit("message reaction", {
                    messageId: message._id.toString(),
                    reactions: message.reactions
                });
            } catch (error) {
                console.error("Reaction error:", error);
            }
        });

        socket.on("pin message", async data => {
            try {
                const message = await Message.findOne({ _id: data.messageId });
                if (!message || !message.group) return;
                const group = await Group.findOne({ _id: message.group, members: userId });
                if (!group || !group.admins.some(id => id.toString() === userId)) return;
                message.pinned = data.pinned !== false;
                message.pinnedBy = message.pinned ? userId : undefined;
                await message.save();
                io.to(`group:${group._id}`).emit("message pinned", {
                    messageId: message._id.toString(),
                    pinned: message.pinned
                });
            } catch (error) {
                console.error("Pin message error:", error);
            }
        });


        /*
        =========================================
        PRIVATE MESSAGE
        =========================================
        */

        socket.on(
            "private message",
            async (data) => {

                try {

                    const {
                        receiverId,
                        message,
                        attachment
                    } = data;


                    if (
                        !receiverId ||
                        (!message && !attachment)
                    ) {

                        return;

                    }


                    const cleanMessage =
                        (message || "").trim();


                    if (!cleanMessage && !attachment) {

                        return;

                    }


                    if (
                        cleanMessage.length >
                        2000
                    ) {

                        return;

                    }


                    /*
                    Verify receiver exists
                    */

                    const receiver =
                        await User.findById(
                            receiverId
                        );


                    if (!receiver) {

                        return;

                    }


                    /*
                    Save message
                    */

                    const newMessage =
                        await Message.create({

                            sender:
                                userId,

                            receiver:
                                receiverId,

                            message:
                                cleanMessage,

                            attachment:
                                attachment || undefined

                        });

                    await Promise.all([
                        User.findByIdAndUpdate(
                            userId,
                            { $pull: { hiddenChats: receiverId } }
                        ),
                        User.findByIdAndUpdate(
                            receiverId,
                            { $pull: { hiddenChats: userId } }
                        )
                    ]);


                    const messageData = {

                        id:
                            newMessage._id.toString(),

                        sender:
                            userId,

                        receiver:
                            receiverId,

                        message:
                            cleanMessage,

                        attachment:
                            attachment || null,

                        read:
                            false,

                        edited:
                            false,

                        timestamp:
                            newMessage.createdAt

                    };


                    /*
                    Send to sender
                    */

                    socket.emit(
                        "private message",
                        messageData
                    );


                    /*
                    Send to receiver
                    */

                    const receiverSocket =
                        onlineUsers.get(
                            receiverId
                        );


                    if (receiverSocket) {

                        io.to(
                            receiverSocket
                        ).emit(
                            "private message",
                            messageData
                        );

                    }


                    /*
                    Notify both users that
                    conversation list changed
                    */

                    socket.emit(
                        "conversation updated"
                    );


                    if (receiverSocket) {

                        io.to(
                            receiverSocket
                        ).emit(
                            "conversation updated"
                        );

                    }


                } catch (error) {

                    console.error(
                        "Message error:",
                        error
                    );

                }

            }
        );


        /*
        =========================================
        TYPING
        =========================================
        */

        socket.on(
            "typing",
            (receiverId) => {

                const receiverSocket =
                    onlineUsers.get(
                        receiverId
                    );


                if (receiverSocket) {

                    io.to(
                        receiverSocket
                    ).emit(
                        "user typing",
                        {
                            userId,
                            username
                        }
                    );

                }

            }
        );


        /*
        =========================================
        STOP TYPING
        =========================================
        */

        socket.on(
            "stop typing",
            (receiverId) => {

                const receiverSocket =
                    onlineUsers.get(
                        receiverId
                    );


                if (receiverSocket) {

                    io.to(
                        receiverSocket
                    ).emit(
                        "user stopped typing",
                        {
                            userId
                        }
                    );

                }

            }
        );


        /*
        =========================================
        MARK READ
        =========================================
        */

        socket.on(
            "mark read",
            async (senderId) => {

                try {

                    await Message.updateMany(

                        {

                            sender:
                                senderId,

                            receiver:
                                userId,

                            read:
                                false

                        },

                        {

                            $set: {
                                read: true
                            }

                        }

                    );


                    const senderSocket =
                        onlineUsers.get(
                            senderId
                        );


                    if (senderSocket) {

                        io.to(
                            senderSocket
                        ).emit(
                            "messages read",
                            {
                                userId
                            }
                        );

                    }


                    /*
                    Refresh conversation
                    list for current user
                    */

                    socket.emit(
                        "conversation updated"
                    );


                    if (senderSocket) {

                        io.to(
                            senderSocket
                        ).emit(
                            "conversation updated"
                        );

                    }


                } catch (error) {

                    console.error(
                        "Mark read error:",
                        error
                    );

                }

            }
        );


        /*
        =========================================
        DELETE MESSAGE
        =========================================
        */

        socket.on(
            "delete message",
            async (messageId) => {

                try {

                    const message =
                        await Message.findOne({

                            _id:
                                messageId,

                            $or: [
                                { sender: userId },
                                { receiver: userId }
                            ]

                        });


                    if (!message) {

                        return;

                    }


                    await Message.deleteOne({

                        _id:
                            messageId

                    });


                    const participants = new Set([
                        message.sender.toString(),
                        message.receiver.toString()
                    ]);

                    for (const participantId of participants) {
                        const participantSocket = onlineUsers.get(participantId);

                        if (participantSocket) {
                            io.to(participantSocket).emit("message deleted", { messageId });
                            io.to(participantSocket).emit("conversation updated");
                        }
                    }


                } catch (error) {

                    console.error(
                        "Delete message error:",
                        error
                    );

                }

            }
        );


        /*
        =========================================
        EDIT MESSAGE
        =========================================
        */

        socket.on(
            "edit message",
            async (data) => {

                try {

                    const {
                        messageId,
                        message
                    } = data;


                    if (!message) {

                        return;

                    }


                    const cleanMessage =
                        message.trim();


                    if (!cleanMessage) {

                        return;

                    }

                    if (
                        cleanMessage.length >
                        2000 ||
                        !messageId
                    ) {

                        return;

                    }


                    const updated =
                        await Message.findOneAndUpdate(

                            {

                                _id:
                                    messageId,

                                sender:
                                    userId

                            },

                            {

                                $set: {

                                    message:
                                        cleanMessage,

                                    edited:
                                        true

                                }

                            },

                            {
                                new: true
                            }

                        );


                    if (!updated) {

                        return;

                    }


                    const messageData = {

                        id:
                            updated._id.toString(),

                        sender:
                            updated.sender.toString(),

                        receiver:
                            updated.receiver.toString(),

                        message:
                            updated.message,

                        edited:
                            true,

                        read:
                            updated.read,

                        timestamp:
                            updated.createdAt

                    };


                    socket.emit(
                        "message edited",
                        messageData
                    );


                    const receiverSocket =
                        onlineUsers.get(
                            updated.receiver.toString()
                        );


                    if (receiverSocket) {

                        io.to(
                            receiverSocket
                        ).emit(
                            "message edited",
                            messageData
                        );


                        io.to(
                            receiverSocket
                        ).emit(
                            "conversation updated"
                        );

                    }


                    socket.emit(
                        "conversation updated"
                    );


                } catch (error) {

                    console.error(
                        "Edit message error:",
                        error
                    );

                }

            }
        );


        /*
        =========================================
        DISCONNECT
        =========================================
        */

        socket.on(
            "disconnect",
            async () => {

                console.log(
                    `${username} disconnected`
                );


                /*
                Remove from online users
                */

                onlineUsers.delete(
                    userId
                );


                /*
                Update last seen
                */

                const lastSeen =
                    new Date();


                try {

                    await User.findByIdAndUpdate(

                        userId,

                        {
                            lastSeen
                        }

                    );

                } catch (error) {

                    console.error(
                        error
                    );

                }


                /*
                Notify everyone
                */

                io.emit(
                    "user offline",
                    {
                        userId,
                        username,
                        lastSeen
                    }
                );


                sendOnlineUsers();

            }
        );

    }
);


/*
==================================================
ONLINE USERS
==================================================
*/

function sendOnlineUsers() {

    io.emit(
        "online users",
        Array.from(
            onlineUsers.keys()
        )
    );

}


/*
==================================================
START SERVER
==================================================
*/
// to acces into local host
// server.listen(
//     PORT,
//     () => {

//         console.log(
//             `Server running on http://localhost:${PORT}`
//         );

//     }
// );

// Return a useful API response instead of an HTML stack trace for oversized
// JSON requests, including profile-picture uploads.
app.use((error, req, res, next) => {

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            message: "Uploaded data is too large"
        });
    }

    return next(error);
});

//To access into azure server
server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

    }
);
