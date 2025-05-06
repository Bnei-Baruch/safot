import os
import tiktoken
import logging
from openai import OpenAI
from openai import OpenAIError, Timeout
from datetime import datetime
from models import TranslationServiceOptions
from dotenv import load_dotenv
from services.translation_prompts import TRANSLATION_PROMPTS
import inspect

# Get logger for this module
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

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
        return max(min(chunk_tokens_by_output, chunk_tokens_by_context, 4000), 0)


    def prepare_chunks_for_translation(self, items, max_chunk_tokens):
        """
        Supports input as list of segments (dicts with "text") or plain text strings.
        """
        chunks = []
        current_chunk = []
        current_tokens = 0

        for item in items:
            paragraph = item["text"] if isinstance(item, dict) else item
            if not paragraph.strip() or paragraph.strip() == "|||":
                continue

            paragraph_tokens = len(self.encoding.encode(paragraph))
            separator_tokens = len(self.encoding.encode(" ||| ")) if current_chunk else 0

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
        max_output_tokens = min(model_limits["max_output_tokens"], 8000)  # cap at 8000 for safety
        prompt = self.prompt.format(
            source_language=self.options.source_language,
            target_language=self.options.target_language
        )
        logger.debug("Final prompt used: %s", prompt)

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"{chunk}"}
        ]
        logger.debug("Sending request to OpenAI: %s", messages)

        try:
            start_time = datetime.utcnow()
            response = self.client.chat.completions.create(
                model=self.options.model,
                messages=messages,
                max_tokens=max_output_tokens,
                temperature=self.options.temperature,
                timeout=120
            )
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            logger.debug("API call duration: %s seconds", duration)

            if not response or not response.choices or not response.choices[0].message.content:
                logger.warning("OpenAI returned an empty response")
                return "Translation failed due to an empty response."

            logger.debug("OpenAI response: %s", response.choices[0].message.content)
            return response.choices[0].message.content.strip()

        except Timeout:
            logger.error("Request to OpenAI timed out")
            return "Translation failed due to timeout."

        except OpenAIError as e:
            logger.error("OpenAI API error: %s", str(e))
            return f"Translation failed due to API error: {str(e)}"

        except Exception as e:
            logger.error("Unexpected error during OpenAI call: %s", str(e))
            return f"Translation failed due to unexpected error: {str(e)}"

    def translate_paragraphs(self, paragraphs: list[str]) -> tuple[list[str], dict]:
        max_chunk_tokens = self.calculate_chunk_token_limit()
        prepared_chunks = self.prepare_chunks_for_translation(paragraphs, max_chunk_tokens)

        translated_paragraphs = []
        for i, chunk in enumerate(prepared_chunks, 1):
            logger.debug("Translating chunk %d", i)
            translated_text = self.send_chunk_for_translation(chunk)
            if translated_text:
                translated_paragraphs.extend(translated_text.split(" ||| "))

        properties = {
            "segment_type": "provider",
            "translation": {
                "provider": self.options.provider.value,
                "model": self.options.model,
                "source_language": self.options.source_language,
                "target_language": self.options.target_language,
                "prompt_key": self.options.prompt_key,
                "prompt": self.prompt,
                "temperature": self.options.temperature
            }
        }

        logger.debug("Translated text after split: %s", translated_paragraphs)
        logger.info("Translation completed successfully. Translated %d paragraphs", len(translated_paragraphs))
        return translated_paragraphs, properties

