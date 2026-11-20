console.log("SANCHARA SCRIPT LOADED");
// ================= CHAT FUNCTIONALITY =================

// Get HTML elements
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// API URL
const API_URL = "http://127.0.0.1:5000/api";

// Retrieve existing conversation ID
let conversationId = sessionStorage.getItem("sanchara_conversation_id");


// ================= DISPLAY MESSAGES =================

function displayMessage(message, sender) {

    const messageElement = document.createElement("div");

    messageElement.classList.add("chat-message", sender);
    messageElement.textContent = message;

    chatMessages.appendChild(messageElement);

    // Scroll to latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ================= ENSURE CONVERSATION EXISTS =================

async function ensureConversation() {

    if (conversationId) {
        return conversationId;
    }

    const response = await fetch(
        `${API_URL}/new-conversation`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        }
    );

    const data = await response.json();
    console.log("ADD TO TRIP RESPONSE:", data);
console.log("CHAT CONTAINER:", chatMessages);
console.log("DISPLAY FUNCTION:", typeof displayMessage);

    if (!response.ok) {
        throw new Error(
            data.error || "Could not start a conversation"
        );
    }

    conversationId = data.conversation_id;

    sessionStorage.setItem(
        "sanchara_conversation_id",
        conversationId
    );

    return conversationId;
}


// ================= CHAT FORM SUBMISSION =================

chatForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const userMessage = chatInput.value.trim();

    if (!userMessage) {
        return;
    }

    displayMessage(userMessage, "user-message");

    chatInput.value = "";

    const loadingMessage = document.createElement("div");

    loadingMessage.classList.add("chat-message", "bot-message");
    loadingMessage.textContent = "SANCHARA is thinking...";

    chatMessages.appendChild(loadingMessage);

    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {

        const response = await fetch(`${API_URL}/chat`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                message: userMessage,

                conversation_id: conversationId

            })

        });

        const data = await response.json();

        loadingMessage.remove();

        if (!response.ok) {
            throw new Error(
                data.error || "Something went wrong"
            );
        }

        if (data.conversation_id) {

            conversationId = data.conversation_id;

            sessionStorage.setItem(
                "sanchara_conversation_id",
                conversationId
            );

        }

        displayMessage(data.reply, "bot-message");

    }

    catch (error) {

        loadingMessage.remove();

        console.error("Chat error:", error);

        displayMessage(
            "I'm having trouble connecting right now. Please try again!",
            "bot-message"
        );

    }

});


// ================= NEW CONVERSATION =================

async function startNewConversation() {

    try {

        const response = await fetch(
            `${API_URL}/new-conversation`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Could not start a new conversation"
            );
        }

        conversationId = data.conversation_id;

        sessionStorage.setItem(
            "sanchara_conversation_id",
            conversationId
        );

        chatMessages.innerHTML = "";

        displayMessage(
            "Hello! I'm SANCHARA. Where would you like to explore in Bengaluru?",
            "bot-message"
        );

        // Reset all Add to Trip buttons
        document.querySelectorAll(".add-to-trip").forEach(button => {

            button.classList.remove("is-added");
            button.textContent = "Add to Trip";
            button.disabled = false;

        });

    }

    catch (error) {

        console.error("New conversation error:", error);

        alert("Unable to start a new conversation. Please try again.");

    }

}


// Connect optional New Chat button
const newChatButton = document.getElementById("new-chat-button");

if (newChatButton) {

    newChatButton.addEventListener(
        "click",
        startNewConversation
    );

}


// ================= ADD TO TRIP FUNCTIONALITY =================

document.querySelectorAll(".add-to-trip").forEach(function (button) {

    button.addEventListener("click", async function () {

        // Find the destination card
        const destinationCard = button.closest(".destination-card");

        if (!destinationCard) {
            console.error("Destination card not found!");
            return;
        }

        // Get destination details from HTML
        const destinationName = destinationCard
            .querySelector("h3")
            ?.textContent.trim();

        const destinationDescription = destinationCard
            .querySelector("p")
            ?.textContent.trim();

        if (!destinationName) {
            console.error("Destination name not found!");
            return;
        }

        // Prevent repeated clicks while processing
        button.disabled = true;
        button.textContent = "Adding...";

        try {

            // Make sure we have a conversation ID
            await ensureConversation();

            // Send destination to Flask backend
            const response = await fetch(
                `${API_URL}/add-to-trip`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        destination: destinationName,

                        description: destinationDescription,

                        conversation_id: conversationId

                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Could not add destination"
                );
            }

            // Mark button as added only after success
            button.classList.add("is-added");
            button.textContent = "Added ✓";

            // Show the selected destination in chat
            displayMessage(
                `Add ${destinationName} to my trip`,
                "user-message"
            );

            // Display SANCHARA's updated itinerary
            displayMessage(
                data.reply,
                "bot-message"
            );

        }

        catch (error) {

            console.error("Add to Trip error:", error);

            button.disabled = false;
            button.textContent = "Add to Trip";

            displayMessage(
                `I couldn't add ${destinationName} to your trip. Please try again.`,
                "bot-message"
            );

        }

    });

});
