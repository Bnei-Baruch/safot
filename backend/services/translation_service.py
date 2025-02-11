import os
import tiktoken
from openai import OpenAI
from datetime import datetime
from models import Segment
from peewee import IntegrityError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class TranslationService:
    def __init__(self, model="gpt-4o", source_language="Hebrew", target_language="English"):

        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = model
        self.source_language = source_language
        self.target_language = target_language
        self.encoding = tiktoken.encoding_for_model(self.model)
        self.prompt = (
            "You are a professional translator. "
            "Translate the following text from %(source_language)s into %(target_language)s. "
            "Preserve the meaning and context exactly. "
            "Do not provide any explanations or additional information. "
            "Only return the translated text."
        )

    def get_model_token_limit(self):
        model_token_limits = {
            "gpt-4o": {"context_window": 128000, "max_output_tokens": 16384},
            "gpt-4": {"context_window": 8192, "max_output_tokens": 2048},
            "gpt-3.5-turbo": {"context_window": 4096, "max_output_tokens": 1024},
        }
        return model_token_limits.get(self.model, {"context_window": 0, "max_output_tokens": 0})

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

    def send_chunk_for_translation(self, chunk, temperature=0.2):
        model_limits = self.get_model_token_limit()
        max_output_tokens = model_limits["max_output_tokens"]
        prompt = self.prompt % {
            "source_language": self.source_language,
            "target_language": self.target_language
        }
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"{chunk}"}
        ]
        print("📨 🚀 Sending Request to OpenAI:", messages)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_output_tokens,
                temperature=temperature
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error during translation: {e}")
            return f"Translation failed for chunk: {chunk}"

    def process_translation(self, segments, source_id, username):
        max_chunk_tokens = self.calculate_chunk_token_limit()
        prepared_chunks = self.prepare_chunks_for_translation(
            segments, max_chunk_tokens)
        translated_paragraphs = []
        for i, chunk in enumerate(prepared_chunks, 1):
            print(f"Translating chunk {i}...")
            translated_text = self.send_chunk_for_translation(chunk)
            if translated_text:
                translated_paragraphs.extend(translated_text.split(" ||| "))
            else:
                print(f"Chunk {i} translation failed.")
        for seg, translated_text in zip(segments, translated_paragraphs):
            try:
                Segment.create(
                    timestamp=datetime.utcnow(),
                    username=username,
                    text=translated_text,
                    source_id=source_id,
                    order=seg["order"],
                    original_segment_id=seg["id"],
                    original_segment_timestamp=seg["timestamp"],
                    properties={"translation_type": "provider"}
                )
            except IntegrityError:
                print(f"Skipping duplicate segment for order {seg['order']}")
        print("Translation completed.")
