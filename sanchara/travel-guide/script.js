// Chat form: no backend yet, so just prevent the page from reloading.
document.getElementById("chat-form").addEventListener("submit", function (event) {
  event.preventDefault();
  // FUTURE: send the message to your AI chat here.
});

// Add to Trip buttons: simple visual toggle for now.
document.querySelectorAll(".add-to-trip").forEach(function (button) {
  button.addEventListener("click", function () {
    const added = button.classList.toggle("is-added");
    button.textContent = added ? "Added ✓" : "Add to Trip";
    // FUTURE: add/remove the destination from the trip list here.
  });
});