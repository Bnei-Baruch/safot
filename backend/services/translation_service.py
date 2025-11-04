import os
import tiktoken
import logging
from openai import OpenAI
from openai import OpenAIError, APITimeoutError
from datetime import datetime
from models import TranslationServiceOptions, TranslationExample
from dotenv import load_dotenv
from typing import List, Dict
import re


# Get logger for this module
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class TranslationService:
    def __init__(self, api_key: str, options: TranslationServiceOptions, prompt_text: str = ""):
        self.client = OpenAI(api_key=api_key)
        self.options = options
        self.encoding = tiktoken.encoding_for_model(self.options.model)
        self.prompt_text = prompt_text


    def get_model_token_limit(self):
        model_token_limits = {
            "gpt-4o": {"context_window": 128000, "max_output_tokens": 16384},
            "gpt-4": {"context_window": 8192, "max_output_tokens": 2048},
            "gpt-3.5-turbo": {"context_window": 4096, "max_output_tokens": 1024},
        }
        return model_token_limits.get(self.options.model, {"context_window": 0, "max_output_tokens": 0})

    def calculate_chunk_token_limit(self, output_ratio=1.2):
        prompt_tokens = len(self.encoding.encode(self.prompt_text))
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
    
    
    def send_chunk_for_translation(self, chunk: str, prompt: str) -> str:
        model_limits = self.get_model_token_limit()
        max_output_tokens = min(model_limits["max_output_tokens"], 8000)  # cap at 8000 for safety

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": chunk}
        ]

        logger.debug("Sending request to OpenAI: chunk %d chars", len(chunk))

        try:
            start_time = datetime.utcnow()
            response = self.client.chat.completions.create(
                model=self.options.model,
                messages=messages,
                max_tokens=max_output_tokens,
                temperature=self.options.temperature,
                timeout=600
            )
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            logger.debug("API call duration: %s seconds", duration)

            if not response or not response.choices or not response.choices[0].message.content:
                logger.warning("OpenAI returned an empty response")
                return "Translation failed due to an empty response."

            return response.choices[0].message.content

        except APITimeoutError:
            logger.error("Request to OpenAI timed out")
            return "Translation failed due to timeout."

        except OpenAIError as e:
            logger.error("OpenAI API error: %s", str(e))
            return f"Translation failed due to API error: {str(e)}"

        except Exception as e:
            logger.error("Unexpected error during OpenAI call: %s", str(e))
            return f"Translation failed due to unexpected error: {str(e)}"
    
    def translate_paragraphs(self, paragraphs: List[str]) -> tuple[List[str], dict]:
        max_chunk_tokens = self.calculate_chunk_token_limit()
        prepared_chunks = self.prepare_chunks_for_translation(paragraphs, max_chunk_tokens)

        translated_paragraphs = []
        for i, chunk in enumerate(prepared_chunks, 1):
            logger.debug("Translating chunk %d", i)

            prompt = self.prompt_text

            translated_text = self.send_chunk_for_translation(chunk=chunk, prompt=prompt)
            if translated_text:
                translated_paragraphs.extend(re.split(r'\s*\|\|\|\s*', translated_text.strip()))

        properties = {
            "provider": self.options.provider.value,
            "model": self.options.model,
            "temperature": self.options.temperature,
        }

        logger.info("Translation completed successfully. Translated %d paragraphs", len(translated_paragraphs))
        return translated_paragraphs, properties
    
    def translate_with_multi_source_alignment(
        self,
        origin_segments: List[str],
        non_origin_portions: Dict[int, str],
        prompt: str
    ) -> tuple[List[str], Dict[int, List[int]]]:
        """Translate origin segments using non-origin texts as reference for alignment."""
        
        # Build enhanced prompt with multi-source context
        enhanced_prompt_parts = [prompt]
        if non_origin_portions:
            enhanced_prompt_parts.append("\n\nAdditional reference sources:")
            for source_id, text_portion in non_origin_portions.items():
                if text_portion:
                    enhanced_prompt_parts.append(f"\nSource {source_id}: {text_portion}...")
        
        enhanced_prompt = "\n".join(enhanced_prompt_parts)
        
        # Prepare chunk
        chunk_text = " ||| ".join(origin_segments)
        
        # Send to AI
        translated_text = self.send_chunk_for_translation(chunk_text, enhanced_prompt)
        
        if not translated_text or "Translation failed" in translated_text:
            logger.error("AI translation failed in multi-source alignment")
            raise Exception(f"Translation failed: {translated_text}")
        
        # Parse translated segments
        translated_segments = re.split(r'\s*\|\|\|\s*', translated_text.strip())
        
        split_indexes: Dict[int, List[int]] = {}
        return translated_segments, split_indexes

