
import os
from urllib import response
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("Gemini API key not found!")

client = genai.Client(api_key=API_KEY)

MODEL_NAME = "gemini-3.8-flash"

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

IMPORTANT RULES:
- Never give the same generic welcome message repeatedly.
- Never ignore the user's actual question.
- If someone asks for three recommendations, give exactly
  three recommendations.
- Explain briefly why each place is worth visiting.
- Be conversational, friendly and informative.
- Assume the user may be visiting Bengaluru for the first time.
- Do not invent opening hours, ticket prices or travel details.
- If you don't know something, be honest.

You are a conversational travel assistant, not a greeting bot.
"""


def generate_response(user_message):

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.7,
            max_output_tokens=2500
        )
    )
    print("Gemini finish reason:", response.candidates[0].finish_reason)
    print("Gemini response length:", len(response.text or ""))
    return response.text
