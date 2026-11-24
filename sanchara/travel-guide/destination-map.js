console.log("SANCHARA MAP LOADED");


// =====================================
// INITIALIZE MAP
// =====================================

const bengaluruCoordinates = [12.9716, 77.5946];

const sancharaMap = L.map("sanchara-map").setView(
    bengaluruCoordinates,
    12
);


// =====================================
// OPEN STREET MAP
// =====================================

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {

    attribution:
        '&copy; OpenStreetMap contributors',

    maxZoom: 19

}).addTo(sancharaMap);


// =====================================
// DESTINATIONS
// =====================================

const mapDestinations = [

    {
        name: "Bangalore Palace",
        category: "heritage",
        coordinates: [12.9987, 77.5920],
        description: "Historic royal palace in Bengaluru."
    },

    {
        name: "Cubbon Park",
        category: "nature",
        coordinates: [12.9763, 77.5929],
        description: "Beautiful green park in central Bengaluru."
    },

    {
        name: "ISKCON Temple",
        category: "heritage",
        coordinates: [13.0108, 77.5511],
        description: "Popular spiritual destination."
    },

    {
        name: "MG Road",
        category: "shopping",
        coordinates: [12.9756, 77.6067],
        description: "Popular shopping and entertainment area."
    },

    {
        name: "National Gallery of Modern Art",
        category: "heritage",
        coordinates: [12.9847, 77.5897],
        description: "Museum featuring modern and contemporary art."
    },

    {
        name: "Central Tiffin Room",
        category: "food",
        coordinates: [13.0038, 77.5701],
        description: "Popular restaurant in Malleswaram."
    },

    {
        name: "Vidyarthi Bhavan",
        category: "food",
        coordinates: [12.9432, 77.5681],
        description: "Popular South Indian restaurant."
    },

    {
        name: "MTR",
        category: "food",
        coordinates: [12.9568, 77.5997],
        description: "Traditional South Indian restaurant."
    },

    {
        name: "Rameshwaram Cafe",
        category: "food",
        coordinates: [12.9430, 77.6220],
        description: "Popular South Indian cafe."
    },

    {
        name: "Meghana Foods",
        category: "food",
        coordinates: [12.9344, 77.6113],
        description: "Popular restaurant known for biryani."
    },

    {
        name: "Nagarjuna",
        category: "food",
        coordinates: [12.9654, 77.6010],
        description: "Andhra cuisine restaurant."
    },

    {
        name: "Truffles",
        category: "food",
        coordinates: [12.9352, 77.6145],
        description: "Popular cafe and restaurant."
    },

    {
        name: "Corner House",
        category: "food",
        coordinates: [12.9698, 77.6030],
        description: "Popular dessert destination."
    },

    {
        name: "DYU Art Cafe",
        category: "cafe",
        coordinates: [12.9349, 77.6140],
        description: "Art-inspired cafe."
    },

    {
        name: "Third Wave Coffee",
        category: "cafe",
        coordinates: [12.9710, 77.6010],
        description: "Coffee shop."
    },

    {
        name: "Matteo Coffee",
        category: "cafe",
        coordinates: [12.9756, 77.6061],
        description: "Coffee shop on MG Road."
    },

    {
        name: "Commercial Street",
        category: "shopping",
        coordinates: [12.9825, 77.6080],
        description: "Popular shopping street."
    },

    {
        name: "Brigade Road",
        category: "shopping",
        coordinates: [12.9716, 77.6065],
        description: "Shopping and entertainment street."
    },

    {
        name: "UB City",
        category: "shopping",
        coordinates: [12.9719, 77.5967],
        description: "Luxury shopping and dining destination."
    },

    {
        name: "Orion Mall",
        category: "shopping",
        coordinates: [13.0118, 77.5550],
        description: "Shopping and entertainment mall."
    },

    {
        name: "Phoenix Marketcity",
        category: "shopping",
        coordinates: [12.9970, 77.6960],
        description: "Shopping and entertainment mall."
    },

    {
        name: "Lalbagh Botanical Garden",
        category: "nature",
        coordinates: [12.9507, 77.5848],
        description: "Botanical garden and green space."
    },

    {
        name: "Ulsoor Lake",
        category: "nature",
        coordinates: [12.9817, 77.6190],
        description: "Lake in Bengaluru."
    },

    {
        name: "Sankey Tank",
        category: "nature",
        coordinates: [13.0081, 77.5712],
        description: "Lake and walking area."
    },

    {
        name: "Vidhana Soudha",
        category: "heritage",
        coordinates: [12.9796, 77.5906],
        description: "Iconic government building."
    },

    {
        name: "Tipu Sultan's Summer Palace",
        category: "heritage",
        coordinates: [12.9591, 77.5738],
        description: "Historic summer palace."
    }

];


// =====================================
// ADD MARKERS TO MAP
// =====================================

const destinationMarkers = [];

mapDestinations.forEach(function(destination) {

    const marker = L.marker(destination.coordinates);
    marker.destinationName = destination.name;

    marker.bindPopup(`
        <h3>${destination.name}</h3>

        <p>${destination.description}</p>

        <a
            href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination.name + ", Bengaluru")}"
            target="_blank"
        >
            Get Directions
        </a>
    `);

    marker.destinationCategory = destination.category;

    marker.addTo(sancharaMap);

    destinationMarkers.push(marker);

});


// =====================================
// CATEGORY FILTERS
// =====================================

const mapFilterButtons = document.querySelectorAll(".map-filter");

mapFilterButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        const selectedCategory = button.dataset.mapCategory;


        // Change active button

        mapFilterButtons.forEach(function(btn) {

            btn.classList.remove("active");

        });

        button.classList.add("active");


        // Filter map markers

        destinationMarkers.forEach(function(marker) {

            if (
                selectedCategory === "all" ||
                marker.destinationCategory === selectedCategory
            ) {

                marker.addTo(sancharaMap);

            } else {

                sancharaMap.removeLayer(marker);

            }

        });

    });

});
// =====================================
// CONNECT DESTINATION CARDS TO MAP
// =====================================

document.querySelectorAll(".view-on-map").forEach(function(button) {

    button.addEventListener("click", function() {

        // Get the destination card
        const card = button.closest(".destination-card");

        if (!card) return;

        // Get destination name from card
        const destinationName =
            card.querySelector("h3")?.textContent.trim();

        // Find matching map marker
        const matchingMarker = destinationMarkers.find(function(marker) {

            return marker.destinationName === destinationName;

        });

        // If marker is found
        if (matchingMarker) {

            // Scroll to map
            document.getElementById("sanchara-map").scrollIntoView({

                behavior: "smooth",

                block: "center"

            });

            // Zoom into destination
            sancharaMap.setView(

                matchingMarker.getLatLng(),

                16,

                {
                    animate: true
                }

            );

            // Open destination popup
            setTimeout(function() {

                matchingMarker.openPopup();

            }, 700);

        } else {

            alert("This destination is not available on the map yet!");

        }

    });

});
// =====================================
// MY TRIP ROUTE FUNCTIONALITY
// =====================================

let tripRoutingControl = null;


// Get destinations selected by the user
function getTripCoordinates() {

    const savedTrip = JSON.parse(
        localStorage.getItem("sanchara_my_trip")
    ) || [];

    const tripCoordinates = [];


    savedTrip.forEach(function(tripDestination) {

        // Find matching destination in mapDestinations
        const matchingDestination = mapDestinations.find(function(destination) {

            return destination.name.toLowerCase() ===
                tripDestination.name.toLowerCase();

        });


        if (matchingDestination) {

            tripCoordinates.push({

                name: matchingDestination.name,

                coordinates: matchingDestination.coordinates

            });

        }

    });


    return tripCoordinates;

}


// =====================================
// SHOW ROUTE
// =====================================

const showTripRouteButton = document.getElementById("show-trip-route");

if (showTripRouteButton) {

    showTripRouteButton.addEventListener("click", function() {

        const tripCoordinates = getTripCoordinates();


        // Check whether trip has destinations
        if (tripCoordinates.length < 2) {

            alert("Please add at least 2 destinations to your trip to create a route!");

            return;

        }


        // Remove previous route
        if (tripRoutingControl) {

            sancharaMap.removeControl(tripRoutingControl);

            tripRoutingControl = null;

        }


        // Get selected travel mode
        const selectedMode = document.getElementById("route-mode").value;
        


        // Create route waypoints
        const routeWaypoints = tripCoordinates.map(function(destination) {

            return L.latLng(

                destination.coordinates[0],

                destination.coordinates[1]

            );

        });


        // Create route
        tripRoutingControl = L.Routing.control({

            waypoints: routeWaypoints,

            routeWhileDragging: false,

            show: true,

            addWaypoints: false,

            draggableWaypoints: false,

            fitSelectedRoutes: true,

                lineOptions: {

    styles: [

        {
            color: "#0f766e",
            opacity: 1,
            weight: 10
        },

        {
            color: "#ffffff",
            opacity: 0.9,
            weight: 14
        }

    ]

},
            
            createMarker: function(index, waypoint, numberOfWaypoints) {

                return L.marker(waypoint.latLng, {

                    draggable: false

                }).bindPopup(

                    `<strong>Stop ${index + 1}</strong><br>
                    ${tripCoordinates[index].name}`

                );

            },

           router: L.Routing.osrmv1({

    serviceUrl: selectedMode === "walking"
        ? "https://routing.openstreetmap.de/routed-foot/route/v1"
        : "https://router.project-osrm.org/route/v1"

})

        }).addTo(sancharaMap);


        // Scroll to map
        document.getElementById("sanchara-map").scrollIntoView({

            behavior: "smooth",

            block: "center"

        });


        // Display route information
        tripRoutingControl.on("routesfound", function(event) {

            const routes = event.routes;

            const route = routes[0];

            const distance = route.summary.totalDistance;

            const duration = route.summary.totalTime;


            // Convert distance to kilometres
            const distanceInKm = (distance / 1000).toFixed(2);


            // Convert time to minutes
            const durationInMinutes = Math.round(duration / 60);


            console.log("Route Distance:", distanceInKm, "km");

            console.log("Estimated Time:", durationInMinutes, "minutes");


            alert(

                "Your trip route is ready! 🗺️\n\n" +

                "Destinations: " + tripCoordinates.length + "\n" +

                "Distance: " + distanceInKm + " km\n" +

                "Estimated travel time: " + durationInMinutes + " minutes"

            );

        });


    });

}