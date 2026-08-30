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

const authenticateToken =
    require("./middleware/auth");


/*
=========================================
APP CONFIGURATION
=========================================
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
=========================================
MIDDLEWARE
=========================================
*/

app.use(
    cors()
);

app.use(
    express.json()
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/*
=========================================
MONGODB CONNECTION
=========================================
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
=========================================
ONLINE USERS
=========================================

Map:

socket.id -> userId

*/

const onlineUsers =
    new Map();


/*
=========================================
REGISTER API
=========================================
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


            /*
            Check existing user
            */

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

                    id: user._id,

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
=========================================
LOGIN API
=========================================
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


            /*
            Compare password
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
            Create JWT
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
                        user._id,

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
=========================================
GET USERS
=========================================
*/

app.get(
    "/api/users",
    authenticateToken,
    async (req, res) => {

        try {

            const users =
                await User.find(
                    {},
                    "username lastSeen"
                )
                .sort({
                    username: 1
                });


            const result =
                users.map(
                    (user) => ({

                        id:
                            user._id,

                        username:
                            user.username,

                        online:
                            onlineUsers.has(
                                user._id.toString()
                            ),

                        lastSeen:
                            user.lastSeen

                    })
                );


            res.json(result);


        } catch (error) {

            console.error(
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
=========================================
GET CHAT HISTORY
=========================================
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
            Mark received messages
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


            res.json(messages);


        } catch (error) {

            console.error(
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
=========================================
SOCKET AUTHENTICATION
=========================================
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
=========================================
SOCKET CONNECTION
=========================================
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
        Store online user
        */

        onlineUsers.set(
            userId,
            socket.id
        );


        /*
        Broadcast online status
        */

        io.emit(
            "user online",
            {
                userId,
                username
            }
        );


        /*
        Send online users
        */

        sendOnlineUsers();


        /*
        ====================================
        SEND MESSAGE
        ====================================
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


                    /*
                    Find receiver socket
                    */

                    const receiverSocket =
                        onlineUsers.get(
                            receiverId
                        );


                    const messageData = {

                        id:
                            newMessage._id,

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

                    if (receiverSocket) {

                        io.to(
                            receiverSocket
                        ).emit(
                            "private message",
                            messageData
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
        ====================================
        TYPING
        ====================================
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
        ====================================
        STOP TYPING
        ====================================
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
        ====================================
        READ MESSAGE
        ====================================
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

                } catch (error) {

                    console.error(
                        error
                    );

                }

            }
        );


        /*
        ====================================
        DELETE MESSAGE
        ====================================
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

                    }

                } catch (error) {

                    console.error(
                        error
                    );

                }

            }
        );


        /*
        ====================================
        EDIT MESSAGE
        ====================================
        */

        socket.on(
            "edit message",
            async (data) => {

                try {

                    const {
                        messageId,
                        message
                    } = data;


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
                                        message.trim(),

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
                            updated._id,

                        sender:
                            updated.sender,

                        receiver:
                            updated.receiver,

                        message:
                            updated.message,

                        edited:
                            true,

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

                    }

                } catch (error) {

                    console.error(
                        error
                    );

                }

            }
        );


        /*
        ====================================
        DISCONNECT
        ====================================
        */

        socket.on(
            "disconnect",
            async () => {

                console.log(
                    `${username} disconnected`
                );


                onlineUsers.delete(
                    userId
                );


                await User.findByIdAndUpdate(

                    userId,

                    {
                        lastSeen:
                            new Date()
                    }

                );


                io.emit(
                    "user offline",
                    {
                        userId,
                        username,
                        lastSeen:
                            new Date()
                    }
                );


                sendOnlineUsers();

            }
        );

    }
);


/*
=========================================
ONLINE USER LIST
=========================================
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
=========================================
START SERVER
=========================================
*/

server.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

    }
);