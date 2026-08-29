const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

const PORT = 3000;

// Serve frontend files
app.use(express.static("public"));

// Store currently connected users
const onlineUsers = new Map();

/*
========================================
SOCKET.IO CONNECTION
========================================
*/

io.on("connection", (socket) => {

    console.log(`Socket connected: ${socket.id}`);

    /*
    ========================================
    USER LOGIN / JOIN CHAT
    ========================================
    */

    socket.on("user joined", (username) => {

        if (!username) {
            return;
        }

        // Store username against socket ID
        onlineUsers.set(socket.id, username);

        console.log(`${username} joined the chat`);

        // Send updated user list to everyone
        io.emit("online users", getOnlineUsers());

        // Notify other users
        socket.broadcast.emit("system message", {
            type: "join",
            user: username,
            message: `${username} joined the chat`
        });

    });


    /*
    ========================================
    CHAT MESSAGE
    ========================================
    */

    socket.on("chat message", (data) => {

        if (!data || !data.message) {
            return;
        }

        const username = onlineUsers.get(socket.id);

        if (!username) {
            return;
        }

        const messageData = {
            id: Date.now() + "-" + Math.random().toString(36).substring(2, 8),
            user: username,
            message: data.message,
            timestamp: new Date().toISOString()
        };

        console.log(
            `[MESSAGE] ${username}: ${data.message}`
        );

        // Send message to everyone
        io.emit("chat message", messageData);

    });


    /*
    ========================================
    TYPING START
    ========================================
    */

    socket.on("typing", () => {

        const username = onlineUsers.get(socket.id);

        if (!username) {
            return;
        }

        socket.broadcast.emit("user typing", {
            user: username
        });

    });


    /*
    ========================================
    TYPING STOP
    ========================================
    */

    socket.on("stop typing", () => {

        const username = onlineUsers.get(socket.id);

        if (!username) {
            return;
        }

        socket.broadcast.emit("user stopped typing", {
            user: username
        });

    });


    /*
    ========================================
    DISCONNECT
    ========================================
    */

    socket.on("disconnect", () => {

        const username = onlineUsers.get(socket.id);

        if (username) {

            console.log(`${username} disconnected`);

            onlineUsers.delete(socket.id);

            // Update online users
            io.emit("online users", getOnlineUsers());

            // Notify other users
            socket.broadcast.emit("system message", {
                type: "leave",
                user: username,
                message: `${username} left the chat`
            });

        }

    });

});


/*
========================================
GET UNIQUE ONLINE USERS
========================================
*/

function getOnlineUsers() {

    return [...new Set(onlineUsers.values())];

}


/*
========================================
START SERVER
========================================
*/

server.listen(PORT, () => {

    console.log(`Server running on http://localhost:${PORT}`);

});