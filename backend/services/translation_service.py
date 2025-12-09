import os
import tiktoken
import logging
import json
from openai import OpenAI
from openai import OpenAIError
from datetime import datetime
from models import TranslationServiceOptions, TranslationExample
from dotenv import load_dotenv
from typing import List
import re
from services.prompt import SOURCES_CONTENT


# Get logger for this module
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Constant for calculating additional sources text length relative to original text
ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER = 1.5

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

    def calculate_chunk_token_limit(self, output_ratio=1.2, original_segments_text: str = "", additional_sources: List[dict] | None = None):
        base_prompt_tokens = len(self.encoding.encode(self.prompt_text))
        
        # Calculate original segments tokens
        original_segments_tokens = len(self.encoding.encode(original_segments_text)) if original_segments_text else 0
        
        # Calculate additional sources tokens
        additional_sources_tokens = 0
        if additional_sources and len(additional_sources) > 0 and original_segments_text:
            # Calculate character length for each source text
            original_segments_chars = len(original_segments_text)
            per_source_text_chars = int(original_segments_chars * ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER)
            
            # Iterate through each additional source and calculate exact tokens
            for source in additional_sources:
                language = source.get("language", "")
                source_text = source.get("text", "")[:per_source_text_chars]
                # Encode the language string
                source_tokens = len(self.encoding.encode(f"{language} : {source_text}"))
                additional_sources_tokens += source_tokens
        
        prompt_tokens = base_prompt_tokens + original_segments_tokens + additional_sources_tokens
        
        model_limits = self.get_model_token_limit()
        context_window = model_limits["context_window"]
        max_output_tokens = model_limits["max_output_tokens"]
        chunk_tokens_by_output = int(max_output_tokens / output_ratio)
        chunk_tokens_by_context = context_window - prompt_tokens - max_output_tokens
        return max(min(chunk_tokens_by_output, chunk_tokens_by_context, 4000), 0)

    def reduce_segments_to_fit(self, paragraphs: List[str], additional_sources: List[dict] | None = None) -> tuple[List[str], int]:
        """
        Reduces segments until they fit within the model's context window.
        """
        paragraphs_to_translate = paragraphs.copy()
        
        # Calculate original segments text length (combined with separators)
        original_segments_text = " ||| ".join(paragraphs_to_translate)
        
        # Calculate chunk limit with additional sources
        max_chunk_tokens = self.calculate_chunk_token_limit(
            original_segments_text=original_segments_text,
            additional_sources=additional_sources
        )
        
        # If chunk limit is too small, reduce segments until it fits
        while max_chunk_tokens <= 0 and len(paragraphs_to_translate) > 0:
            # Remove last segment and recalculate
            paragraphs_to_translate = paragraphs_to_translate[:-1]
            if len(paragraphs_to_translate) == 0:
                break
            original_segments_text = " ||| ".join(paragraphs_to_translate)
            max_chunk_tokens = self.calculate_chunk_token_limit(
                original_segments_text=original_segments_text,
                additional_sources=additional_sources
            )
            logger.warning("Reduced segments to %d due to prompt size constraints", len(paragraphs_to_translate))
        
        if len(paragraphs_to_translate) == 0:
            raise ValueError("Cannot fit any segments within model context window. Prompt or additional sources may be too large.")
        
        return paragraphs_to_translate, max_chunk_tokens

    def inject_additional_sources_into_prompt(self, prompt: str, current_segments_text: str, additional_sources: List[dict] | None = None) -> str:
        """
        Injects additional sources into the prompt by replacing SOURCES_CONTENT placeholders.
        """
        if not additional_sources or len(additional_sources) == 0:
            return prompt
        
        # Calculate per-source text length: original segments length * multiplier
        per_source_text_length = int(len(current_segments_text) * ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER)
        
        # Truncate each additional source text to the calculated length per source
        for source in additional_sources:
            source_text = source.get("text", "")
            if len(source_text) > per_source_text_length:
                source_text = source_text[:per_source_text_length]
            
            source_line = SOURCES_CONTENT.format(
                language=source.get("language", ""), 
                text=source_text
            )
            # Replace first occurrence of placeholder with actual source
            prompt = prompt.replace(SOURCES_CONTENT, source_line, 1)
        
        return prompt

    def update_segments_from_response(self, segments: dict, all_segments: dict, remaining_additional_sources: List[dict] | None = None) -> None:
        """
        Updates all_segments dictionary with segments from the response and updates remaining_additional_sources text.
        Maps segments from response (keyed by language) to composite keys: "sourceId_language"
        """
        if not remaining_additional_sources or not segments:
            return

        # Map segments to sources based on language
        # Model returns segments keyed by language only, we map them to (source_id, language) keys
        for source in remaining_additional_sources:
            lang = source.get("language", "")
            source_id = source.get("source_id", "")
            remaining_text = source.get("text", "")
            
            # Get segments for this language from response
            response_segments = segments.get(lang, [])
            
            # Use composite key: "sourceId_language"
            key = f"{source_id}_{lang}"
            
            if key not in all_segments:
                all_segments[key] = []
            
            if not response_segments:
                continue
            
            # Add segments from response
            all_segments[key].extend(response_segments)
            
            # Calculate consumed length: sum of all segment lengths
            consumed_length = sum(len(seg) for seg in response_segments)
            consumed_length = min(consumed_length, len(remaining_text))
            
            # Update remaining text
            source["text"] = remaining_text[consumed_length:]
            

    def prepare_chunks_for_translation(self, items, max_chunk_tokens):
        """
        Prepares a single chunk from items for translation.
        Returns a list with a single chunk containing all items joined with " ||| ".
        """
        chunk_items = []

        for paragraph in items:
            if not paragraph.strip() or paragraph.strip() == "|||":
                continue
            chunk_items.append(paragraph)

        # Return single chunk with all items (already validated to fit by reduce_segments_to_fit)
        if chunk_items:
            return " ||| ".join(chunk_items)
        return ""
    
    
    def send_chunk_for_translation(self, chunk: str, prompt: str) -> dict:
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
                return {"translation": "", "segments": {}}

            text = response.choices[0].message.content.strip()
            # Extract JSON from markdown code blocks if present, otherwise parse directly
            json_text = re.sub(r'```(?:json)?\s*', '', text).replace('```', '').strip()
            try:
                return json.loads(json_text)
            except json.JSONDecodeError:
                return {"translation": text, "segments": {}}

        except OpenAIError as e:
            logger.error("OpenAI API error: %s", str(e))
            return {"translation": "", "segments": {}}
        except Exception as e:
            logger.error("Unexpected error during OpenAI call: %s", str(e))
            return {"translation": "", "segments": {}}
    
    def translate_paragraphs(self, paragraphs: List[str], additional_sources: List[dict] | None = None) -> tuple[List[str], dict]:
        remaining_paragraphs = paragraphs.copy()
        translated_paragraphs = []
        all_segments = {}  # Track segments for each source language: {language: [segment1, segment2, ...]}
        
        # Create a copy of additional sources to track remaining text
        remaining_additional_sources = None
        if additional_sources:
            remaining_additional_sources = [
                {"language": source.get("language", ""), "text": source.get("text", ""), "source_id": source.get("source_id", ""), "original_text": source.get("text", "")}
                for source in additional_sources
            ]

        batch_num = 0
        while remaining_paragraphs:
            batch_num += 1
            logger.debug("Processing batch %d with %d remaining paragraphs", batch_num, len(remaining_paragraphs))
            
            # Reduce segments to fit within context window
            paragraphs_to_translate, max_chunk_tokens = self.reduce_segments_to_fit(
                remaining_paragraphs, 
                remaining_additional_sources
            )
            
            # Prepare chunk from the adjusted paragraphs
            prepared_chunk = self.prepare_chunks_for_translation(paragraphs_to_translate, max_chunk_tokens)                             
            
            # Inject additional sources into prompt if provided
            prompt = self.inject_additional_sources_into_prompt(
                self.prompt_text,
                current_segments_text=prepared_chunk,
                additional_sources=remaining_additional_sources
            )
            
            # Send chunk for translation
            response_data = self.send_chunk_for_translation(chunk=prepared_chunk, prompt=prompt)
            batch_translation = response_data.get("translation", "")
            segments = response_data.get("segments", {})
            
            # Check if translation is empty (error occurred)
            if not batch_translation or not batch_translation.strip():
                logger.error("Received empty translation response for batch %d. This may indicate an API error.", batch_num)
                raise ValueError(f"Translation failed: received empty response from API for batch {batch_num}")
            
            self.update_segments_from_response(segments, all_segments, remaining_additional_sources)
            translated_paragraphs.extend(re.split(r'\s*\|\|\|\s*', batch_translation.strip()))
            
            # Remove translated paragraphs from remaining
            num_translated = len(paragraphs_to_translate)
            remaining_paragraphs = remaining_paragraphs[num_translated:]
            logger.debug("Translated %d paragraphs in batch %d, %d remaining", num_translated, batch_num, len(remaining_paragraphs))

        properties = {
            "provider": self.options.provider.value,
            "model": self.options.model,
            "temperature": self.options.temperature,
        }

        logger.info("Translation completed successfully. Translated %d paragraphs in %d batches", len(translated_paragraphs), batch_num)       
        return translated_paragraphs, all_segments, properties

