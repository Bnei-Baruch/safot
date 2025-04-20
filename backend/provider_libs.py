"""
This file is not part of the main application.
It contains the translation provider implementation used by provider_tools.py
for translating documents from the terminal.
"""

import tiktoken
from openai import OpenAI


class TranslationProvider:
    def __init__(self, api_key, model, prompt, target_language, paragraphs=None):
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.prompt = prompt
        self.target_language = target_language
        self.encoding = tiktoken.encoding_for_model(self.model)
        self.paragraphs = paragraphs or []

    def get_model_token_limit(self):
        model_token_limits = {
            "gpt-4o": {"context_window": 128000, "max_output_tokens": 16384},
            "gpt-4o-2024-11-20": {"context_window": 128000, "max_output_tokens": 16384},
            "gpt-4": {"context_window": 8192, "max_output_tokens": 2048},
            "gpt-4-32k": {"context_window": 32768, "max_output_tokens": 8192},
            "gpt-3.5-turbo": {"context_window": 4096, "max_output_tokens": 1024},
            "text-davinci-003": {"context_window": 4096, "max_output_tokens": 1024},
        }
        return model_token_limits.get(self.model, {"context_window": 0, "max_output_tokens": 0})

    def calculate_segment_token_limit(self, output_ratio=1.2):

        prompt_tokens = len(self.encoding.encode(self.prompt))
        model_limits = self.get_model_token_limit()
        context_window = model_limits["context_window"]
        max_output_tokens = model_limits["max_output_tokens"]
        segment_tokens_by_output = int(max_output_tokens / output_ratio)
        segment_tokens_by_context = context_window - prompt_tokens - max_output_tokens

        return max(min(segment_tokens_by_output, segment_tokens_by_context), 0)

    def prepare_segments_for_translation(self, max_segment_tokens):
        segments = []
        current_segment = []
        current_tokens = 0

        for paragraph in self.paragraphs:

            if not paragraph.strip() or paragraph.strip() == "|||":
                continue

            paragraph_tokens = len(self.encoding.encode(paragraph))
            separator_tokens = len(self.encoding.encode(
                " ||| ")) if current_segment else 0

            if current_tokens + paragraph_tokens + separator_tokens > max_segment_tokens:
                segments.append(" ||| ".join(current_segment))
                current_segment = [paragraph]
                current_tokens = paragraph_tokens
            else:
                current_segment.append(paragraph)
                current_tokens += paragraph_tokens + separator_tokens

        if current_segment:
            segments.append(" ||| ".join(current_segment))

        return segments

    def send_segment_for_translation(self, segment, temperature=0.2):
        """
        1. Prepares a translation prompt using the provided segment 
           and target language.
        2. Retrieves the maximum output tokens required for the API call.
        3. Sends the request to the OpenAI API and retrieves the translated content.
         """
        model_limits = self.get_model_token_limit()
        max_output_tokens = model_limits["max_output_tokens"]
        prompt = self.prompt % {"target_language": self.target_language}
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"{segment}"}
        ]

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
            return f"Translation failed for segment: {segment}"

    def translate_text(self, output_ratio=1.2):

        max_segment_tokens = self.calculate_segment_token_limit(output_ratio)
        segments = self.prepare_segments_for_translation(max_segment_tokens)
        translated_paragraphs = []
        for i, segment in enumerate(segments, 1):
            print(f"Translating segment {i}...")
            # Send segment for translation
            translated_text = self.send_segment_for_translation(segment)
            if translated_text:
                # Split the translated text back into paragraphs
                translated_paragraphs.extend(translated_text.split(" ||| "))
            else:
                print(f"Segment {i} translation failed.")

        return translated_paragraphs
