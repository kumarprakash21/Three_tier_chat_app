const socket = io();

let username = "";

const input = document.getElementById("msg");
const messages = document.getElementById("messages");

/* =========================
   REGISTER
========================= */

function register() {

    const regUsername =
        document.getElementById("regUsername").value.trim();

    const regPassword =
        document.getElementById("regPassword").value;

    if (!regUsername || !regPassword) {
        alert("Please fill all fields");
        return;
    }

    localStorage.setItem(
        regUsername,
        JSON.stringify({
            username: regUsername,
            password: regPassword
        })
    );

    alert("Registration Successful");

    // Hide Registration Page
    document.getElementById("register-page").style.display = "none";

    // Show Login Page
    document.getElementById("login-page").style.display = "flex";
}


/* =========================
   LOGIN
========================= */

function login() {

    username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;

    console.log("Username Entered:", username);

    const user =
        JSON.parse(localStorage.getItem(username));

    console.log("User Found:", user);

    if (
        user &&
        user.password === password
    ) {

        alert("Login Successful");

        document.getElementById("login-page").style.display = "none";
        document.getElementById("chat-container").style.display = "block";

    } else {

        alert("Invalid Username or Password");

    }
}


/* =========================
   SEND MESSAGE
========================= */

function sendMessage() {

    const text = input.value.trim();

    if (text === "") return;

    const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    socket.emit("chat message", {
        user: username,
        message: text,
        timestamp: time
    });

    input.value = "";
}


/* =========================
   ENTER KEY SUPPORT
========================= */

input.addEventListener("keypress", function(event) {

    if (event.key === "Enter") {
        sendMessage();
    }

});


/* =========================
   RECEIVE MESSAGE
========================= */

socket.on("chat message", (data) => {

    const div = document.createElement("div");

    if (data.user === username) {
        div.classList.add("message", "sent");
    } else {
        div.classList.add("message", "received");
    }

    div.innerHTML = `
        <div class="username">${data.user}</div>
        <div class="text">${data.message}</div>
        <div class="timestamp">${data.timestamp}</div>
    `;

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;
});