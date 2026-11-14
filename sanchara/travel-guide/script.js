
// ================= CHAT FUNCTIONALITY =================

// Get the HTML elements
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Function to display messages
function displayMessage(message, sender) {
    const messageElement = document.createElement("div");

    messageElement.classList.add("chat-message", sender);
    messageElement.textContent = message;

    chatMessages.appendChild(messageElement);

    // Automatically scroll to the latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Handle chat form submission
chatForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const userMessage = chatInput.value.trim();

    if (!userMessage) {
        return;
    }

    // Display user's message
    displayMessage(userMessage, "user-message");

    chatInput.value = "";

    // Show loading message
    const loadingMessage = document.createElement("div");
    loadingMessage.classList.add("chat-message", "bot-message");
    loadingMessage.textContent = "SANCHARA is thinking...";

    chatMessages.appendChild(loadingMessage);

    try {

        // Send message to Flask backend
        const response = await fetch("http://127.0.0.1:5000/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: userMessage
            })
        });

        const data = await response.json();

        loadingMessage.remove();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }

        // Display Gemini's response
        displayMessage(data.reply, "bot-message");

    } catch (error) {

        loadingMessage.remove();

        console.error("Chat error:", error);

        displayMessage(
            "I'm having trouble connecting right now. Please try again!",
            "bot-message"
        );
    }

});

// ================= ADD TO TRIP FUNCTIONALITY =================

document.querySelectorAll(".add-to-trip").forEach(function (button) {

    button.addEventListener("click", function () {

        const added = button.classList.toggle("is-added");

        button.textContent = added ? "Added ✓" : "Add to Trip";

    });

});
