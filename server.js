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

const server =
    http.createServer(app);

const io =
    new Server(server, {

        cors: {
            origin: "*"
        }

    });

const PORT =
    process.env.PORT || 3000;


/*
==================================================
MIDDLEWARE
==================================================
*/

app.use(cors());

app.use(
    express.json()
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/*
==================================================
MONGODB
==================================================
*/

mongoose
    .connect(
        process.env.MONGODB_URI
    )
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

const onlineUsers =
    new Map();


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


            if (
                !username ||
                !password
            ) {

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


            if (
                password.length < 6
            ) {

                return res.status(400).json({

                    message:
                        "Password must be at least 6 characters"

                });

            }


            /*
            Check existing user
            */

            const existingUser =
                await User.findOne({

                    username:
                        cleanUsername

                });


            if (existingUser) {

                return res.status(409).json({

                    message:
                        "Username already exists"

                });

            }


            /*
            Hash password
            */

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );


            /*
            Create user
            */

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
                        user._id.toString(),

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


            if (
                !username ||
                !password
            ) {

                return res.status(400).json({

                    message:
                        "Username and password are required"

                });

            }


            /*
            Find user
            */

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


            /*
            Check password
            */

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


            /*
            Generate JWT
            */

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
DELETE USER ACCOUNT
==================================================
*/

app.delete(
    "/api/user",
    authenticateToken,
    async (req, res) => {

        try {

            const userId =
                req.user.id;


            /*
            Delete all messages
            belonging to this user
            */

            await Message.deleteMany({

                $or: [

                    {
                        sender:
                            userId
                    },

                    {
                        receiver:
                            userId
                    }

                ]

            });


            /*
            Delete user
            */

            const deletedUser =
                await User.findByIdAndDelete(
                    userId
                );


            if (!deletedUser) {

                return res.status(404).json({

                    message:
                        "User not found"

                });

            }


            /*
            Remove user from online users
            */

            onlineUsers.delete(
                userId
            );


            /*
            Notify all connected users
            */

            sendOnlineUsers();


            io.emit(
                "user deleted",
                {
                    userId:
                        userId
                }
            );


            res.json({

                message:
                    "Account deleted successfully"

            });


        } catch (error) {

            console.error(
                "Delete account error:",
                error
            );


            res.status(500).json({

                message:
                    "Unable to delete account"

            });

        }

    }
);


/*
==================================================
GET USERS

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

                    username:
                        1

                });


            const result = [];


            /*
            Build user list
            */

            for (
                const user of users
            ) {

                const otherUserId =
                    user._id.toString();


                /*
                =================================
                LAST MESSAGE
                =================================
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

                        createdAt:
                            -1

                    });


                /*
                =================================
                UNREAD COUNT
                =================================

                IMPORTANT:

                read:false = unread
                read:true  = already read
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


                /*
                Add user
                */

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
                                    lastMessage._id.toString(),

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
            =================================
            SORT USERS
            =================================

            1. Users with messages
            2. Latest message first
            3. Alphabetically
            */

            result.sort(
                (a, b) => {

                    /*
                    User with message first
                    */

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


                    /*
                    Latest message first
                    */

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


                    /*
                    Alphabetical
                    */

                    return a.username.localeCompare(
                        b.username
                    );

                }
            );


            res.json(
                result
            );


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

IMPORTANT:

This API ONLY gets messages.

It does NOT mark messages as read.

Read status is handled by Socket.IO
"mark read".
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
            Get conversation
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

                    createdAt:
                        1

                });


            /*
            Return messages
            */

            res.json(
                messages
            );


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


            /*
            Verify JWT
            */

            const decoded =
                jwt.verify(
                    token,
                    process.env.JWT_SECRET
                );


            socket.user =
                decoded;


            next();


        } catch (error) {

            console.error(
                "Socket authentication error:",
                error
            );


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

        console.log(
            "User Connected:",
            socket.id
        );


        /*
        ==========================================
        CURRENT USER
        ==========================================
        */

        const userId =
            socket.user.id;

        const username =
            socket.user.username;


        /*
        ==========================================
        ADD USER ONLINE
        ==========================================
        */

        onlineUsers.set(
            userId,
            socket.id
        );


        console.log(
            `${username} is online`
        );


        /*
        Notify everyone
        */

        sendOnlineUsers();


        /*
==================================================
PRIVATE MESSAGE
==================================================
*/

socket.on(
    "private message",
    async (data) => {

        try {

            const {
                receiverId,
                message
            } = data;


            /*
            Validate message
            */

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


            /*
            Maximum message length
            */

            if (
                cleanMessage.length > 2000
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

                console.log(
                    "Receiver not found:",
                    receiverId
                );

                return;

            }


            /*
            =========================================
            SAVE MESSAGE TO MONGODB
            =========================================
            */

            const newMessage =
                await Message.create({

                    sender:
                        userId,

                    receiver:
                        receiverId,

                    message:
                        cleanMessage,

                    read:
                        false

                });


            /*
            =========================================
            MESSAGE DATA
            =========================================
            */

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
            =========================================
            SEND MESSAGE BACK TO SENDER
            =========================================
            */

            socket.emit(
                "private message",
                messageData
            );


            /*
            =========================================
            SEND MESSAGE TO RECEIVER
            =========================================
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
            =========================================
            UPDATE CONVERSATION LIST
            =========================================
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


            socket.emit(
                "message error",
                {
                    message:
                        "Unable to send message"
                }
            );

        }

    }
);



        /*
        ==========================================
        MARK MESSAGES AS READ
        ==========================================
        */

        socket.on(
            "mark read",
            async (otherUserId) => {

                try {

                    /*
                    Mark unread incoming
                    messages as read
                    */

                    const result =
                        await Message.updateMany(

                            {

                                sender:
                                    otherUserId,

                                receiver:
                                    userId,

                                read:
                                    false

                            },

                            {

                                $set: {

                                    read:
                                        true

                                }

                            }

                        );


                    console.log(

                        `${username} read ${result.modifiedCount} messages from ${otherUserId}`

                    );


                    /*
                    =================================
                    NOTIFY SENDER
                    =================================
                    */

                    const senderSocket =
                        onlineUsers.get(
                            otherUserId
                        );


                    if (
                        senderSocket
                    ) {

                        io.to(
                            senderSocket
                        ).emit(

                            "messages read",

                            {

                                userId:
                                    userId

                            }

                        );

                    }


                    /*
                    =================================
                    UPDATE CURRENT USER
                    =================================
                    */

                    socket.emit(

                        "messages read",

                        {

                            userId:
                                otherUserId

                        }

                    );


                    /*
                    Update conversation list
                    */

                    socket.emit(
                        "conversation updated"
                    );


                } catch (error) {

                    console.error(
                        "Mark read error:",
                        error
                    );

                }

            }
        );


        /*
        ==========================================
        TYPING
        ==========================================
        */

        socket.on(
            "typing",
            (otherUserId) => {

                try {

                    const receiverSocket =
                        onlineUsers.get(
                            otherUserId
                        );


                    if (
                        receiverSocket
                    ) {

                        io.to(
                            receiverSocket
                        ).emit(

                            "typing",

                            {

                                userId:
                                    userId,

                                username:
                                    username

                            }

                        );

                    }

                } catch (error) {

                    console.error(
                        "Typing error:",
                        error
                    );

                }

            }
        );


        /*
        ==========================================
        STOP TYPING
        ==========================================
        */

        socket.on(
            "stop typing",
            (otherUserId) => {

                try {

                    const receiverSocket =
                        onlineUsers.get(
                            otherUserId
                        );


                    if (
                        receiverSocket
                    ) {

                        io.to(
                            receiverSocket
                        ).emit(

                            "stop typing",

                            {

                                userId:
                                    userId

                            }

                        );

                    }

                } catch (error) {

                    console.error(
                        "Stop typing error:",
                        error
                    );

                }

            }
        );


        /*
        ==========================================
        DISCONNECT
        ==========================================
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

                try {

                    await User.findByIdAndUpdate(

                        userId,

                        {

                            lastSeen:
                                new Date()

                        }

                    );

                } catch (error) {

                    console.error(
                        "Last seen update error:",
                        error
                    );

                }


                /*
                Notify everyone
                */

                sendOnlineUsers();

            }
        );

    }
);


/*
==================================================
SEND ONLINE USERS
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

server.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

    }
);