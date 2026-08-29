const socket = io();

let username = "";

let typingTimeout;

let isTyping = false;


/* =========================================
   ELEMENTS
========================================= */

const input = document.getElementById("msg");

const messages =
    document.getElementById("messages");

const typingIndicator =
    document.getElementById("typing-indicator");

const onlineUsersContainer =
    document.getElementById("online-users");

const onlineCount =
    document.getElementById("online-count");

const statusText =
    document.getElementById("status-text");


/* =========================================
   REGISTER
========================================= */

function register() {

    const regUsername =
        document
            .getElementById("regUsername")
            .value
            .trim();

    const regPassword =
        document
            .getElementById("regPassword")
            .value;


    if (!regUsername || !regPassword) {

        alert("Please fill all fields");

        return;

    }


    if (regUsername.length < 3) {

        alert("Username must be at least 3 characters");

        return;

    }


    if (regPassword.length < 4) {

        alert("Password must be at least 4 characters");

        return;

    }


    const existingUser =
        localStorage.getItem(regUsername);


    if (existingUser) {

        alert("Username already exists");

        return;

    }


    localStorage.setItem(

        regUsername,

        JSON.stringify({

            username: regUsername,

            password: regPassword

        })

    );


    alert("Registration successful!");

    document.getElementById("regUsername").value = "";

    document.getElementById("regPassword").value = "";


    showLogin();

}


/* =========================================
   LOGIN
========================================= */

function login() {

    const enteredUsername =
        document
            .getElementById("username")
            .value
            .trim();

    const password =
        document
            .getElementById("password")
            .value;


    if (!enteredUsername || !password) {

        alert("Please enter username and password");

        return;

    }


    const storedUser =
        localStorage.getItem(enteredUsername);


    if (!storedUser) {

        alert("User not found");

        return;

    }


    let user;


    try {

        user = JSON.parse(storedUser);

    } catch (error) {

        alert("Invalid user data");

        return;

    }


    if (user.password !== password) {

        alert("Invalid username or password");

        return;

    }


    username = user.username;

    document.getElementById("chat-user-name").textContent =
    username;


    // Save current session
    sessionStorage.setItem(
        "chatUsername",
        username
    );


    // Update UI
    document.getElementById(
        "profile-name"
    ).textContent = username;


    document.getElementById(
        "profile-avatar"
    ).textContent = getInitials(username);


    // Show chat
    document.getElementById(
        "login-page"
    ).classList.add("hidden");


    document.getElementById(
        "register-page"
    ).classList.add("hidden");


    document.getElementById(
        "chat-container"
    ).classList.remove("hidden");


    statusText.textContent = "Online";


    // Tell server user joined
    socket.emit("user joined", username);


    input.focus();

}


/* =========================================
   SHOW LOGIN
========================================= */

function showLogin() {

    document
        .getElementById("register-page")
        .classList.add("hidden");


    document
        .getElementById("login-page")
        .classList.remove("hidden");

}


/* =========================================
   SHOW REGISTER
========================================= */

function showRegister() {

    document
        .getElementById("login-page")
        .classList.add("hidden");


    document
        .getElementById("register-page")
        .classList.remove("hidden");

}


/* =========================================
   LOGOUT
========================================= */

function logout() {

    if (!confirm("Are you sure you want to logout?")) {

        return;

    }


    socket.disconnect();


    sessionStorage.removeItem(
        "chatUsername"
    );


    username = "";


    document
        .getElementById("chat-container")
        .classList.add("hidden");


    document
        .getElementById("login-page")
        .classList.remove("hidden");


    document.getElementById("username").value = "";

    document.getElementById("password").value = "";


    // Reconnect socket for next login
    socket.connect();

}


/* =========================================
   SEND MESSAGE
========================================= */

function sendMessage() {

    const text =
        input.value.trim();


    if (!text) {

        return;

    }


    if (!username) {

        alert("Please login first");

        return;

    }


    // Stop typing indicator
    stopTyping();


    socket.emit(
        "chat message",
        {
            message: text
        }
    );


    input.value = "";

    autoResizeTextarea();

    input.focus();

}


/* =========================================
   RECEIVE MESSAGE
========================================= */

socket.on(
    "chat message",
    (data) => {

        addMessage(data);

        scrollToBottom();


        // Browser notification
        if (
            data.user !== username &&
            document.hidden
        ) {

            showNotification(
                data.user,
                data.message
            );

        }

    }
);


/* =========================================
   ADD MESSAGE
========================================= */

function addMessage(data) {

    // Remove welcome screen
    const welcome =
        document.querySelector(
            ".welcome-message"
        );


    if (welcome) {

        welcome.remove();

    }


    const wrapper =
        document.createElement("div");


    const message =
        document.createElement("div");


    wrapper.classList.add(
        "message-wrapper"
    );


    message.classList.add(
        "message"
    );


    if (data.user === username) {

        wrapper.classList.add("sent");

    } else {

        wrapper.classList.add("received");

    }


    /*
    ========================================
    USERNAME
    ========================================
    */

    const userElement =
        document.createElement("div");


    userElement.classList.add(
        "message-user"
    );


    userElement.textContent =
        data.user;


    /*
    ========================================
    MESSAGE TEXT
    ========================================
    */

    const textElement =
        document.createElement("div");


    textElement.classList.add(
        "message-text"
    );


    // textContent prevents HTML injection
    textElement.textContent =
        data.message;


    /*
    ========================================
    TIME
    ========================================
    */

    const metaElement =
        document.createElement("div");


    metaElement.classList.add(
        "message-meta"
    );


    const timeElement =
        document.createElement("span");


    timeElement.textContent =
        formatTime(data.timestamp);


    metaElement.appendChild(
        timeElement
    );


    // Read receipt for own messages
    if (data.user === username) {

        const check =
            document.createElement("span");

        check.textContent = "✓✓";

        metaElement.appendChild(check);

    }


    message.appendChild(
        userElement
    );


    message.appendChild(
        textElement
    );


    message.appendChild(
        metaElement
    );


    wrapper.appendChild(
        message
    );


    messages.appendChild(
        wrapper
    );

}


/* =========================================
   TYPING START
========================================= */

input.addEventListener(
    "input",
    () => {

        autoResizeTextarea();


        if (!username) {

            return;

        }


        if (!isTyping) {

            isTyping = true;

            socket.emit("typing");

        }


        clearTimeout(
            typingTimeout
        );


        typingTimeout =
            setTimeout(
                () => {

                    stopTyping();

                },
                1200
            );

    }
);


/* =========================================
   STOP TYPING
========================================= */

function stopTyping() {

    if (!isTyping) {

        return;

    }


    isTyping = false;

    clearTimeout(
        typingTimeout
    );


    socket.emit(
        "stop typing"
    );

}


/* =========================================
   RECEIVE TYPING
========================================= */

socket.on(
    "user typing",
    (data) => {

        const typingUser =
            document.querySelector(
                ".typing-user"
            );


        typingUser.textContent =
            data.user;


        typingIndicator.classList.remove(
            "hidden"
        );

    }
);


/* =========================================
   USER STOPPED TYPING
========================================= */

socket.on(
    "user stopped typing",
    () => {

        typingIndicator.classList.add(
            "hidden"
        );

    }
);


/* =========================================
   ONLINE USERS
========================================= */

socket.on(
    "online users",
    (users) => {

        onlineCount.textContent =
            users.length;


        onlineUsersContainer.innerHTML =
            "";


        users.forEach(
            (user) => {

                const userElement =
                    document.createElement(
                        "div"
                    );


                userElement.classList.add(
                    "online-user"
                );


                const avatar =
                    document.createElement(
                        "div"
                    );


                avatar.classList.add(
                    "avatar"
                );


                avatar.style.width = "32px";

                avatar.style.height = "32px";

                avatar.style.fontSize = "12px";


                avatar.textContent =
                    getInitials(user);


                const name =
                    document.createElement(
                        "span"
                    );


                name.classList.add(
                    "online-user-name"
                );


                name.textContent =
                    user;


                const status =
                    document.createElement(
                        "span"
                    );


                status.classList.add(
                    "user-status"
                );


                status.textContent =
                    "●";


                userElement.appendChild(
                    avatar
                );


                userElement.appendChild(
                    name
                );


                userElement.appendChild(
                    status
                );


                onlineUsersContainer.appendChild(
                    userElement
                );

            }
        );

    }
);


/* =========================================
   SYSTEM MESSAGE
========================================= */

socket.on(
    "system message",
    (data) => {

        addSystemMessage(
            data.message
        );

    }
);


/* =========================================
   ADD SYSTEM MESSAGE
========================================= */

function addSystemMessage(message) {

    const element =
        document.createElement("div");


    element.classList.add(
        "system-message"
    );


    element.textContent =
        message;


    messages.appendChild(
        element
    );


    scrollToBottom();

}


/* =========================================
   SOCKET CONNECTED
========================================= */

socket.on(
    "connect",
    () => {

        console.log(
            "Connected to server:",
            socket.id
        );


        statusText.textContent =
            username
                ? "Online"
                : "Connected";

    }
);


/* =========================================
   SOCKET DISCONNECTED
========================================= */

socket.on(
    "disconnect",
    () => {

        console.log(
            "Disconnected from server"
        );


        statusText.textContent =
            "Disconnected";

    }
);


/* =========================================
   ENTER KEY
========================================= */

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


/* =========================================
   TEXTAREA AUTO RESIZE
========================================= */

function autoResizeTextarea() {

    input.style.height = "auto";


    input.style.height =
        Math.min(
            input.scrollHeight,
            120
        ) + "px";

}


/* =========================================
   SCROLL
========================================= */

function scrollToBottom() {

    messages.scrollTop =
        messages.scrollHeight;

}


/* =========================================
   FORMAT TIME
========================================= */

function formatTime(timestamp) {

    const date =
        new Date(timestamp);


    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================
   USER INITIALS
========================================= */

function getInitials(name) {

    if (!name) {

        return "?";

    }


    return name
        .substring(0, 2)
        .toUpperCase();

}


/* =========================================
   EMOJI
========================================= */

function addEmoji() {

    input.value += " 😊";

    input.focus();

    autoResizeTextarea();

}


/* =========================================
   COMING SOON
========================================= */

function showComingSoon() {

    alert(
        "File and image sharing will be added in Version 2."
    );

}


/* =========================================
   BROWSER NOTIFICATION
========================================= */

function showNotification(
    user,
    message
) {

    if (
        !("Notification" in window)
    ) {

        return;

    }


    if (
        Notification.permission === "granted"
    ) {

        new Notification(
            `${user} sent a message`,
            {
                body: message
            }
        );

    }

}


/* =========================================
   REQUEST NOTIFICATION PERMISSION
========================================= */

function requestNotificationPermission() {

    if (
        "Notification" in window &&
        Notification.permission === "default"
    ) {

        Notification.requestPermission();

    }

}


/* =========================================
   THEME
========================================= */

function toggleTheme() {

    document.body.classList.toggle(
        "light-theme"
    );


    const isLight =
        document.body.classList.contains(
            "light-theme"
        );


    localStorage.setItem(
        "theme",
        isLight
            ? "light"
            : "dark"
    );

}


/* =========================================
   LOAD THEME
========================================= */

function loadTheme() {

    const theme =
        localStorage.getItem(
            "theme"
        );


    if (theme === "light") {

        document.body.classList.add(
            "light-theme"
        );

    }

}


/* =========================================
   AUTO LOGIN SESSION
========================================= */

function checkSession() {

    const savedUsername =
        sessionStorage.getItem(
            "chatUsername"
        );


    if (!savedUsername) {

        return;

    }


    const storedUser =
        localStorage.getItem(
            savedUsername
        );


    if (!storedUser) {

        return;

    }


    try {

        const user =
            JSON.parse(storedUser);


        username =
            user.username;


        document.getElementById(
            "profile-name"
        ).textContent =
            username;


        document.getElementById(
            "profile-avatar"
        ).textContent =
            getInitials(username);


        document.getElementById(
            "register-page"
        ).classList.add("hidden");


        document.getElementById(
            "login-page"
        ).classList.add("hidden");


        document.getElementById(
            "chat-container"
        ).classList.remove("hidden");


        socket.emit(
            "user joined",
            username
        );


    } catch (error) {

        sessionStorage.removeItem(
            "chatUsername"
        );

    }

}


/* =========================================
   INITIALIZATION
========================================= */

loadTheme();

checkSession();

requestNotificationPermission();