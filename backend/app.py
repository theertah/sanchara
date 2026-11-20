
import time
import uuid

from flask import Flask, jsonify, request
from flask_cors import CORS

from ai.gemini_service import generate_response

app = Flask(__name__)

# Allow frontend communication
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5500",
            "http://127.0.0.1:5500"
        ]
    }
})

# Temporary in-memory conversation storage
conversation_sessions = {}

# Store destinations added to each trip
trip_destinations = {}

# Maximum number of previous messages to retain
MAX_HISTORY_MESSAGES = 12


# Check backend status
@app.route("/api/health", methods=["GET"])
def health_check():

    return jsonify({
        "status": "success",
        "message": "SANCHARA backend is running!"
    })


# Receive messages and maintain conversation memory
@app.route("/api/chat", methods=["POST"])
def chat():

    try:

        data = request.get_json(silent=True) or {}

        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({
                "error": "Message cannot be empty"
            }), 400

        conversation_id = data.get("conversation_id")

        if not isinstance(conversation_id, str) or not conversation_id:
            conversation_id = str(uuid.uuid4())

        history = conversation_sessions.get(
            conversation_id, []
        )

        print(f"Conversation ID: {conversation_id}")
        print(f"Previous messages: {len(history)}")

        start = time.time()

        bot_response = generate_response(
            user_message,
            history
        )

        print(f"Gemini took {time.time() - start:.2f}s")

        if (
            bot_response
            and not bot_response.startswith(
                "I'm experiencing a little difficulty"
            )
        ):

            history.append({
                "role": "user",
                "content": user_message
            })

            history.append({
                "role": "model",
                "content": bot_response
            })

            history = history[-MAX_HISTORY_MESSAGES:]

            conversation_sessions[conversation_id] = history

        return jsonify({
            "reply": bot_response,
            "conversation_id": conversation_id
        })

    except Exception as e:

        print("Chat error:", str(e))

        return jsonify({
            "error": "Sorry, something went wrong. Please try again."
        }), 500


# Add a destination and update the AI itinerary
@app.route("/api/add-to-trip", methods=["POST"])
def add_to_trip():

    try:

        data = request.get_json(silent=True) or {}

        destination = data.get("destination", "").strip()
        description = data.get("description", "").strip()
        conversation_id = data.get("conversation_id")

        if not destination:
            return jsonify({
                "error": "Destination name is required."
            }), 400

        if not isinstance(conversation_id, str) or not conversation_id:
            return jsonify({
                "error": "A valid conversation ID is required."
            }), 400

        # Retrieve existing conversation and trip
        history = conversation_sessions.get(
            conversation_id, []
        )

        selected_destinations = trip_destinations.get(
            conversation_id, []
        )

        # Prevent duplicate additions
        already_added = any(
            item.casefold() == destination.casefold()
            for item in selected_destinations
        )

        if already_added:

            return jsonify({
                "status": "success",
                "duplicate": True,
                "destination": destination,
                "destinations": selected_destinations,
                "reply": f"{destination} is already in your trip!"
            })

        # Prepare the complete selected destination list
        updated_destinations = selected_destinations + [
            destination
        ]

        destination_details = "\n".join(
            f"- {item}" for item in updated_destinations
        )

        new_destination_description = (
            f"\nDescription: {description}"
            if description else ""
        )

        # Give Gemini an itinerary update instruction
        trip_instruction = f"""
The user has clicked the Add to Trip button.

This is an automatic trip-planning action. Do not ask for
confirmation.

New destination selected:
{destination}{new_destination_description}

All destinations selected for this trip so far:
{destination_details}

Your task:

1. Check the previous conversation to understand whether
   an itinerary already exists.
2. If an itinerary exists, update it by incorporating the
   newly selected destination. Preserve the user's previous
   preferences and existing destinations.
3. If no itinerary exists, create a new personalised
   itinerary covering all the selected destinations.
4. Arrange destinations in a sensible visiting order.
5. Avoid repeating places already included in the itinerary.
6. Provide a complete updated itinerary, not just an
   acknowledgement.
7. Do not ask the user for confirmation.
8. Do not invent exact opening hours, ticket prices or
   travel times.
9. If necessary, make reasonable assumptions and mention
   them briefly.

Respond naturally as SANCHARA.
"""

        start = time.time()

        bot_response = generate_response(
            trip_instruction,
            history
        )

        print(
            f"Trip update took {time.time() - start:.2f}s"
        )

        if (
            not bot_response
            or bot_response.startswith(
                "I'm experiencing a little difficulty"
            )
        ):

            return jsonify({
                "error": "SANCHARA could not update your itinerary. Please try again."
            }), 503

        # Save the successful trip update in conversation history
        history.append({
            "role": "user",
            "content": trip_instruction
        })

        history.append({
            "role": "model",
            "content": bot_response
        })

        history = history[-MAX_HISTORY_MESSAGES:]

        conversation_sessions[conversation_id] = history

        # Save selected destinations
        trip_destinations[conversation_id] = updated_destinations

        return jsonify({
            "status": "success",
            "duplicate": False,
            "destination": destination,
            "destinations": updated_destinations,
            "reply": bot_response,
            "conversation_id": conversation_id
        })

    except Exception as e:

        print("Add to trip error:", str(e))

        return jsonify({
            "error": "Something went wrong while updating your trip."
        }), 500


# Start a new conversation
@app.route("/api/new-conversation", methods=["POST"])
def new_conversation():

    conversation_id = str(uuid.uuid4())

    conversation_sessions[conversation_id] = []
    trip_destinations[conversation_id] = []

    return jsonify({
        "status": "success",
        "conversation_id": conversation_id,
        "message": "New conversation started!"
    })


# Clear an existing conversation
@app.route("/api/clear-conversation", methods=["POST"])
def clear_conversation():

    data = request.get_json(silent=True) or {}

    conversation_id = data.get("conversation_id")

    if conversation_id:
        conversation_sessions.pop(conversation_id, None)
        trip_destinations.pop(conversation_id, None)

    return jsonify({
        "status": "success",
        "message": "Conversation memory cleared!"
    })


if __name__ == "__main__":

    app.run(
        debug=True,
        port=5000
    )
