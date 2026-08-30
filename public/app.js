let socket = null;

let token = null;

let currentUser = null;

let selectedUser = null;

let typingTimeout = null;

let isTyping = false;


/*
=========================================
ELEMENTS
=========================================
*/

const messages =
    document.getElementById("messages");

const input =
    document.getElementById("msg");

const sendButton =
    document.getElementById("send-button");

const onlineUsersContainer =
    document.getElementById("online-users");

const onlineCount =
    document.getElementById("online-count");

const typingIndicator =
    document.getElementById("typing-indicator");

const typingUser =
    document.getElementById("typing-user");


/*
=========================================
REGISTER
=========================================
*/

async function register() {

    const username =
        document
            .getElementById("regUsername")
            .value
            .trim();

    const password =
        document
            .getElementById("regPassword")
            .value;


    if (!username || !password) {

        alert(
            "Please enter username and password"
        );

        return;

    }


    try {

        const response =
            await fetch(
                "/api/register",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            username,
                            password
                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(data.message);

            return;

        }


        alert(
            "Registration successful!"
        );


        document
            .getElementById("regUsername")
            .value = "";

        document
            .getElementById("regPassword")
            .value = "";


        showLogin();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to server"
        );

    }

}


/*
=========================================
LOGIN
=========================================
*/

async function login() {

    const username =
        document
            .getElementById("username")
            .value
            .trim();

    const password =
        document
            .getElementById("password")
            .value;


    if (!username || !password) {

        alert(
            "Please enter username and password"
        );

        return;

    }


    try {

        const response =
            await fetch(
                "/api/login",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            username,
                            password
                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(data.message);

            return;

        }


        token =
            data.token;


        currentUser =
            data.user;


        /*
        Store JWT
        */

        sessionStorage.setItem(
            "chatToken",
            token
        );


        sessionStorage.setItem(
            "chatUser",
            JSON.stringify(
                currentUser
            )
        );


        showChat();


        connectSocket();


        loadUsers();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to server"
        );

    }

}


/*
=========================================
CONNECT SOCKET
=========================================
*/

function connectSocket() {

    if (socket) {

        socket.disconnect();

    }


    socket =
        io({

            auth: {
                token: token
            }

        });


    /*
    Connected
    */

    socket.on(
        "connect",
        () => {

            console.log(
                "Socket connected"
            );

        }
    );


    /*
    Connection error
    */

    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "Socket error:",
                error.message
            );

            if (
                error.message
                    .includes("token")
            ) {

                logout();

            }

        }
    );


    /*
    Online users
    */

    socket.on(
        "online users",
        (users) => {

            updateOnlineUsers(
                users
            );

        }
    );


    /*
    User online
    */

    socket.on(
        "user online",
        () => {

            loadUsers();

        }
    );


    /*
    User offline
    */

    socket.on(
        "user offline",
        () => {

            loadUsers();

        }
    );


    /*
    Private message
    */

    socket.on(
        "private message",
        (data) => {

            /*
            Only show message
            for selected conversation
            */

            if (
                !selectedUser
            ) {

                return;

            }


            const isCurrentChat =

                (
                    data.sender ===
                    selectedUser.id &&

                    data.receiver ===
                    currentUser.id
                )

                ||

                (
                    data.sender ===
                    currentUser.id &&

                    data.receiver ===
                    selectedUser.id
                );


            if (!isCurrentChat) {

                return;

            }


            addMessage(data);

            scrollToBottom();


            /*
            Mark received message read
            */

            if (
                data.sender ===
                selectedUser.id
            ) {

                socket.emit(
                    "mark read",
                    selectedUser.id
                );

            }

        }
    );


    /*
    Typing
    */

    socket.on(
        "user typing",
        (data) => {

            if (
                selectedUser &&
                data.userId ===
                selectedUser.id
            ) {

                typingUser.textContent =
                    data.username;

                typingIndicator
                    .classList
                    .remove("hidden");

            }

        }
    );


    /*
    Stop typing
    */

    socket.on(
        "user stopped typing",
        (data) => {

            if (
                selectedUser &&
                data.userId ===
                selectedUser.id
            ) {

                typingIndicator
                    .classList
                    .add("hidden");

            }

        }
    );


    /*
    Message read
    */

    socket.on(
        "messages read",
        () => {

            document
                .querySelectorAll(
                    ".read-status"
                )
                .forEach(
                    element => {

                        element.textContent =
                            "✓✓";

                    }
                );

        }
    );


    /*
    Message deleted
    */

    socket.on(
        "message deleted",
        (data) => {

            const element =
                document.querySelector(
                    `[data-message-id="${data.messageId}"]`
                );


            if (element) {

                element.remove();

            }

        }
    );


    /*
    Message edited
    */

    socket.on(
        "message edited",
        (data) => {

            const element =
                document.querySelector(
                    `[data-message-id="${data.id}"]`
                );


            if (!element) {

                return;

            }


            const text =
                element.querySelector(
                    ".message-text"
                );


            if (text) {

                text.textContent =
                    data.message;

            }


            const edited =
                element.querySelector(
                    ".edited-label"
                );


            if (edited) {

                edited.textContent =
                    "Edited";

            }

        }
    );

}


/*
=========================================
LOAD USERS
=========================================
*/

async function loadUsers() {

    try {

        const response =
            await fetch(
                "/api/users",
                {

                    headers: {

                        Authorization:
                            `Bearer ${token}`

                    }

                }
            );


        if (!response.ok) {

            return;

        }


        const users =
            await response.json();


        renderUsers(
            users
        );


    } catch (error) {

        console.error(
            error
        );

    }

}


/*
=========================================
RENDER USERS
=========================================
*/

function renderUsers(users) {

    onlineUsersContainer.innerHTML =
        "";


    const online =
        users.filter(
            user => user.online
        );


    onlineCount.textContent =
        online.length;


    users.forEach(
        user => {

            /*
            Don't show yourself
            */

            if (
                user.id ===
                currentUser.id
            ) {

                return;

            }


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "online-user";


            if (
                selectedUser &&
                selectedUser.id ===
                user.id
            ) {

                element.classList.add(
                    "selected"
                );

            }


            const avatar =
                document.createElement(
                    "div"
                );


            avatar.className =
                "avatar";


            avatar.style.width =
                "32px";


            avatar.style.height =
                "32px";


            avatar.style.fontSize =
                "12px";


            avatar.textContent =
                getInitials(
                    user.username
                );


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "online-user-name";


            name.textContent =
                user.username;


            const status =
                document.createElement(
                    "span"
                );


            status.className =
                "user-status";


            status.textContent =
                user.online
                    ? "🟢"
                    : "⚫";


            element.appendChild(
                avatar
            );


            element.appendChild(
                name
            );


            element.appendChild(
                status
            );


            element.onclick =
                () => {

                    selectUser(
                        user
                    );

                };


            onlineUsersContainer
                .appendChild(
                    element
                );

        }
    );

}


/*
=========================================
SELECT USER
=========================================
*/

async function selectUser(user) {

    selectedUser =
        user;


    /*
    Header
    */

    document
        .getElementById(
            "chat-user-name"
        )
        .textContent =
        user.username;


    document
        .getElementById(
            "chat-header-avatar"
        )
        .textContent =
        getInitials(
            user.username
        );


    document
        .getElementById(
            "status-text"
        )
        .textContent =
        user.online
            ? "Online"
            : formatLastSeen(
                user.lastSeen
            );


    /*
    Enable input
    */

    input.disabled =
        false;


    sendButton.disabled =
        false;


    input.placeholder =
        `Message ${user.username}...`;


    /*
    Clear messages
    */

    messages.innerHTML =
        "";


    /*
    Load history
    */

    await loadMessages(
        user.id
    );


    /*
    Refresh users
    */

    loadUsers();


    input.focus();

}


/*
=========================================
LOAD MESSAGE HISTORY
=========================================
*/

async function loadMessages(
    userId
) {

    try {

        const response =
            await fetch(
                `/api/messages/${userId}`,
                {

                    headers: {

                        Authorization:
                            `Bearer ${token}`

                    }

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(data.message);

            return;

        }


        data.forEach(
            message => {

                addMessage(
                    {
                        id:
                            message._id,

                        sender:
                            message.sender,

                        receiver:
                            message.receiver,

                        message:
                            message.message,

                        read:
                            message.read,

                        edited:
                            message.edited,

                        timestamp:
                            message.createdAt

                    }
                );

            }
        );


        scrollToBottom();


    } catch (error) {

        console.error(
            error
        );

    }

}


/*
=========================================
ADD MESSAGE
=========================================
*/

function addMessage(data) {

    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "message-wrapper";


    const isOwn =
        data.sender ===
        currentUser.id;


    wrapper.classList.add(
        isOwn
            ? "sent"
            : "received"
    );


    const message =
        document.createElement(
            "div"
        );


    message.className =
        "message";


    message.dataset.messageId =
        data.id;


    /*
    Text
    */

    const text =
        document.createElement(
            "div"
        );


    text.className =
        "message-text";


    text.textContent =
        data.message;


    /*
    Meta
    */

    const meta =
        document.createElement(
            "div"
        );


    meta.className =
        "message-meta";


    const time =
        document.createElement(
            "span"
        );


    time.textContent =
        formatTime(
            data.timestamp
        );


    meta.appendChild(
        time
    );


    /*
    Edited
    */

    if (data.edited) {

        const edited =
            document.createElement(
                "span"
            );


        edited.className =
            "edited-label";


        edited.textContent =
            "Edited";


        meta.appendChild(
            edited
        );

    }


    /*
    Read status
    */

    if (isOwn) {

        const read =
            document.createElement(
                "span"
            );


        read.className =
            "read-status";


        read.textContent =
            data.read
                ? "✓✓"
                : "✓";


        meta.appendChild(
            read
        );

    }


    message.appendChild(
        text
    );


    message.appendChild(
        meta
    );


    wrapper.appendChild(
        message
    );


    messages.appendChild(
        wrapper
    );

}


/*
=========================================
SEND MESSAGE
=========================================
*/

function sendMessage() {

    const text =
        input.value.trim();


    if (
        !text ||
        !selectedUser ||
        !socket
    ) {

        return;

    }


    socket.emit(
        "private message",
        {

            receiverId:
                selectedUser.id,

            message:
                text

        }
    );


    input.value =
        "";


    autoResize();

    stopTyping();


    input.focus();

}


/*
=========================================
TYPING
=========================================
*/

input.addEventListener(
    "input",
    () => {

        autoResize();


        if (
            !selectedUser ||
            !socket
        ) {

            return;

        }


        if (!isTyping) {

            isTyping =
                true;


            socket.emit(
                "typing",
                selectedUser.id
            );

        }


        clearTimeout(
            typingTimeout
        );


        typingTimeout =
            setTimeout(
                stopTyping,
                1000
            );

    }
);


/*
=========================================
STOP TYPING
=========================================
*/

function stopTyping() {

    if (
        !isTyping ||
        !selectedUser ||
        !socket
    ) {

        return;

    }


    isTyping =
        false;


    clearTimeout(
        typingTimeout
    );


    socket.emit(
        "stop typing",
        selectedUser.id
    );

}


/*
=========================================
ENTER TO SEND
=========================================
*/

input.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


/*
=========================================
TEXTAREA RESIZE
=========================================
*/

function autoResize() {

    input.style.height =
        "auto";


    input.style.height =
        Math.min(
            input.scrollHeight,
            120
        ) + "px";

}


/*
=========================================
SHOW CHAT
=========================================
*/

function showChat() {

    document
        .getElementById(
            "register-page"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "login-page"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "chat-container"
        )
        .classList.remove(
            "hidden"
        );


    document
        .getElementById(
            "profile-name"
        )
        .textContent =
        currentUser.username;


    document
        .getElementById(
            "profile-avatar"
        )
        .textContent =
        getInitials(
            currentUser.username
        );

}


/*
=========================================
SHOW LOGIN
=========================================
*/

function showLogin() {

    document
        .getElementById(
            "register-page"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "login-page"
        )
        .classList.remove(
            "hidden"
        );

}


/*
=========================================
SHOW REGISTER
=========================================
*/

function showRegister() {

    document
        .getElementById(
            "login-page"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "register-page"
        )
        .classList.remove(
            "hidden"
        );

}


/*
=========================================
LOGOUT
=========================================
*/

function logout() {

    if (
        socket
    ) {

        socket.disconnect();

        socket = null;

    }


    sessionStorage.removeItem(
        "chatToken"
    );


    sessionStorage.removeItem(
        "chatUser"
    );


    token =
        null;


    currentUser =
        null;


    selectedUser =
        null;


    document
        .getElementById(
            "chat-container"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "login-page"
        )
        .classList.remove(
            "hidden"
        );


    input.disabled =
        true;


    sendButton.disabled =
        true;


    input.value =
        "";

}


/*
=========================================
LAST SEEN
=========================================
*/

function formatLastSeen(
    date
) {

    if (!date) {

        return "Offline";

    }


    return `Last seen ${formatTime(date)}`;

}


/*
=========================================
FORMAT TIME
=========================================
*/

function formatTime(
    timestamp
) {

    return new Date(
        timestamp
    ).toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/*
=========================================
INITIALS
=========================================
*/

function getInitials(
    name
) {

    return name
        .substring(0, 2)
        .toUpperCase();

}


/*
=========================================
SCROLL
=========================================
*/

function scrollToBottom() {

    messages.scrollTop =
        messages.scrollHeight;

}


/*
=========================================
ONLINE USERS
=========================================
*/

function updateOnlineUsers(
    users
) {

    onlineCount.textContent =
        users.length;

}


/*
=========================================
THEME
=========================================
*/

function toggleTheme() {

    document.body.classList.toggle(
        "light-theme"
    );

}


/*
=========================================
SESSION RESTORE
=========================================
*/

function restoreSession() {

    const savedToken =
        sessionStorage.getItem(
            "chatToken"
        );


    const savedUser =
        sessionStorage.getItem(
            "chatUser"
        );


    if (
        !savedToken ||
        !savedUser
    ) {

        return;

    }


    try {

        token =
            savedToken;


        currentUser =
            JSON.parse(
                savedUser
            );


        showChat();

        connectSocket();

        loadUsers();


    } catch (error) {

        console.error(
            error
        );


        logout();

    }

}


/*
=========================================
INITIALIZE
=========================================
*/

restoreSession();