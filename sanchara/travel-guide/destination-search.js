console.log("DESTINATION SEARCH & FILTERS LOADED");

const destinationSearch = document.getElementById("destination-search");
const destinationCards = document.querySelectorAll(".destination-card");
const filterButtons = document.querySelectorAll(".filter-btn");

let selectedCategory = "all";

// Search functionality
function filterDestinations() {
    const searchValue = destinationSearch.value.toLowerCase().trim();

    destinationCards.forEach(function(card) {
        const destinationName =
            card.querySelector("h3")?.textContent.toLowerCase() || "";

        const destinationCategory =
            card.querySelector(".destination-category")?.textContent.toLowerCase() || "";

        const destinationDescription =
            card.querySelector("p")?.textContent.toLowerCase() || "";

        // Search matches
        const matchesSearch =
            destinationName.includes(searchValue) ||
            destinationCategory.includes(searchValue) ||
            destinationDescription.includes(searchValue);

        // Category matches
        const category = destinationCategory;

        let matchesCategory = false;

        if (selectedCategory === "all") {
            matchesCategory = true;
        }

        else if (selectedCategory === "food") {
            matchesCategory =
                category.includes("food") ||
                category.includes("restaurant") ||
                category.includes("dessert");
        }

        else if (selectedCategory === "cafe") {
            matchesCategory = category.includes("cafe");
        }

        else if (selectedCategory === "shopping") {
            matchesCategory =
                category.includes("shopping") ||
                category.includes("luxury");
        }

        else if (selectedCategory === "nature") {
            matchesCategory =
                category.includes("nature") ||
                category.includes("garden");
        }

        else if (selectedCategory === "heritage") {
            matchesCategory =
                category.includes("heritage") ||
                category.includes("landmark") ||
                category.includes("art");
        }

        // Show card only if BOTH conditions match
        if (matchesSearch && matchesCategory) {
            card.style.display = "";
        } else {
            card.style.display = "none";
        }
    });
}

// Search bar
if (destinationSearch) {
    destinationSearch.addEventListener("input", filterDestinations);
}

// Category buttons
filterButtons.forEach(function(button) {
    button.addEventListener("click", function() {

        // Remove active class from all buttons
        filterButtons.forEach(function(btn) {
            btn.classList.remove("active");
        });

        // Add active class to clicked button
        button.classList.add("active");

        // Update selected category
        selectedCategory = button.dataset.category;

        // Filter destinations
        filterDestinations();
    });
});