import os
from dotenv import load_dotenv
import tiktoken
from openai import OpenAI

load_dotenv()

client = OpenAI(
   api_key=os.environ['OPENAI_API_KEY'],
    )

model = "gpt-4"
prompt = "Translate the following text into [target language], maintaining the original meaning and structure. The translation should reflect the precise concepts and teachings of Kabbalist Michael Laitman, adhering closely to the authentic style and terminology of Kabbalah. Avoid rephrasing or altering the intent of the original text while ensuring linguistic accuracy and fluency. Preserve the `|||` separator exactly as it appears in the text."
target_language="English"

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

def calculate_segment_token_limit(prompt_tokens, model, output_ratio=1.2):

    model_limits = get_model_token_limit(model)
    context_window = model_limits["context_window"]
    max_output_tokens = model_limits["max_output_tokens"]

    # Calculate the maximum segment tokens based on max output tokens
    segment_tokens_by_output = int(max_output_tokens / output_ratio)

    # Calculate the maximum segment tokens based on context window
    segment_tokens_by_context = context_window - prompt_tokens - max_output_tokens

    # Return the smaller of the two
    return max(min(segment_tokens_by_output, segment_tokens_by_context), 0)

def prepare_segments_for_translation(paragraphs, max_segment_tokens, encoding):
  
    segments = []  
    current_segment = [] 
    current_tokens = 0 

    for paragraph in paragraphs:
        paragraph_tokens = len(encoding.encode(paragraph))
        separator_tokens = len(encoding.encode(" ||| ")) if current_segment else 0

        if current_tokens + paragraph_tokens + separator_tokens > max_segment_tokens:
            # Add the current segment to the list
            segments.append(" ||| ".join(current_segment))
            # Start a new segment
            current_segment = [paragraph]
            current_tokens = paragraph_tokens
        else:
            # Add paragraph to the current segment
            current_segment.append(paragraph)
            current_tokens += paragraph_tokens + separator_tokens

    # Add the last segment if not empty
    if current_segment:
        segments.append(" ||| ".join(current_segment))

    return segments

def send_segment_for_translation(segment, prompt, max_output_tokens, model="gpt-4", temperature=0.2,target_language="Spanish"):
    # Update target language
    prompt = prompt.replace("[target language]", target_language)
  
    messages = [
    {"role": "system", "content": "You are a translator. Keep the `|||` separator unchanged to mark paragraph separation."},
    {"role": "user", "content": f"{segment}"}
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

    model_limits = get_model_token_limit(model)
    context_window = model_limits["context_window"]
    max_output_tokens = model_limits["max_output_tokens"]

    # Calculate max segment tokens 
    max_segment_tokens = calculate_segment_token_limit(prompt_tokens, model, output_ratio)

    # Prepare segments for translation
    encoding = tiktoken.encoding_for_model(model)
    segments = prepare_segments_for_translation(paragraphs, max_segment_tokens, encoding)

    # Translate each segment and split into paragraphs
    translated_paragraphs = []
    for i, segment in enumerate(segments, 1):
        print(f"Translating segment {i}...")

        # Send segment for translation
        translated_text = send_segment_for_translation(segment, prompt, max_output_tokens, model,  temperature=0.2, target_language=target_language)

        if translated_text:
            # Split the translated text back into paragraphs
            translated_paragraphs.extend(translated_text.split(" ||| "))
        else:
            print(f"segment {i} translation failed.")

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

