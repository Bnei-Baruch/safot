import os
from dotenv import load_dotenv
import tiktoken
from openai import OpenAI

# Load environment variables from .env file
load_dotenv()

# Set the OpenAI API 
client = OpenAI(
   api_key=os.environ['OPENAI_API_KEY'],
    )

model = "gpt-4"
prompt = "Translate the following text into [target language], maintaining the original meaning and structure. The translation should reflect the precise concepts and teachings of Kabbalist Michael Laitman, adhering closely to the authentic style and terminology of Kabbalah. Avoid rephrasing or altering the intent of the original text while ensuring linguistic accuracy and fluency. Preserve the `|||` separator exactly as it appears in the text."
target_language="English"

# Load the tokenizer
encoding = tiktoken.encoding_for_model(model)

# Calculate the number of tokens in the prompt
prompt_tokens = len(encoding.encode(prompt))
print(f"Prompt tokens: {prompt_tokens}")


def get_model_token_limit(model):
    model_token_limits = {
        "gpt-4o": {"context_window": 128000, "max_output_tokens": 16384},
        "gpt-4o-2024-11-20": {"context_window": 128000, "max_output_tokens": 16384},
        "gpt-4": {"context_window": 8192, "max_output_tokens": 2048},
        "gpt-4-32k": {"context_window": 32768, "max_output_tokens": 8192},
        "gpt-3.5-turbo": {"context_window": 4096, "max_output_tokens": 1024},
        "text-davinci-003": {"context_window": 4096, "max_output_tokens": 1024},
    }
    return model_token_limits.get(model, {"context_window": 0, "max_output_tokens": 0})

def calculate_max_input(prompt_tokens, model, output_ratio=1.2):

    # Get model token limits
    model_limits = get_model_token_limit(model)
    context_window = model_limits["context_window"]
    max_output_tokens = model_limits["max_output_tokens"]

    # Calculate the maximum input tokens based on max output tokens
    input_by_output_limit = int(max_output_tokens / output_ratio)

    # Calculate the maximum input tokens based on context window
    input_by_context_limit = context_window - prompt_tokens - max_output_tokens

    # Return the smaller of the two
    return max(min(input_by_output_limit, input_by_context_limit), 0)

def prepare_batches_for_translation(paragraphs, max_input_tokens, encoding):
  
    batches = []  
    current_batch = []  # To store the current batch of paragraphs
    current_tokens = 0  # To track the token count in the current batch

    # Iterate over paragraphs
    for paragraph in paragraphs:
        # Calculate the tokens for the paragraph
        paragraph_tokens = len(encoding.encode(paragraph))
        separator_tokens = len(encoding.encode(" ||| ")) if current_batch else 0

        # Check if adding this paragraph would exceed the token limit
        if current_tokens + paragraph_tokens + separator_tokens > max_input_tokens:
            # Add the current batch to the list
            batches.append(" ||| ".join(current_batch))
            # Start a new batch
            current_batch = [paragraph]
            current_tokens = paragraph_tokens
        else:
            # Add paragraph to the current batch
            current_batch.append(paragraph)
            current_tokens += paragraph_tokens + separator_tokens

    # Add the last batch if not empty
    if current_batch:
        batches.append(" ||| ".join(current_batch))

    return batches

def send_batch_for_translation(batch, prompt, max_output_tokens, model="gpt-4", temperature=0.2,target_language="Spanish"):
    # Update the prompt with the target language
    prompt = prompt.replace("[target language]", target_language)
    # Construct the messages structure
    messages = [
    {"role": "system", "content": "You are a translator. Keep the `|||` separator unchanged to mark paragraph separation."},
    {"role": "user", "content": f"{batch}"}
]

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_output_tokens,
            temperature=temperature
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"Error during translation: {e}")
        return None

def translate_text(paragraphs, prompt, target_language,model="gpt-4", output_ratio=1.2):

    # Step 1: Get model token limits
    model_limits = get_model_token_limit(model)
    context_window = model_limits["context_window"]
    max_output_tokens = model_limits["max_output_tokens"]

    # Step 2: Calculate max input tokens
    max_input_tokens = calculate_max_input(prompt_tokens, model, output_ratio)

    # Step 3: Prepare batches for translation
    encoding = tiktoken.encoding_for_model(model)
    batches = prepare_batches_for_translation(paragraphs, max_input_tokens, encoding)

    # Step 4: Translate each batch and split into paragraphs
    translated_paragraphs = []
    for i, batch in enumerate(batches, 1):
        print(f"Translating Batch {i}...")

        # Send batch for translation
        translated_text = send_batch_for_translation(batch, prompt, max_output_tokens, model,  temperature=0.2, target_language=target_language)

        if translated_text:
            # Split the translated text back into paragraphs
            translated_paragraphs.extend(translated_text.split(" ||| "))
        else:
            print(f"Batch {i} translation failed.")

    return translated_paragraphs


if __name__ == "__main__":
    # Example paragraphs
    paragraphs = [
       "כל המקרים הרעים באים לטובתי כדי שאתעלה על ידם. הם לא מכשול, אלא קרש קפיצה.",
       "מה כדאי ללמוד מהעבר? איך לעשות פחות טעויות ולכוון את עצמי מרגע זה והלאה למטרה הנעלה ביותר שאוכל להשיג.",
        "כשנהפוך את עצמנו לטובים, נרגיש שזה הסוף של כל הרע.",
        "עלינו להיות כצינור, כמעבר של כוח האהבה והנתינה לכל המציאות."
    ]

    # Translate the paragraphs
    translated_paragraphs = translate_text(paragraphs, prompt, target_language, model)

    # Display the translated paragraphs
    print("\nTranslated Paragraphs:")
    for i, paragraph in enumerate(translated_paragraphs, 1):
        print(f"Paragraph {i}: {paragraph}")

