
from flask import Flask, jsonify, request
from flask_cors import CORS

from ai.gemini_service import generate_response

app = Flask(__name__)

# Allow frontend communication
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:8000",
            "http://127.0.0.1:8000"
        ]
    }
})


# Check backend status
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "success",
        "message": "SANCHARA backend is running!"
    })


# Receive user messages and generate AI responses
@app.route("/api/chat", methods=["POST"])
def chat():

    try:
        data = request.get_json()

        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({
                "error": "Message cannot be empty"
            }), 400

        # Get response from Gemini
        bot_response = generate_response(user_message)

        return jsonify({
            "reply": bot_response
        })

    except Exception as e:
        print("Chat error:", str(e))

        return jsonify({
            "error": "Sorry, something went wrong. Please try again."
        }), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
