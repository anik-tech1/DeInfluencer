import google.generativeai as genai
import os

# Set your API key (replace with your actual key or use environment variable)
os.environ["GOOGLE_API_KEY"] = "AIzaSyDaJBD3HtYGOxpzG2ryWfc-QIUHKUyfHfg"

# Configure the API
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

try:
    # List all available models
    models = genai.list_models()

    print("Available Generative AI Models:")
    for model in models:
        print(f"- {model.name} | Supported input: {model.supported_generation_methods}")
except Exception as e:
    print(f"Error listing models: {e}")
