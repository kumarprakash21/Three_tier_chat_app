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
let selectedGroupId = "";
let groups = [];
let pendingReply = null;

let users = [];

let typingTimeout = null;

let currentProfile = {
    notifications: true,
    profilePicture: ""
};

let cropImage = null;
let cropTarget = "profile";
let cropZoom = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDragging = false;
let cropStartX = 0;
let cropStartY = 0;

let pendingAttachment = null;


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


function showToast(message, type = "info") {

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.getElementById("toast-container").appendChild(toast);

    setTimeout(() => toast.classList.add("visible"), 10);

    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// Keeps existing authentication messages in the same in-app notification style.
function alert(message) {
    showToast(message, "info");
}

function closeModal() {
    const modal = document.getElementById("app-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

function showActionModal({ title, message, inputValue = null, confirmLabel = "Confirm", danger = false }) {

    return new Promise(resolve => {

        const modal = document.getElementById("app-modal");
        const input = document.getElementById("modal-input");
        const confirmButton = document.getElementById("modal-confirm");
        const cancelButton = document.getElementById("modal-cancel");

        document.getElementById("modal-title").textContent = title;
        document.getElementById("modal-message").textContent = message;
        confirmButton.textContent = confirmLabel;
        confirmButton.classList.toggle("modal-danger", danger);
        input.value = inputValue === null ? "" : inputValue;
        input.style.display = inputValue === null ? "none" : "block";

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");

        const finish = value => {
            closeModal();
            confirmButton.onclick = null;
            cancelButton.onclick = null;
            resolve(value);
        };

        confirmButton.onclick = () => finish(inputValue === null ? true : input.value);
        cancelButton.onclick = () => finish(null);

        if (inputValue !== null) {
            input.focus();
            input.select();
        } else {
            confirmButton.focus();
        }
    });
}

function applyProfile(profile) {

    currentProfile = { ...currentProfile, ...profile };

    const displayName =
        currentProfile.displayName || currentProfile.username || username;

    document.getElementById("logged-user").textContent = displayName;

    const avatar = document.getElementById("profile-avatar");
    avatar.textContent = displayName.charAt(0).toUpperCase();
    avatar.style.backgroundImage = currentProfile.profilePicture
        ? `url("${currentProfile.profilePicture}")`
        : "";
    avatar.classList.toggle("has-image", Boolean(currentProfile.profilePicture));
}

function renderChatAvatar(avatar, label, profilePicture = "") {
    const fallback = (label || "?").charAt(0).toUpperCase();
    avatar.replaceChildren();
    avatar.classList.remove("has-image");
    avatar.style.backgroundImage = "";

    if (!profilePicture) {
        avatar.textContent = fallback;
        return;
    }

    const image = document.createElement("img");
    image.src = profilePicture;
    image.alt = `${label || "User"} profile picture`;
    image.addEventListener("error", () => {
        avatar.replaceChildren();
        avatar.textContent = fallback;
        avatar.classList.remove("has-image");
    }, { once: true });
    avatar.appendChild(image);
    avatar.classList.add("has-image");
}

function openMobileChat() {
    document.getElementById("chat-container").classList.add("mobile-chat-open");
}

function closeMobileChat() {
    document.getElementById("chat-container").classList.remove("mobile-chat-open");
}

function resetSelectedChat() {
    selectedUserId = "";
    selectedGroupId = "";
    selectedUsername = "";
    input.value = "";
    input.disabled = true;
    input.placeholder = "Select a user first...";
    document.getElementById("send-button").disabled = true;
    document.getElementById("chat-username").textContent = "Select a user";
    document.getElementById("chat-status").textContent = "Choose someone to start chatting";
    document.getElementById("mute-group-button").style.display = "none";
    document.getElementById("manage-group-button").style.display = "none";
    document.getElementById("delete-group-button").style.display = "none";
    renderChatAvatar(document.getElementById("chat-avatar"), "?");
    messages.innerHTML = `<div class="empty-chat"><div class="empty-icon">ðŸ’¬</div><h3>Welcome to ChatApp</h3><p>Select a user from the left to start chatting.</p></div>`;
}

function profileRequest(url, options = {}) {
    const token = localStorage.getItem("token");

    return fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
}

async function loadCurrentProfile() {
    try {
        const response = await profileRequest("/api/profile");
        if (response.status === 401) {
            logout();
            return;
        }
        if (!response.ok) return;

        const profile = await response.json();
        applyProfile(profile);
        localStorage.setItem("user", JSON.stringify({
            ...JSON.parse(localStorage.getItem("user") || "{}"),
            ...profile
        }));
    } catch (error) {
        console.error("Restore profile error:", error);
    }
}

async function openProfile() {

    try {
        const response = await profileRequest("/api/profile");
        const profile = await response.json();

        if (!response.ok) {
            showToast(profile.message || "Unable to load profile", "error");
            return;
        }

        applyProfile(profile);
        document.getElementById("display-name-input").value = profile.displayName || "";
        document.getElementById("bio-input").value = profile.bio || "";
        document.getElementById("notifications-input").checked = profile.notifications !== false;

        const preview = document.getElementById("profile-preview");
        preview.textContent = (profile.displayName || profile.username || username).charAt(0).toUpperCase();
        preview.style.backgroundImage = profile.profilePicture ? `url("${profile.profilePicture}")` : "";
        preview.classList.toggle("has-image", Boolean(profile.profilePicture));

        document.getElementById("profile-presence-text").textContent = socket?.connected
            ? "Online now"
            : `Offline • last seen ${formatLastSeen(profile.lastSeen)}`;

        document.getElementById("profile-modal").classList.add("open");
        document.getElementById("profile-modal").setAttribute("aria-hidden", "false");

    } catch (error) {
        console.error("Load profile error:", error);
        showToast("Unable to connect to server", "error");
    }
}

function closeProfile() {
    const modal = document.getElementById("profile-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

document.getElementById("profile-modal").addEventListener("click", event => {
    if (event.target.id === "profile-modal") closeProfile();
});

function openPasswordForm() {
    closeProfile();
    document.getElementById("password-modal").classList.add("open");
    document.getElementById("password-modal").setAttribute("aria-hidden", "false");
    document.getElementById("current-password-input").focus();
}

function closePasswordForm() {
    const modal = document.getElementById("password-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

document.getElementById("password-modal").addEventListener("click", event => {
    if (event.target.id === "password-modal") closePasswordForm();
});

function startImageCrop(event, target) {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Please select an image file", "error");
        event.target.value = "";
        return;
    }

    cropTarget = target;
    const reader = new FileReader();
    reader.onload = () => {
        cropImage = new Image();
        cropImage.onload = () => {
            cropZoom = 1;
            cropOffsetX = 0;
            cropOffsetY = 0;
            drawCrop();
            document.getElementById("crop-modal").classList.add("open");
            document.getElementById("crop-modal").setAttribute("aria-hidden", "false");
        };
        cropImage.src = reader.result;
    };
    reader.readAsDataURL(file);
}

document.getElementById("profile-picture-input").addEventListener("change", event => startImageCrop(event, "profile"));
document.getElementById("group-picture-input").addEventListener("change", event => startImageCrop(event, "group"));

document.getElementById("crop-zoom").addEventListener("input", event => {
    cropZoom = Number(event.target.value);
    drawCrop();
});

const cropCanvas = document.getElementById("crop-canvas");

cropCanvas.addEventListener("pointerdown", event => {
    cropDragging = true;
    cropStartX = event.clientX - cropOffsetX;
    cropStartY = event.clientY - cropOffsetY;
    cropCanvas.setPointerCapture(event.pointerId);
});

cropCanvas.addEventListener("pointermove", event => {
    if (!cropDragging) return;
    cropOffsetX = event.clientX - cropStartX;
    cropOffsetY = event.clientY - cropStartY;
    drawCrop();
});

cropCanvas.addEventListener("pointerup", () => {
    cropDragging = false;
});

function drawCrop() {

    if (!cropImage) return;

    const context = cropCanvas.getContext("2d");
    const canvasSize = cropCanvas.width;
    const baseScale = Math.max(
        canvasSize / cropImage.width,
        canvasSize / cropImage.height
    );
    const scale = baseScale * cropZoom;
    const imageWidth = cropImage.width * scale;
    const imageHeight = cropImage.height * scale;

    const maxX = Math.max(0, (imageWidth - canvasSize) / 2);
    const maxY = Math.max(0, (imageHeight - canvasSize) / 2);
    cropOffsetX = Math.max(-maxX, Math.min(maxX, cropOffsetX));
    cropOffsetY = Math.max(-maxY, Math.min(maxY, cropOffsetY));

    context.clearRect(0, 0, canvasSize, canvasSize);
    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvasSize, canvasSize);
    context.drawImage(
        cropImage,
        (canvasSize - imageWidth) / 2 + cropOffsetX,
        (canvasSize - imageHeight) / 2 + cropOffsetY,
        imageWidth,
        imageHeight
    );
}

function closeCropper() {
    cropImage = null;
    document.getElementById("profile-picture-input").value = "";
    document.getElementById("group-picture-input").value = "";
    const modal = document.getElementById("crop-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

async function applyCrop() {

    if (!cropImage) return;

    const croppedImage = cropCanvas.toDataURL("image/jpeg", 0.88);
    if (cropTarget === "group") {
        try {
            showToast("Uploading group picture...");
            const attachment = await uploadAttachment(dataUrlToFile(croppedImage, "group-picture.jpg"));
            const response = await profileRequest(`/api/groups/${selectedGroupId}/profile-picture`, {
                method: "PATCH",
                body: JSON.stringify({ profilePicture: attachment.url })
            });
            const data = await response.json();
            if (!response.ok) return showToast(data.message || "Unable to update group picture", "error");
            const group = groups.find(item => item._id === selectedGroupId);
            if (group) {
                group.profilePicture = data.profilePicture;
                renderGroups();
                openGroup(group);
            }
            closeCropper();
            showToast("Group picture updated", "success");
        } catch (error) {
            showToast(error.message, "error");
        }
        return;
    }
    const preview = document.getElementById("profile-preview");
    preview.style.backgroundImage = `url("${croppedImage}")`;
    preview.classList.add("has-image");
    currentProfile.profilePicture = croppedImage;
    closeCropper();
    showToast("Photo cropped. Save your profile to apply it.", "success");
}

function dataUrlToFile(dataUrl, filename) {
    const [header, base64] = dataUrl.split(",");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], filename, { type: header.match(/data:(.*);base64/)[1] });
}

const emojiList = ["😀", "😂", "😍", "🥳", "😊", "😎", "😭", "😡", "👍", "👎", "❤️", "🔥", "🎉", "👏", "🙏", "✅", "💯", "✨", "🤝", "🚀"];
const emojiPicker = document.getElementById("emoji-picker");

emojiList.forEach(emoji => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.addEventListener("click", () => {
        input.value += emoji;
        input.focus();
        emojiPicker.classList.remove("open");
    });
    emojiPicker.appendChild(button);
});

document.getElementById("emoji-button").addEventListener("click", () => {
    emojiPicker.classList.toggle("open");
});

document.addEventListener("click", event => {
    if (
        !emojiPicker.contains(event.target) &&
        event.target !== document.getElementById("emoji-button")
    ) {
        emojiPicker.classList.remove("open");
    }
});

document.getElementById("create-group-button").addEventListener("click", createGroup);
document.getElementById("mute-group-button").addEventListener("click", toggleGroupMute);
document.getElementById("manage-group-button").addEventListener("click", manageGroup);
document.getElementById("delete-group-button").addEventListener("click", deleteGroup);
document.getElementById("group-members-modal").addEventListener("click", event => {
    if (event.target.id === "group-members-modal") closeGroupMembers();
});

document.getElementById("attachment-button").addEventListener("click", () => {
    if (!selectedUserId && !selectedGroupId) {
        showToast("Select a chat or group before attaching a file", "error");
        return;
    }
    document.getElementById("attachment-input").click();
});

document.getElementById("attachment-input").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
        showToast("Files must be 50 MB or smaller", "error");
        event.target.value = "";
        return;
    }

    pendingAttachment = file;
    const preview = document.getElementById("attachment-preview");
    preview.innerHTML = `<span>📎 ${escapeHtml(file.name)} · ${formatFileSize(file.size)}</span><button type="button" aria-label="Remove attachment">×</button>`;
    preview.style.display = "flex";
    preview.querySelector("button").addEventListener("click", clearAttachment);
});

function clearAttachment() {
    pendingAttachment = null;
    document.getElementById("attachment-input").value = "";
    document.getElementById("attachment-preview").style.display = "none";
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadAttachment(file) {
    const response = await fetch("/api/upload", {
        method: "POST",
        body: file,
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name)
        }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to upload file");
    return data;
}

async function saveProfile() {

    let profilePicture = currentProfile.profilePicture || "";

    try {
        const response = await profileRequest("/api/profile", {
            method: "PATCH",
            body: JSON.stringify({
                displayName: document.getElementById("display-name-input").value,
                bio: document.getElementById("bio-input").value,
                profilePicture,
                notifications: document.getElementById("notifications-input").checked
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || "Unable to update profile", "error");
            return;
        }

        currentProfile = { ...currentProfile, ...data };
        localStorage.setItem("user", JSON.stringify({
            ...JSON.parse(localStorage.getItem("user") || "{}"),
            ...data
        }));
        applyProfile(data);
        closeProfile();
        showToast("Profile updated successfully", "success");

    } catch (error) {
        console.error("Update profile error:", error);
        showToast("Unable to connect to server", "error");
    }
}

async function changePassword() {

    const currentPassword = document.getElementById("current-password-input").value;
    const newPassword = document.getElementById("new-password-input").value;
    const confirmation = document.getElementById("confirm-password-input").value;

    if (newPassword !== confirmation) {
        showToast("New passwords do not match", "error");
        return;
    }

    try {
        const response = await profileRequest("/api/password", {
            method: "PATCH",
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || "Unable to change password", "error");
            return;
        }

        document.getElementById("current-password-input").value = "";
        document.getElementById("new-password-input").value = "";
        document.getElementById("confirm-password-input").value = "";
        closePasswordForm();
        showToast("Password changed successfully", "success");

    } catch (error) {
        console.error("Change password error:", error);
        showToast("Unable to connect to server", "error");
    }
}

document.getElementById("app-modal").addEventListener("click", event => {
    if (event.target.id === "app-modal") {
        document.getElementById("modal-cancel").click();
    }
});

document.addEventListener("keydown", event => {
    const modal = document.getElementById("app-modal");
    const cropModal = document.getElementById("crop-modal");

    if (cropModal.classList.contains("open") && event.key === "Escape") {
        closeCropper();
        return;
    }

    if (!modal.classList.contains("open")) return;

    if (event.key === "Escape") {
        document.getElementById("modal-cancel").click();
    }

    if (
        event.key === "Enter" &&
        document.activeElement === document.getElementById("modal-input")
    ) {
        document.getElementById("modal-confirm").click();
    }
});


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

        alert(
            "Please fill all fields"
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

            if (response.status === 409) {
                await showActionModal({
                    title: "Registration failed",
                    message: "Username already exists",
                    confirmLabel: "OK"
                });
                return;
            }

            alert(
                data.message ||
                "Registration failed"
            );

            return;
        }


        await showActionModal({
            title: "Registration completed",
            message: "Your account has been created successfully. You can now log in.",
            confirmLabel: "Continue"
        });


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

    const loginButton = document.querySelector("#login-page button");
    if (loginButton.disabled) return;

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

        await showActionModal({
            title: "Login required",
            message: "Please enter both username and password.",
            confirmLabel: "OK"
        });

        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";


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

            await showActionModal({
                title: "Login failed",
                message: data.message || "Invalid username or password.",
                confirmLabel: "Try again"
            });

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

applyProfile(data.user);


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
        loadCurrentProfile();


    } catch (error) {

        console.error(error);

        await showActionModal({
            title: "Connection problem",
            message: "Unable to connect to the server. Please try again.",
            confirmLabel: "OK"
        });

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
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

            loadGroups();

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

            if (
                data.sender !== currentUserId &&
                data.sender !== selectedUserId &&
                currentProfile.notifications !== false
            ) {
                const sender = users.find(user => user.id === data.sender);
                showToast(`New message from ${sender?.displayName || sender?.username || "a contact"}`);
            }

        }
    );


    /*
    ==============================================
    CONVERSATION UPDATED
    ==============================================
    */

    socket.on(
        "conversation updated",
        () => {

            loadUsers();

        }
    );


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

    socket.on(
        "messages read",
        (data) => {

            if (
                data?.userId === selectedUserId
            ) {

                document
                    .querySelectorAll(".message.sent .message-status")
                    .forEach(status => {
                        status.classList.remove("sent");
                        status.classList.add("read");
                        status.textContent = "✓✓";
                    });

            }

            loadUsers();

        }
    );


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

                    let edited =
                        element.querySelector(".edited");

                    if (!edited) {
                        edited = document.createElement("span");
                        edited.className = "edited";
                        edited.textContent = "edited";
                        element.querySelector(".message-time")?.appendChild(edited);
                    }

                }

            }


            loadUsers();

        }
    );

    socket.on("group message", data => {
        if (data.groupId === selectedGroupId) addMessage(data);
        if (currentProfile.notifications !== false && data.sender !== currentUserId && data.groupId !== selectedGroupId) {
            showToast(`New message in ${groups.find(group => group._id === data.groupId)?.name || "group"}`);
        }
        loadGroups();
    });

    socket.on("group updated", () => loadGroups());
    socket.on("group deleted", data => {
        if (data?.groupId === selectedGroupId) resetSelectedChat();
        loadGroups();
    });

    socket.on("message reaction", data => {
        const element = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (element) renderReactions(element, data.reactions || []);
    });

    socket.on("message pinned", data => {
        const element = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (element) element.classList.toggle("pinned-message", data.pinned);
    });

    socket.on(
        "account deleted",
        () => logout(false)
    );

    socket.on(
        "user deleted",
        () => loadUsers()
    );

    socket.on(
        "profile updated",
        data => {
            const user = users.find(item => item.id === data.userId);

            if (user) {
                user.displayName = data.displayName;
                user.profilePicture = data.profilePicture;
                renderUsers(users);
            }

            if (selectedUserId === data.userId) {
                const chatAvatar = document.getElementById("chat-avatar");
                renderChatAvatar(chatAvatar, data.displayName || selectedUsername, data.profilePicture);
            }
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
                (user.displayName || user.username)
                    .charAt(0)
                    .toUpperCase();

            if (user.profilePicture) {
                const avatarImage = document.createElement("img");
                avatarImage.src = user.profilePicture;
                avatarImage.alt = `${user.username} profile picture`;
                avatar.textContent = "";
                avatar.appendChild(avatarImage);
                avatar.classList.add("has-image");
            }


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
                user.displayName || user.username;


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

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "remove-chat-button";
            removeButton.innerHTML = "&#x2715;";
            removeButton.title = `Remove ${user.username} from chats`;
            removeButton.setAttribute("aria-label", `Remove ${user.username} from chats`);
            removeButton.addEventListener("click", event => {
                event.stopPropagation();
                removeChat(user);
            });

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

            item.appendChild(removeButton);


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

async function openChat(
    user
) {

    openMobileChat();
    selectedGroupId = "";
    selectedUserId =
        user.id;

    selectedUsername =
        user.username;


    /*
    Update header
    */

    document.getElementById(
        "chat-username"
    ).textContent =
        user.username;


    const chatAvatar = document.getElementById("chat-avatar");
    renderChatAvatar(chatAvatar, user.displayName || user.username, user.profilePicture);


    updateSelectedUserStatus();

    document.getElementById("mute-group-button").style.display = "none";
    document.getElementById("manage-group-button").style.display = "none";
    document.getElementById("delete-group-button").style.display = "none";


    /*
    Enable message input
    */

    input.disabled =
        false;

    input.placeholder =
        `Message ${user.username}...`;

    document.getElementById(
        "send-button"
    ).disabled =
        false;


    /*
    Clear previous messages
    */

    messages.innerHTML = "";


    /*
    Load conversation
    */

    await loadMessages(
        user.id
    );


    /*
    Tell server that messages
    have been read
    */

    if (socket) {

        socket.emit(
            "mark read",
            user.id
        );

    }


    /*
    Refresh list.

    This removes the unread badge.
    */

    await loadUsers();

}


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

    // Socket.IO messages use `id`; MongoDB history uses `_id`.
    const messageId = data.id || data._id;
    const messageTimestamp = data.timestamp || data.createdAt;

    /*
    Avoid duplicate messages
    */

    if (
        messageId &&
        document.querySelector(
            `[data-message-id="${messageId}"]`
        )
    ) {
        return;
    }


    const div =
        document.createElement("div");


    div.classList.add("message");


    if (messageId) {

        div.dataset.messageId =
            messageId;

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
            : (data.senderName || selectedUsername);


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
            messageTimestamp
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

    if (data.attachment) {
        div.appendChild(createAttachmentElement(data.attachment));
    }

    if (data.replyTo) {
        const reply = document.createElement("div");
        reply.className = "message-reply";
        reply.textContent = `↪ ${data.replyTo.senderName}: ${data.replyTo.message || "Attachment"}`;
        div.appendChild(reply);
    }

    div.appendChild(
        textDiv
    );

    div.appendChild(
        timeDiv
    );


    messages.appendChild(
        div
    );

    if (messageId) {

        const actions = document.createElement("div");
        actions.className = "message-actions";

        if (isMyMessage) {
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "message-action";
            editButton.textContent = "Edit";
            editButton.onclick = () => editMessage(messageId, data.message);
            actions.appendChild(editButton);
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "message-action message-action-danger";
        deleteButton.textContent = "Delete";
        deleteButton.onclick = () => deleteMessage(messageId);

        actions.appendChild(deleteButton);

        if (data.groupId || selectedUserId) {
            const replyButton = document.createElement("button");
            replyButton.type = "button";
            replyButton.className = "message-action";
            replyButton.textContent = "Reply";
            replyButton.onclick = () => {
                pendingReply = { messageId, senderName: data.senderName || selectedUsername, message: data.message };
                showToast("Replying to this message");
                input.focus();
            };
            actions.appendChild(replyButton);

            const reactionButton = document.createElement("button");
            reactionButton.type = "button";
            reactionButton.className = "message-action";
            reactionButton.textContent = "👍";
            reactionButton.onclick = () => socket?.emit("message reaction", { messageId, emoji: "👍" });
            actions.appendChild(reactionButton);

            const group = groups.find(item => item._id === data.groupId);
            if (group?.isAdmin) {
                const pinButton = document.createElement("button");
                pinButton.type = "button";
                pinButton.className = "message-action";
                pinButton.textContent = data.pinned ? "Unpin" : "Pin";
                pinButton.onclick = () => socket?.emit("pin message", { messageId, pinned: !data.pinned });
                actions.appendChild(pinButton);
            }
        }

        div.appendChild(actions);
    }

    if (data.reactions?.length) renderReactions(div, data.reactions);
    if (data.pinned) div.classList.add("pinned-message");


    scrollToBottom();

}

function renderReactions(element, reactions) {
    let bar = element.querySelector(".reaction-bar");
    if (!bar) {
        bar = document.createElement("div");
        bar.className = "reaction-bar";
        element.appendChild(bar);
    }
    bar.textContent = [...new Set(reactions.map(reaction => reaction.emoji))].join(" ");
}

async function loadGroups() {
    const response = await profileRequest("/api/groups");
    if (!response.ok) return;
    groups = await response.json();
    renderGroups();
    const selectedGroup = groups.find(group => group._id === selectedGroupId);
    if (selectedGroup) {
        const chatAvatar = document.getElementById("chat-avatar");
        renderChatAvatar(chatAvatar, selectedGroup.name, selectedGroup.profilePicture);
    }
    if (socket) socket.emit("join groups", groups.map(group => group._id));
}

function renderGroups() {
    const list = document.getElementById("group-list");
    list.innerHTML = "";
    groups.forEach(group => {
        const item = document.createElement("div");
        item.className = `user-item group-item${group._id === selectedGroupId ? " active" : ""}`;
        item.innerHTML = `<div class="user-avatar group-avatar">${escapeHtml(group.name.charAt(0).toUpperCase())}</div><div class="user-info"><div class="user-name">${escapeHtml(group.name)}</div><div class="last-message">${group.members.length} members${group.muted ? " · muted" : ""}</div></div>`;
        const avatar = item.querySelector(".group-avatar");
        if (group.profilePicture) {
            avatar.textContent = "";
            const avatarImage = document.createElement("img");
            avatarImage.src = group.profilePicture;
            avatarImage.alt = `${group.name} group picture`;
            avatar.appendChild(avatarImage);
            avatar.classList.add("has-image");
        }
        item.addEventListener("click", () => openGroup(group));
        list.appendChild(item);
    });
}

async function createGroup() {
    const name = await showActionModal({ title: "Create group", message: "Choose a name for your new group.", inputValue: "", confirmLabel: "Create" });
    if (!name || !name.trim()) return;
    const response = await profileRequest("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
    const data = await response.json();
    if (!response.ok) return showToast(data.message || "Unable to create group", "error");
    showToast("Group created", "success");
    loadGroups();
}

async function openGroup(group) {
    openMobileChat();
    selectedGroupId = group._id;
    selectedUserId = "";
    selectedUsername = group.name;
    if (socket) socket.emit("join groups", [group._id]);
    document.getElementById("chat-username").textContent = group.name;
    document.getElementById("chat-status").textContent = `${group.members.length} members`;
    const chatAvatar = document.getElementById("chat-avatar");
    renderChatAvatar(chatAvatar, group.name, group.profilePicture);
    document.getElementById("mute-group-button").style.display = "inline-block";
    document.getElementById("mute-group-button").textContent = group.muted ? "Unmute" : "Mute";
    document.getElementById("manage-group-button").style.display = "inline-block";
    document.getElementById("delete-group-button").style.display = String(group.owner) === String(currentUserId) ? "inline-block" : "none";
    input.disabled = false;
    input.placeholder = `Message ${group.name}...`;
    document.getElementById("send-button").disabled = false;
    messages.innerHTML = "";
    const response = await profileRequest(`/api/groups/${group._id}/messages`);
    if (response.ok) (await response.json()).forEach(message => addMessage({ ...message, groupId: group._id, senderName: group.members.find(member => member._id === message.sender)?.username }));
    renderGroups();
}

async function manageGroup() {
    const group = groups.find(item => item._id === selectedGroupId);
    if (!group) return;

    document.getElementById("members-title").textContent = `${group.name} members`;
    document.getElementById("members-subtitle").textContent = `${group.members.length} members`;
    document.getElementById("member-management-form").style.display = group.isAdmin ? "block" : "none";
    renderGroupMembers(group);

    const modal = document.getElementById("group-members-modal");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
}

async function deleteGroup() {
    const group = groups.find(item => item._id === selectedGroupId);
    if (!group || String(group.owner) !== String(currentUserId)) return;

    const confirmed = await showActionModal({
        title: "Delete group?",
        message: `Delete ${group.name} and all of its messages permanently?`,
        confirmLabel: "Delete group",
        danger: true
    });
    if (!confirmed) return;

    try {
        const response = await profileRequest(`/api/groups/${group._id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) {
            showToast(data.message || "Unable to delete group", "error");
            return;
        }

        resetSelectedChat();
        closeMobileChat();
        showToast("Group deleted", "success");
        await loadGroups();
    } catch (error) {
        console.error("Delete group error:", error);
        showToast("Unable to connect to server", "error");
    }
}

function renderGroupMembers(group) {
    const list = document.getElementById("group-members-list");
    list.innerHTML = "";
    group.members.forEach(member => {
        const row = document.createElement("div");
        row.className = "group-member-row";
        const isAdmin = group.admins.some(admin => String(admin) === String(member._id));
        row.innerHTML = `<span class="member-avatar">${escapeHtml((member.displayName || member.username).charAt(0).toUpperCase())}</span><span class="member-name">${escapeHtml(member.displayName || member.username)}</span>${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}`;
        if (group.isAdmin && String(member._id) !== String(group.owner)) {
            const adminButton = document.createElement("button");
            adminButton.className = "member-remove-button";
            adminButton.textContent = isAdmin ? "Remove admin" : "Make admin";
            adminButton.onclick = () => updateGroupMember(member._id, isAdmin ? "demote" : "promote");
            row.appendChild(adminButton);

            const removeButton = document.createElement("button");
            removeButton.className = "member-remove-button";
            removeButton.textContent = "Remove";
            removeButton.onclick = () => updateGroupMember(member._id, "remove");
            row.appendChild(removeButton);
        }
        list.appendChild(row);
    });
}

function closeGroupMembers() {
    const modal = document.getElementById("group-members-modal");
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

async function updateGroupMemberFromInput(action) {
    const username = document.getElementById("member-username-input").value.trim();
    const member = users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (!member) return showToast("User not found", "error");
    await updateGroupMember(member.id, action);
    document.getElementById("member-username-input").value = "";
}

async function updateGroupMember(userId, action) {
    const response = await profileRequest(`/api/groups/${selectedGroupId}/members`, { method: "PATCH", body: JSON.stringify({ userId, action }) });
    const data = await response.json();
    if (!response.ok) return showToast(data.message || "Unable to update members", "error");
    showToast(`Member ${action === "add" ? "added" : action === "promote" ? "promoted to admin" : action === "demote" ? "removed as admin" : "removed"}`, "success");
    groups = await (await profileRequest("/api/groups")).json();
    const group = groups.find(item => item._id === selectedGroupId);
    if (group) renderGroupMembers(group);
    renderGroups();
}

async function toggleGroupMute() {
    const group = groups.find(item => item._id === selectedGroupId);
    if (!group) return;
    const muted = !group.muted;
    const response = await profileRequest(`/api/groups/${selectedGroupId}/mute`, { method: "PATCH", body: JSON.stringify({ muted }) });
    if (response.ok) { group.muted = muted; document.getElementById("mute-group-button").textContent = muted ? "Unmute" : "Mute"; showToast(muted ? "Group muted" : "Group unmuted", "success"); renderGroups(); }
}

function createAttachmentElement(attachment) {

    const wrapper = document.createElement("div");
    wrapper.className = "message-attachment";

    if (attachment.type?.startsWith("image/")) {
        const image = document.createElement("img");
        image.src = attachment.url;
        image.alt = attachment.name;
        wrapper.appendChild(image);
    } else if (attachment.type?.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = attachment.url;
        video.controls = true;
        wrapper.appendChild(video);
    }

    const link = document.createElement("a");
    link.href = attachment.url;
    link.download = attachment.name;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `⬇ ${attachment.name} · ${formatFileSize(attachment.size || 0)}`;
    wrapper.appendChild(link);

    return wrapper;
}


async function removeChat(user) {

    const confirmed = await showActionModal({
        title: "Remove chat?",
        message: `${user.username} will be removed from your chat list. Your message history will be kept.`,
        confirmLabel: "Remove",
        danger: true
    });

    if (!confirmed) return;

    const token = localStorage.getItem("token");

    try {

        const response = await fetch(`/api/chats/${user.id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.message || "Unable to remove chat", "error");
            return;
        }

        if (selectedUserId === user.id) {
            selectedUserId = "";
            selectedUsername = "";
            input.value = "";
            input.disabled = true;
            input.placeholder = "Select a user first...";
            document.getElementById("send-button").disabled = true;
            document.getElementById("chat-username").textContent = "Select a user";
            document.getElementById("chat-status").textContent = "Choose someone to start chatting";
            messages.innerHTML = `<div class="empty-chat"><div class="empty-icon">ðŸ’¬</div><h3>Welcome to ChatApp</h3><p>Select a user from the left to start chatting.</p></div>`;
        }

        showToast(`${user.username} removed from your chats`, "success");
        loadUsers();

    } catch (error) {
        console.error("Remove chat error:", error);
        showToast("Unable to connect to server", "error");
    }
}


async function editMessage(messageId, currentMessage) {

    if (!socket) return;

    const updatedMessage = await showActionModal({
        title: "Edit message",
        message: "Update your message below.",
        inputValue: currentMessage,
        confirmLabel: "Save"
    });

    if (updatedMessage === null) return;

    const cleanMessage = updatedMessage.trim();

    if (!cleanMessage) {
        showToast("Message cannot be empty", "error");
        return;
    }

    if (cleanMessage.length > 2000) {
        showToast("Message must be 2000 characters or fewer", "error");
        return;
    }

    socket.emit("edit message", {
        messageId,
        message: cleanMessage
    });
}

async function deleteMessage(messageId) {

    const confirmed = await showActionModal({
        title: "Delete message?",
        message: "This message will be removed for both participants.",
        confirmLabel: "Delete",
        danger: true
    });

    if (socket && confirmed) {
        socket.emit("delete message", messageId);
    }
}


/*
==================================================
SEND MESSAGE
==================================================
*/

async function sendMessage() {

    const text =
        input.value.trim();


    if (
        (!text && !pendingAttachment) ||
        (!selectedUserId && !selectedGroupId) ||
        !socket
    ) {

        return;

    }


    let attachment = null;

    if (pendingAttachment) {
        try {
            showToast(`Uploading ${pendingAttachment.name}...`);
            attachment = await uploadAttachment(pendingAttachment);
        } catch (error) {
            showToast(error.message, "error");
            return;
        }
    }

    if (selectedGroupId) {
        socket.emit("group message", {
            groupId: selectedGroupId,
            message: text,
            attachment,
            replyTo: pendingReply
        });
        pendingReply = null;
        input.value = "";
        clearAttachment();
        return;
    }

    socket.emit(
        "private message",
        {

            receiverId:
                selectedUserId,

            message:
                text,

            attachment,

            replyTo: pendingReply

        }
    );


    pendingReply = null;
    input.value = "";
    clearAttachment();


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

function logout(showLoginPage = true) {

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


    if (showLoginPage) {
        document.getElementById(
            "login-page"
        ).style.display = "flex";
    }


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


async function deleteAccount() {

    const confirmed = await showActionModal({
        title: "Delete account?",
        message: "Your account and all messages will be permanently deleted.",
        confirmLabel: "Delete account",
        danger: true
    });

    if (!confirmed) {
        return;
    }

    const token = localStorage.getItem("token");

    try {

        const response = await fetch("/api/account", {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
        showToast(data.message || "Unable to delete account", "error");
            return;
        }

        showToast("Your account has been deleted", "success");
        logout();

    } catch (error) {
        console.error("Delete account error:", error);
        showToast("Unable to connect to server", "error");
    }
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

        document.documentElement.classList.remove("app-loading");

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

                applyProfile(user);


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
                loadCurrentProfile();


            } catch (error) {

                console.error(
                    error
                );

                logout();

            }

        }

    }
);
