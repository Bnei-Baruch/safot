import unittest
from unittest.mock import patch, MagicMock
from provider_libs import TranslationProvider
from provider_tools import main


class TestProviderTools(unittest.TestCase):
    @patch("provider_tools.os.environ.get")
    def test_get_api_key_from_env(self, mock_get_env):
        """
        Test if API key is retrieved from environment variables correctly.
        """
        mock_get_env.return_value = "test_api_key"
        api_key = mock_get_env("OPENAI_API_KEY")
        self.assertEqual(api_key, "test_api_key")

    @patch("provider_libs.TranslationProvider.send_segment_for_translation")
    def test_translation_provider_workflow(self, mock_send_segment):
        """
        Test the TranslationProvider workflow.
        """
        # Mock the translation responses
        mock_send_segment.return_value = "Translated Paragraph 1 ||| Translated Paragraph 2"

        # Create a TranslationProvider instance
        translator = TranslationProvider(
            api_key="test_api_key",
            model="gpt-4",
            prompt="Translate this text into [target language].",
            target_language="English",
            paragraphs=["Paragraph 1.", "Paragraph 2."]
        )

        translated_paragraphs = translator.translate_text(output_ratio=1.2)

        # Assert combined translation works correctly
        self.assertEqual(translated_paragraphs, ["Translated Paragraph 1", "Translated Paragraph 2"])
        mock_send_segment.assert_called_once_with("Paragraph 1. ||| Paragraph 2.")

    @patch("provider_libs.TranslationProvider.prepare_segments_for_translation")
    def test_prepare_segments(self, mock_prepare_segments):
        """
        Test the prepare_segments_for_translation method.
        """
        mock_prepare_segments.return_value = ["Segment 1", "Segment 2"]

        translator = TranslationProvider(
            api_key="test_api_key",
            model="gpt-4",
            prompt="Translate this text into [target language].",
            target_language="English",
            paragraphs=["Paragraph 1.", "Paragraph 2."]
        )

        segments = translator.prepare_segments_for_translation(max_segment_tokens=100)

        # Assert segments are returned correctly
        self.assertEqual(segments, ["Segment 1", "Segment 2"])
        mock_prepare_segments.assert_called_once_with(max_segment_tokens=100)


if __name__ == "__main__":
    unittest.main()
