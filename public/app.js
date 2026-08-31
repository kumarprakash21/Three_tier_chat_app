/*
==================================================
SOCKET CONNECTION
==================================================
*/

let socket = null;

let username = "";

let currentUserId = "";

let selectedUserId = "";

let selectedUsername = "";

let users = [];

let typingTimeout = null;


/*
==================================================
ELEMENTS
==================================================
*/

const messages =
    document.getElementById("messages");

const input =
    document.getElementById("msg");

const userList =
    document.getElementById("user-list");

const searchInput =
    document.getElementById("searchUser");

const typingIndicator =
    document.getElementById("typing-indicator");


/*
==================================================
SHOW LOGIN
==================================================
*/

function showLogin() {

    document.getElementById(
        "register-page"
    ).style.display = "none";

    document.getElementById(
        "login-page"
    ).style.display = "flex";

}


/*
==================================================
SHOW REGISTER
==================================================
*/

function showRegister() {

    document.getElementById(
        "login-page"
    ).style.display = "none";

    document.getElementById(
        "register-page"
    ).style.display = "flex";

}


/*
==================================================
REGISTER
==================================================
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

        showNotification(
    "Missing Information",
    "Please enter username and password.",
    "error"
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

                    body: JSON.stringify({

                        username,
                        password

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            showNotification(
    "Registration Failed",
    data.message ||
        "Unable to create account.",
    "error"
);

            return;
        }


        showNotification(
    "Account Created",
    "Your account was created successfully.",
    "success"
);


        document.getElementById(
            "regUsername"
        ).value = "";

        document.getElementById(
            "regPassword"
        ).value = "";


        showLogin();


    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to server"
        );

    }

}


/*
==================================================
LOGIN
==================================================
*/

async function login() {

    const loginUsername =
        document
            .getElementById("username")
            .value
            .trim();

    const password =
        document
            .getElementById("password")
            .value;


    if (!loginUsername || !password) {

        showNotification(
    "Missing Information",
    "Please enter username and password.",
    "error"
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

                    body: JSON.stringify({

                        username:
                            loginUsername,

                        password

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            showNotification(
    "Login Failed",
    data.message ||
        "Invalid username or password.",
    "error"
);

            return;
        }


        /*
        Save authentication
        */

        localStorage.setItem(
            "token",
            data.token
        );

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );


        username =
    data.user.username;

currentUserId =
    data.user.id;


/*
Show logged-in username
*/

document.getElementById(
    "logged-user"
).textContent =
    `Logged in as ${username}`;


        /*
        Show chat
        */

        document.getElementById(
            "login-page"
        ).style.display = "none";

        document.getElementById(
            "register-page"
        ).style.display = "none";

        document.getElementById(
            "chat-container"
        ).style.display = "flex";


        /*
        Connect Socket.IO
        */

        connectSocket();


        /*
        Load users
        */

        loadUsers();


    } catch (error) {

        console.error(error);

        showNotification(
    "Connection Error",
    "Unable to connect to the server.",
    "error"
);

    }

}


/*
==================================================
SOCKET CONNECTION
==================================================
*/

function connectSocket() {

    const token =
        localStorage.getItem(
            "token"
        );


    if (!token) {
        return;
    }


    socket =
        io({

            auth: {
                token
            }

        });


    socket.on(
        "connect",
        () => {

            console.log(
                "Socket connected"
            );

        }
    );


    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "Socket error:",
                error.message
            );

        }
    );


    /*
    ==============================================
    RECEIVE PRIVATE MESSAGE
    ==============================================
    */

    socket.on(
        "private message",
        (data) => {

            /*
            Only display message if
            it belongs to current chat
            */

            if (

                (
                    data.sender ===
                    selectedUserId

                ) ||

                (
                    data.receiver ===
                    selectedUserId

                )

            ) {

                addMessage(
                    data
                );

            }


            /*
            Refresh chat list.

            This is what updates:

            unread count
            last message
            timestamp
            */

            loadUsers();

        }
    );


    /*
    ==============================================
    CONVERSATION UPDATED
    ==============================================
    */

    socket.on("conversation updated", async () => {

    await loadUsers();

    /*
    Keep currently opened conversation selected
    */

    if (selectedUserId) {

        const selectedUser =
            users.find(
                user =>
                    String(user.id) ===
                    String(selectedUserId)
            );

        if (selectedUser) {

            selectedUser.unreadCount = 0;

        }

    }

    renderUsers(users);

});


    /*
    ==============================================
    USER ONLINE
    ==============================================
    */

    socket.on(
        "user online",
        () => {

            loadUsers();

            updateSelectedUserStatus();

        }
    );


    /*
    ==============================================
    USER OFFLINE
    ==============================================
    */

    socket.on(
        "user offline",
        () => {

            loadUsers();

            updateSelectedUserStatus();

        }
    );


    /*
    ==============================================
    ONLINE USERS
    ==============================================
    */

    socket.on(
        "online users",
        () => {

            loadUsers();

            updateSelectedUserStatus();

        }
    );


    /*
    ==============================================
    TYPING
    ==============================================
    */

    socket.on(
        "user typing",
        (data) => {

            if (
                data.userId ===
                selectedUserId
            ) {

                typingIndicator.style.display =
                    "flex";

            }

        }
    );


    /*
    ==============================================
    STOP TYPING
    ==============================================
    */

    socket.on(
        "user stopped typing",
        (data) => {

            if (
                data.userId ===
                selectedUserId
            ) {

                typingIndicator.style.display =
                    "none";

            }

        }
    );


    /*
    ==============================================
    MESSAGES READ
    ==============================================
    */

    socket.on("messages read", async () => {

    await loadUsers();

    /*
    If this conversation is currently open,
    force unread count to zero.
    */

    if (selectedUserId) {

        const selectedUser =
            users.find(
                user =>
                    String(user.id) ===
                    String(selectedUserId)
            );

        if (selectedUser) {

            selectedUser.unreadCount = 0;

        }

    }

    renderUsers(users);

});


    /*
    ==============================================
    MESSAGE DELETED
    ==============================================
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


            loadUsers();

        }
    );


    /*
    ==============================================
    MESSAGE EDITED
    ==============================================
    */

    socket.on(
        "message edited",
        (data) => {

            const element =
                document.querySelector(
                    `[data-message-id="${data.id}"]`
                );


            if (element) {

                const text =
                    element.querySelector(
                        ".message-text"
                    );


                if (text) {

                    text.textContent =
                        data.message;

                }

            }


            loadUsers();

        }
    );

}


/*
==================================================
LOAD USERS
==================================================
*/

async function loadUsers() {

    const token =
        localStorage.getItem(
            "token"
        );


    if (!token) {
        return;
    }


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


        if (
            response.status === 401
        ) {

            logout();

            return;

        }


        users =
            await response.json();


        renderUsers(
            users
        );


    } catch (error) {

        console.error(
            "Load users error:",
            error
        );

    }

}


/*
==================================================
RENDER USERS
==================================================
*/

function renderUsers(
    userArray
) {

    userList.innerHTML = "";


    if (
        userArray.length === 0
    ) {

        userList.innerHTML = `
            <div class="loading">
                No users found
            </div>
        `;

        return;

    }


    userArray.forEach(
        (user) => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "user-item";


            if (
                user.id ===
                selectedUserId
            ) {

                item.classList.add(
                    "active"
                );

            }


            /*
            Avatar
            */

            const avatar =
                document.createElement(
                    "div"
                );

            avatar.className =
                "user-avatar";


            avatar.textContent =
                user.username
                    .charAt(0)
                    .toUpperCase();


            /*
            Online indicator
            */

            if (
                user.online
            ) {

                const dot =
                    document.createElement(
                        "div"
                    );

                dot.className =
                    "online-dot";

                avatar.appendChild(
                    dot
                );

            }


            /*
            User information
            */

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "user-info";


            const top =
                document.createElement(
                    "div"
                );

            top.className =
                "user-top";


            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "user-name";

            name.textContent =
                user.username;


            /*
            Last message time
            */

            const time =
                document.createElement(
                    "span"
                );

            time.className =
                "last-time";


            if (
                user.lastMessage
            ) {

                time.textContent =
                    formatTime(
                        user.lastMessage.timestamp
                    );

            }


            top.appendChild(
                name
            );

            top.appendChild(
                time
            );


            /*
            Last message
            */

            const lastMessage =
                document.createElement(
                    "div"
                );

            lastMessage.className =
                "last-message";


            if (
                user.lastMessage
            ) {

                lastMessage.textContent =
                    user.lastMessage.message;

            } else {

                lastMessage.textContent =
                    "Start a conversation";

            }


            info.appendChild(
                top
            );

            info.appendChild(
                lastMessage
            );


            /*
            UNREAD BADGE

            This is the important part.
            */

            if (
                user.unreadCount &&
                user.unreadCount > 0
            ) {

                const badge =
                    document.createElement(
                        "div"
                    );

                badge.className =
                    "unread-badge";


                badge.textContent =
                    user.unreadCount >
                    99
                        ? "99+"
                        : user.unreadCount;


                item.appendChild(
                    avatar
                );

                item.appendChild(
                    info
                );

                item.appendChild(
                    badge
                );

            } else {

                item.appendChild(
                    avatar
                );

                item.appendChild(
                    info
                );

            }


            /*
            Open conversation
            */

            item.addEventListener(
                "click",
                () => {

                    openChat(
                        user
                    );

                }
            );


            userList.appendChild(
                item
            );

        }
    );

}


/*
==================================================
SEARCH USERS
==================================================
*/

searchInput.addEventListener(
    "input",
    () => {

        const search =
            searchInput.value
                .trim()
                .toLowerCase();


        const filtered =
            users.filter(
                user =>
                    user.username
                        .toLowerCase()
                        .includes(search)
            );


        renderUsers(
            filtered
        );

    }
);


/*
==================================================
OPEN CHAT
==================================================
*/


async function openChat(user) {

    selectedUserId = user.id;
    selectedUsername = user.username;

    /*
    ==========================================
    UPDATE CHAT HEADER
    ==========================================
    */

    document.getElementById("chat-username").textContent =
        user.username;

    document.getElementById("chat-avatar").textContent =
        user.username.charAt(0).toUpperCase();

    updateSelectedUserStatus();


    /*
    ==========================================
    ENABLE MESSAGE BOX
    ==========================================
    */

    input.disabled = false;

    input.placeholder =
        `Message ${user.username}...`;

    document.getElementById("send-button").disabled =
        false;


    /*
    ==========================================
    IMPORTANT
    Remove unread count immediately
    ==========================================
    */

    const selectedUser =
        users.find(
            u => String(u.id) === String(user.id)
        );

    if (selectedUser) {
        selectedUser.unreadCount = 0;
    }


    /*
    Re-render immediately
    */

    renderUsers(users);


    /*
    ==========================================
    LOAD CHAT HISTORY
    ==========================================
    */

    messages.innerHTML = "";

    await loadMessages(user.id);


    /*
    ==========================================
    MARK READ THROUGH SOCKET TOO
    ==========================================
    */

    if (socket) {

        socket.emit(
            "mark read",
            user.id
        );

    }


    /*
    Keep selected chat highlighted
    */

    renderUsers(users);
}


    /*
    ==========================================
    Tell server messages are read
    ==========================================
    */



/*
==================================================
LOAD MESSAGES
==================================================
*/

async function loadMessages(
    userId
) {

    const token =
        localStorage.getItem(
            "token"
        );


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


        if (!response.ok) {

            console.error(
                "Unable to load messages"
            );

            return;

        }


        const chatMessages =
            await response.json();


        messages.innerHTML = "";


        if (
            chatMessages.length === 0
        ) {

            messages.innerHTML = `
                <div class="empty-chat">

                    <div class="empty-icon">
                        👋
                    </div>

                    <h3>
                        Say hello to ${escapeHtml(selectedUsername)}
                    </h3>

                    <p>
                        Start your first conversation.
                    </p>

                </div>
            `;

            return;

        }


        chatMessages.forEach(
            message => {

                addMessage(
                    message
                );

            }
        );


        scrollToBottom();


    } catch (error) {

        console.error(
            "Messages error:",
            error
        );

    }

}


/*
==================================================
ADD MESSAGE
==================================================
*/

function addMessage(data) {

    /*
    Avoid duplicate messages
    */

    if (
        data.id &&
        document.querySelector(
            `[data-message-id="${data.id}"]`
        )
    ) {
        return;
    }


    const div =
        document.createElement("div");


    div.classList.add("message");


    if (data.id) {

        div.dataset.messageId =
            data.id;

    }


    /*
    SENT / RECEIVED
    */

    const isMyMessage =
        String(data.sender) ===
        String(currentUserId);


    if (isMyMessage) {

        div.classList.add("sent");

    } else {

        div.classList.add("received");

    }


    /*
    USERNAME
    */

    const usernameDiv =
        document.createElement("div");

    usernameDiv.className =
        "message-username";


    usernameDiv.textContent =
        isMyMessage
            ? "You"
            : selectedUsername;


    /*
    MESSAGE TEXT
    */

    const textDiv =
        document.createElement("div");

    textDiv.className =
        "message-text";

    textDiv.textContent =
        data.message;


    /*
    TIME
    */

    const timeDiv =
        document.createElement("div");

    timeDiv.className =
        "message-time";


    timeDiv.textContent =
        formatTime(
            data.timestamp
        );


    /*
    =====================================
    MESSAGE TICK
    =====================================

    ✓  = sent
    ✓✓ = read
    */

    if (isMyMessage) {

        const status =
            document.createElement("span");

        status.className =
            "message-status";


        if (data.read === true) {

            status.classList.add(
                "read"
            );

            status.textContent =
                "✓✓";

        } else {

            status.classList.add(
                "sent"
            );

            status.textContent =
                "✓";

        }


        timeDiv.appendChild(
            status
        );

    }


    /*
    EDITED
    */

    if (data.edited) {

        const edited =
            document.createElement("span");

        edited.className =
            "edited";

        edited.textContent =
            "edited";

        timeDiv.appendChild(
            edited
        );

    }


    /*
    ADD ELEMENTS
    */

    div.appendChild(
        usernameDiv
    );

    div.appendChild(
        textDiv
    );

    div.appendChild(
        timeDiv
    );


    messages.appendChild(
        div
    );


    scrollToBottom();

}


/*
==================================================
SEND MESSAGE
==================================================
*/

function sendMessage() {

    const text =
        input.value.trim();


    if (
        !text ||
        !selectedUserId ||
        !socket
    ) {

        return;

    }


    socket.emit(
        "private message",
        {

            receiverId:
                selectedUserId,

            message:
                text

        }
    );


    input.value = "";


    /*
    Stop typing
    */

    socket.emit(
        "stop typing",
        selectedUserId
    );

}


/*
==================================================
ENTER KEY
==================================================
*/

input.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


/*
==================================================
TYPING
==================================================
*/

input.addEventListener(
    "input",
    () => {

        if (
            !socket ||
            !selectedUserId
        ) {

            return;

        }


        socket.emit(
            "typing",
            selectedUserId
        );


        clearTimeout(
            typingTimeout
        );


        typingTimeout =
            setTimeout(
                () => {

                    socket.emit(
                        "stop typing",
                        selectedUserId
                    );

                },
                1000
            );

    }
);


/*
==================================================
UPDATE USER STATUS
==================================================
*/

function updateSelectedUserStatus() {

    if (
        !selectedUserId
    ) {

        return;

    }


    const user =
        users.find(
            u =>
                u.id ===
                selectedUserId
        );


    const status =
        document.getElementById(
            "chat-status"
        );


    if (!user) {

        return;

    }


    if (
        user.online
    ) {

        status.textContent =
            "🟢 Online";

        status.classList.add(
            "online"
        );

    } else {

        status.textContent =
            user.lastSeen
                ? `Last seen ${formatLastSeen(user.lastSeen)}`
                : "Offline";

        status.classList.remove(
            "online"
        );

    }

}


/*
==================================================
FORMAT TIME
==================================================
*/

function formatTime(
    timestamp
) {

    if (!timestamp) {
        return "";
    }


    const date =
        new Date(
            timestamp
        );


    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/*
==================================================
FORMAT LAST SEEN
==================================================
*/

function formatLastSeen(
    timestamp
) {

    const date =
        new Date(
            timestamp
        );


    const now =
        new Date();


    const diff =
        now - date;


    const minutes =
        Math.floor(
            diff / 60000
        );


    if (
        minutes < 1
    ) {

        return "just now";

    }


    if (
        minutes < 60
    ) {

        return `${minutes} min ago`;

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if (
        hours < 24
    ) {

        return `${hours} hr ago`;

    }


    return date.toLocaleDateString();

}


/*
==================================================
SCROLL TO BOTTOM
==================================================
*/

function scrollToBottom() {

    messages.scrollTop =
        messages.scrollHeight;

}


/*
==================================================
HTML ESCAPE
==================================================
*/

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


/*
==================================================
LOGOUT
==================================================
*/

function logout() {

    if (socket) {

        socket.disconnect();

        socket = null;

    }


    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );


    username = "";

    currentUserId = "";

    selectedUserId = "";

    selectedUsername = "";

    users = [];


    document.getElementById(
        "chat-container"
    ).style.display = "none";


    document.getElementById(
        "login-page"
    ).style.display = "flex";


    input.value = "";

    input.disabled = true;

    input.placeholder =
        "Select a user first...";


    document.getElementById(
        "send-button"
    ).disabled = true;


    messages.innerHTML = `
        <div class="empty-chat">

            <div class="empty-icon">
                💬
            </div>

            <h3>
                Welcome to ChatApp
            </h3>

            <p>
                Select a user to start chatting.
            </p>

        </div>
    `;

}


/*
==================================================
AUTO LOGIN

If token already exists,
restore the session.
==================================================
*/

window.addEventListener(
    "DOMContentLoaded",
    () => {

        const token =
            localStorage.getItem(
                "token"
            );

        const storedUser =
            localStorage.getItem(
                "user"
            );


        if (
            token &&
            storedUser
        ) {

            try {

                const user =
                    JSON.parse(
                        storedUser
                    );


                username =
    user.username;

currentUserId =
    user.id;


/*
Restore logged-in username
*/

document.getElementById(
    "logged-user"
).textContent =
    `Logged in as ${username}`;


                document.getElementById(
                    "login-page"
                ).style.display =
                    "none";


                document.getElementById(
                    "register-page"
                ).style.display =
                    "none";


                document.getElementById(
                    "chat-container"
                ).style.display =
                    "flex";


                connectSocket();

                loadUsers();


            } catch (error) {

                console.error(
                    error
                );

                logout();

            }

        }

    }
);


/* =========================================
   DELETE ACCOUNT
========================================= */

/* =========================================
   CUSTOM NOTIFICATION MODAL
========================================= */

function showNotification(
    title,
    message,
    type = "success"
) {

    const modal =
        document.getElementById(
            "notification-modal"
        );

    const icon =
        document.getElementById(
            "notification-icon"
        );

    const titleElement =
        document.getElementById(
            "notification-title"
        );

    const messageElement =
        document.getElementById(
            "notification-message"
        );


    if (!modal) {
        console.error(
            "notification-modal not found"
        );
        return;
    }


    titleElement.textContent =
        title;

    messageElement.textContent =
        message;


    if (type === "error") {

        icon.textContent = "✕";

        icon.style.background =
            "#fee2e2";

        icon.style.color =
            "#dc2626";

    } else {

        icon.textContent = "✓";

        icon.style.background =
            "#dcfce7";

        icon.style.color =
            "#16a34a";

    }


    modal.style.display =
        "flex";

}


/* =========================================
   CLOSE NOTIFICATION
========================================= */

function closeNotification() {

    const modal =
        document.getElementById(
            "notification-modal"
        );


    if (modal) {

        modal.style.display =
            "none";

    }

}


/* =========================================
   OPEN DELETE ACCOUNT MODAL
========================================= */

function deleteAccount() {

    const modal =
        document.getElementById(
            "delete-modal"
        );


    if (!modal) {

        console.error(
            "delete-modal not found"
        );

        return;

    }


    modal.style.display =
        "flex";

}


/* =========================================
   CLOSE DELETE ACCOUNT MODAL
========================================= */

function closeDeleteModal() {

    const modal =
        document.getElementById(
            "delete-modal"
        );


    if (modal) {

        modal.style.display =
            "none";

    }

}


/* =========================================
   CONFIRM DELETE ACCOUNT
========================================= */

async function confirmDeleteAccount() {

    console.log(
        "Deleting account..."
    );


    const token =
        localStorage.getItem(
            "token"
        );


    if (!token) {

        closeDeleteModal();


        showNotification(
            "Session Expired",
            "Please login again.",
            "error"
        );


        return;

    }


    try {

        const response =
            await fetch(
                "/api/user",
                {

                    method: "DELETE",

                    headers: {

                        Authorization:
                            `Bearer ${token}`

                    }

                }
            );


        const data =
            await response.json();


        console.log(
            "Delete response:",
            data
        );


        if (!response.ok) {

            closeDeleteModal();


            showNotification(
                "Delete Failed",
                data.message ||
                    "Unable to delete account.",
                "error"
            );


            return;

        }


        /*
        ======================================
        DISCONNECT SOCKET
        ======================================
        */

        if (socket) {

            socket.disconnect();

            socket = null;

        }


        /*
        ======================================
        CLEAR LOCAL STORAGE
        ======================================
        */

        localStorage.removeItem(
            "token"
        );

        localStorage.removeItem(
            "user"
        );


        /*
        ======================================
        RESET VARIABLES
        ======================================
        */

        username = "";

        currentUserId = "";

        selectedUserId = "";

        selectedUsername = "";

        users = [];


        /*
        ======================================
        CLOSE DELETE MODAL
        ======================================
        */

        closeDeleteModal();


        /*
        ======================================
        HIDE CHAT
        ======================================
        */

        document.getElementById(
            "chat-container"
        ).style.display =
            "none";


        /*
        ======================================
        SHOW LOGIN PAGE
        ======================================
        */

        document.getElementById(
            "login-page"
        ).style.display =
            "flex";


        /*
        ======================================
        CLEAR LOGIN FORM
        ======================================
        */

        document.getElementById(
            "username"
        ).value = "";


        document.getElementById(
            "password"
        ).value = "";


        /*
        ======================================
        RESET CHAT
        ======================================
        */

        messages.innerHTML = `

            <div class="empty-chat">

                <div class="empty-icon">
                    💬
                </div>

                <h3>
                    Welcome to ChatApp
                </h3>

                <p>
                    Select a user to start chatting.
                </p>

            </div>

        `;


        /*
        ======================================
        SHOW SUCCESS MODAL
        ======================================
        */

        showNotification(
            "Account Deleted",
            "Your account and chat history have been permanently deleted.",
            "success"
        );


    } catch (error) {

        console.error(
            "Delete account error:",
            error
        );


        closeDeleteModal();


        showNotification(
            "Server Error",
            "Unable to delete account. Please try again.",
            "error"
        );

    }

}