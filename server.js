require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const User = require("./models/User");
const Message = require("./models/Message");
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


/*
==================================================
MIDDLEWARE
==================================================
*/

app.use(cors());

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
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
                        user.username

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


            /*
            Get all users except current user
            */

            const users =
                await User.find(
                    {
                        _id: {
                            $ne:
                                currentUserId
                        }
                    },
                    "username lastSeen"
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
                            true

                    });


                result.push({

                    id:
                        otherUserId,

                    username:
                        user.username,

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
                        message
                    } = data;


                    if (
                        !receiverId ||
                        !message
                    ) {

                        return;

                    }


                    const cleanMessage =
                        message.trim();


                    if (!cleanMessage) {

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
                                cleanMessage

                        });


                    const messageData = {

                        id:
                            newMessage._id.toString(),

                        sender:
                            userId,

                        receiver:
                            receiverId,

                        message:
                            cleanMessage,

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

                            sender:
                                userId

                        });


                    if (!message) {

                        return;

                    }


                    await Message.deleteOne({

                        _id:
                            messageId

                    });


                    socket.emit(
                        "message deleted",
                        {
                            messageId
                        }
                    );


                    const receiverSocket =
                        onlineUsers.get(
                            message.receiver.toString()
                        );


                    if (receiverSocket) {

                        io.to(
                            receiverSocket
                        ).emit(
                            "message deleted",
                            {
                                messageId
                            }
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