import os
import tiktoken
from openai import OpenAI
from datetime import datetime
from models import Segment, Language, Provider, TranslationServiceOptions
from peewee import IntegrityError
from dotenv import load_dotenv
from services.segment_service import save_segment
from services.translation_prompts import TRANSLATION_PROMPTS
from pprint import pprint
import inspect

# Load environment variables
load_dotenv()

def debug_print(message):
    frame = inspect.currentframe().f_back
    lineno = frame.f_lineno
    filename = os.path.basename(frame.f_globals["__file__"])
    print(f"[{filename}:{lineno}] {message}")

class TranslationService:
    def __init__(self, api_key: str, options: TranslationServiceOptions):
        self.client = OpenAI(api_key=api_key)
        self.options = options
        self.encoding = tiktoken.encoding_for_model(self.options.model)
        self.prompt = TRANSLATION_PROMPTS[self.options.prompt_key]

    def get_model_token_limit(self):
        model_token_limits = {
            "gpt-4o": {"context_window": 128000, "max_output_tokens": 16384},
            "gpt-4": {"context_window": 8192, "max_output_tokens": 2048},
            "gpt-3.5-turbo": {"context_window": 4096, "max_output_tokens": 1024},
        }
        return model_token_limits.get(self.options.model, {"context_window": 0, "max_output_tokens": 0})

    def calculate_chunk_token_limit(self, output_ratio=1.2):
        prompt_tokens = len(self.encoding.encode(self.prompt))
        model_limits = self.get_model_token_limit()
        context_window = model_limits["context_window"]
        max_output_tokens = model_limits["max_output_tokens"]
        chunk_tokens_by_output = int(max_output_tokens / output_ratio)
        chunk_tokens_by_context = context_window - prompt_tokens - max_output_tokens
        return max(min(chunk_tokens_by_output, chunk_tokens_by_context), 0)

    def prepare_chunks_for_translation(self, segments, max_chunk_tokens):
        chunks = []
        current_chunk = []
        current_tokens = 0
        for segment in segments:
            paragraph = segment["text"]
            if not paragraph.strip() or paragraph.strip() == "|||":
                continue
            paragraph_tokens = len(self.encoding.encode(paragraph))
            separator_tokens = len(self.encoding.encode(
                " ||| ")) if current_chunk else 0
            if current_tokens + paragraph_tokens + separator_tokens > max_chunk_tokens:
                chunks.append(" ||| ".join(current_chunk))
                current_chunk = [paragraph]
                current_tokens = paragraph_tokens
            else:
                current_chunk.append(paragraph)
                current_tokens += paragraph_tokens + separator_tokens
        if current_chunk:
            chunks.append(" ||| ".join(current_chunk))
        return chunks

    def send_chunk_for_translation(self, chunk):
        model_limits = self.get_model_token_limit()
        max_output_tokens = model_limits["max_output_tokens"]
        prompt = self.prompt.format(
            source_language=self.options.source_language.value,
            target_language=self.options.target_language.value
        )
        # print(f"📌 Final prompt used: {prompt}")
        debug_print(f"📌 Final prompt used:\n{prompt}")

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"{chunk}"}
        ]
        # print("📨 🚀 Sending Request to OpenAI:", messages)
         debug_print(f"📨 Sending request to OpenAI:\n{messages}")
        try:
            response = self.client.chat.completions.create(
                model=self.options.model,
                messages=messages,
                max_tokens=max_output_tokens,
                temperature=self.options.temperature
            )
            if not response or not response.choices or not response.choices[0].message.content:
                # print("⚠️ OpenAI returned an empty response!")
                debug_print("⚠️ OpenAI returned an empty response!")
                return "Translation failed due to an empty response."

            return response.choices[0].message.content.strip()

        except Exception as e:
            # print(f"Error during translation: {e}")
            debug_print(f"⚠️ Error during OpenAI call: {e}")
            return f"Translation failed for chunk: {chunk}"

    def process_translation(self, segments, source_id, username):
        max_chunk_tokens = self.calculate_chunk_token_limit()
        prepared_chunks = self.prepare_chunks_for_translation(
            segments, max_chunk_tokens)
        translated_paragraphs = []

        now = datetime.utcnow()

        for i, chunk in enumerate(prepared_chunks, 1):
            debug_print(f"Translating chunk {i}...")
            translated_text = self.send_chunk_for_translation(chunk)
            if translated_text:
                translated_paragraphs.extend(translated_text.split(" ||| "))
            else:
                debug_print(f"Chunk {i} translation failed.")

        for seg, translated_text in zip(segments, translated_paragraphs):
            try:
                save_segment(
                    username=username,
                    text=translated_text,
                    source_id=source_id,
                    order=seg["order"],
                    properties={
                        "segment_type": "provider",
                        "translation": {
                            "provider": self.options.provider.value,
                            "model": self.options.model,
                            "source_language": self.options.source_language.value,
                            "target_language": self.options.target_language.value,
                            "prompt_key": self.options.prompt_key,
                            "prompt": self.prompt,
                            "temperature": self.options.temperature
                        }
                    },
                    original_segment_id=seg["id"],
                    original_segment_timestamp=seg["timestamp"],
                    custom_timestamp=now
                )
            except IntegrityError:
                debug_print(f"Skipping duplicate segment for order {seg['order']}")

        debug_print("✅ Translation completed.")
