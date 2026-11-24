
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(override=True)

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("Gemini API key not found!")

client = genai.Client(api_key=API_KEY)

MODEL_NAME = "gemini-3.5-flash-lite"

SYSTEM_INSTRUCTION = """
You are SANCHARA, an intelligent and friendly AI travel
assistant designed to help people explore Bengaluru.

YOUR ROLE:
1. Answer the user's actual question directly.
2. Recommend specific places in Bengaluru.
3. Help users discover historical places, nature spots,
   restaurants, shopping areas and cultural attractions.
4. Ask relevant follow-up questions when necessary.
5. Help users create personalised travel itineraries.

CONVERSATION RULES:
- Remember the previous messages in the conversation.
- Understand follow-up questions using earlier context.
- Remember the user's travel preferences and requirements.
- Understand references such as "that place", "Day 2",
  "the second option" and "make it less hectic".
- Do not ask users to repeat information they already provided.
- If the user changes a preference, follow the latest preference.
- Never give the same generic welcome message repeatedly.
- Never ignore the user's actual question.
- If someone asks for three recommendations, give exactly three.
- Explain briefly why each place is worth visiting.
- Do not invent opening hours, ticket prices or travel details.
- If you don't know something, be honest.

You are a conversational travel assistant, not a greeting bot.
"""

def generate_response(user_message, conversation_history=None):

    conversation_history = conversation_history or []

    # Convert previous messages into Gemini conversation format
    contents = []

    for message in conversation_history:

        contents.append(
            types.Content(
                role=message["role"],
                parts=[
                    types.Part.from_text(
                        text=message["content"]
                    )
                ]
            )
        )

    # Add the current user message
    contents.append(user_message)

    max_retries = 3
    retry_delay = 2

    for attempt in range(max_retries + 1):

        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.7,
                    max_output_tokens=1500
                )
            )

            if response.candidates:
                print(
                    "Gemini finish reason:",
                    response.candidates[0].finish_reason
                )

            bot_response = response.text or ""

            print(
                "Gemini response length:",
                len(bot_response)
            )

            return bot_response

        except genai.errors.APIError as e:

            print("Gemini API Error:", e.code, str(e))

            if e.code not in [408, 429, 500, 502, 503, 504]:
                raise

            if attempt < max_retries:

                print(
                    f"Retrying in {retry_delay} seconds..."
                )

                time.sleep(retry_delay)
                retry_delay *= 2

            else:

                print(
                    "Gemini is still unavailable after all retries."
                )

                return (
                    "I'm experiencing a little difficulty connecting "
                    "to my travel assistance service right now. "
                    "Please try sending your message again in a moment!"
                )
