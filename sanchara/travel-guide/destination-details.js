console.log("DESTINATION DETAILS LOADED");

// Modal elements
const destinationModal = document.getElementById("destination-modal");

const closeModalButton = document.getElementById("close-modal");

const modalImage = document.getElementById("modal-image");

const modalTitle = document.getElementById("modal-title");

const modalCategory = document.getElementById("modal-category");

const modalDescription = document.getElementById("modal-description");

const modalLocation = document.getElementById("modal-location");

const modalHours = document.getElementById("modal-hours");

const modalBestTime = document.getElementById("modal-best-time");

const directionsButton = document.getElementById("directions-button");


// Destination information
const destinationDetails = {

    "Bangalore Palace": {
        location: "Vasanth Nagar, Bengaluru",
        hours: "Check official visiting hours before visiting",
        bestTime: "Morning or late afternoon"
    },

    "Cubbon Park": {
        location: "Central Bengaluru",
        hours: "Morning and evening",
        bestTime: "Early morning or evening"
    },

    "Isckon Temple": {
        location: "Rajajinagar, Bengaluru",
        hours: "Check temple timings before visiting",
        bestTime: "Morning or evening"
    },

    "MG Road": {
        location: "Central Bengaluru",
        hours: "Shopping hours vary by store",
        bestTime: "Evening"
    },

    "National Gallery of Mordern Art": {
        location: "Manikyavelu Mansion, Bengaluru",
        hours: "Check museum timings before visiting",
        bestTime: "Late morning"
    },

    "Central Tiffen Room": {
        location: "Malleswaram, Bengaluru",
        hours: "Check restaurant timings",
        bestTime: "Breakfast"
    },

    "Vidyarthi Bhavan": {
        location: "Gandhi Bazaar, Basavanagudi, Bengaluru",
        hours: "Check restaurant timings",
        bestTime: "Breakfast"
    },

    "MTR": {
        location: "Lalbagh Road, Bengaluru",
        hours: "Check restaurant timings",
        bestTime: "Breakfast or lunch"
    },

    "Rameshwaram Cafe": {
        location: "Multiple locations in Bengaluru",
        hours: "Check the selected branch",
        bestTime: "Breakfast or evening"
    },

    "Meghana Foods": {
        location: "Multiple locations in Bengaluru",
        hours: "Check the selected branch",
        bestTime: "Lunch or dinner"
    },

    "Nagarjuna": {
        location: "Multiple locations in Bengaluru",
        hours: "Check restaurant timings",
        bestTime: "Lunch"
    },

    "Truffles": {
        location: "Multiple locations in Bengaluru",
        hours: "Check the selected branch",
        bestTime: "Lunch or dinner"
    },

    "Corner House": {
        location: "Multiple locations in Bengaluru",
        hours: "Check the selected branch",
        bestTime: "Evening"
    },

    "DYU Art Cafe": {
        location: "Koramangala, Bengaluru",
        hours: "Check cafe timings",
        bestTime: "Afternoon"
    },

    "Third Wave Coffee": {
        location: "Multiple locations in Bengaluru",
        hours: "Check the selected branch",
        bestTime: "Morning or afternoon"
    },

    "Matteo Coffee": {
        location: "MG Road, Bengaluru",
        hours: "Check cafe timings",
        bestTime: "Morning or evening"
    },

    "Commercial Street": {
        location: "Commercial Street, Bengaluru",
        hours: "Shop timings vary",
        bestTime: "Afternoon or evening"
    },

    "Brigade Road": {
        location: "Brigade Road, Bengaluru",
        hours: "Shop timings vary",
        bestTime: "Evening"
    },

    "UB City": {
        location: "Vittal Mallya Road, Bengaluru",
        hours: "Check mall timings",
        bestTime: "Afternoon or evening"
    },

    "Orion Mall": {
        location: "Rajajinagar, Bengaluru",
        hours: "Check mall timings",
        bestTime: "Afternoon or evening"
    },

    "Phoenix Marketcity": {
        location: "Whitefield, Bengaluru",
        hours: "Check mall timings",
        bestTime: "Afternoon or evening"
    },

    "Lalbagh Botanical Garden": {
        location: "Lalbagh, Bengaluru",
        hours: "Check garden timings",
        bestTime: "Early morning"
    },

    "Ulsoor Lake": {
        location: "Ulsoor, Bengaluru",
        hours: "Check access timings",
        bestTime: "Early morning or evening"
    },

    "Sankey Tank": {
        location: "Sadashivanagar, Bengaluru",
        hours: "Check access timings",
        bestTime: "Early morning or evening"
    },

    "Vidhana Soudha": {
        location: "Dr Ambedkar Veedhi, Bengaluru",
        hours: "Exterior viewing",
        bestTime: "Evening"
    },

    "Tipu Sultan's Summer Palace": {
        location: "Chamrajpet, Bengaluru",
        hours: "Check monument visiting hours",
        bestTime: "Morning"
    }

};


// Open destination details
document.querySelectorAll(".view-details").forEach(function(button) {

    button.addEventListener("click", function() {

        const card = button.closest(".destination-card");

        if (!card) return;

        // Get information from the card
        const title = card.querySelector("h3")?.textContent.trim() || "";

        const category =
            card.querySelector(".destination-category")?.textContent.trim() || "";

        const description =
            card.querySelector("p")?.textContent.trim() || "";

        const image =
            card.querySelector("img")?.src || "";

        // Get extra destination information
        const details = destinationDetails[title] || {};

        // Populate modal
        modalTitle.textContent = title;

        modalCategory.textContent = category;

        modalDescription.textContent = description;

        modalImage.src = image;

        modalImage.alt = title;

        modalLocation.textContent =
            details.location || "Bengaluru, Karnataka";

        modalHours.textContent =
            details.hours || "Check timings before visiting";

        modalBestTime.textContent =
            details.bestTime || "Morning or evening";

        // Google Maps directions
        const mapsURL =
            "https://www.google.com/maps/search/?api=1&query=" +
            encodeURIComponent(title + ", Bengaluru");

        directionsButton.href = mapsURL;

        // Show modal
        destinationModal.classList.add("active");

        document.body.style.overflow = "hidden";

    });

});


// Close modal using close button
closeModalButton.addEventListener("click", function() {

    closeDestinationModal();

});


// Close modal when clicking outside
destinationModal.addEventListener("click", function(event) {

    if (event.target === destinationModal) {

        closeDestinationModal();

    }

});


// Close modal using Escape key
document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {

        closeDestinationModal();

    }

});


// Close modal function
function closeDestinationModal() {

    destinationModal.classList.remove("active");

    document.body.style.overflow = "";

}