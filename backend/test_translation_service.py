"""
Tests for TranslationService request sizing and batching logic
"""
import pytest
import logging
from unittest.mock import MagicMock, patch
from services.translation_service import TranslationService, ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER
from models import TranslationServiceOptions

# Setup logging for test visibility
logging.basicConfig(level=logging.DEBUG, format='%(message)s')
logger = logging.getLogger(__name__)


@pytest.fixture
def translation_service():
    """Create a TranslationService instance with test configuration"""
    options = TranslationServiceOptions(
        model="gpt-4o",
        temperature=0.2,
        tpm_limit=30000
    )
    service = TranslationService(api_key="test_key", options=options)
    return service


@pytest.fixture
def translation_service_no_tpm():
    """Create a TranslationService instance with TPM limiting disabled"""
    options = TranslationServiceOptions(
        model="gpt-4o",
        temperature=0.2,
        tpm_limit=0  # Disabled
    )
    service = TranslationService(api_key="test_key", options=options)
    return service


def create_paragraph(words: int) -> str:
    """Create a paragraph with approximately N words (for token estimation)"""
    return " ".join([f"word{i}" for i in range(words)])


def create_paragraphs(num: int, words_per_paragraph: int = 50) -> list[str]:
    """Create multiple paragraphs"""
    return [create_paragraph(words_per_paragraph) for _ in range(num)]


def log_token_info(service, description, task_prompt, paragraphs, additional_sources=None):
    """Helper to log token information for debugging"""
    prompt_tokens = len(service.encoding.encode(task_prompt))

    paragraphs_text = "\n".join(paragraphs)
    paragraphs_tokens = len(service.encoding.encode(paragraphs_text))

    sources_tokens = 0
    if additional_sources:
        for i, source in enumerate(additional_sources):
            tokens = len(service.encoding.encode(source))
            sources_tokens += tokens
            logger.info(f"  Additional source {i}: {len(source)} chars, {tokens} tokens")

    total_input = prompt_tokens + paragraphs_tokens + sources_tokens

    logger.info(f"\n{'='*60}")
    logger.info(f"TEST: {description}")
    logger.info(f"{'='*60}")
    logger.info(f"Prompt tokens: {prompt_tokens}")
    logger.info(f"Paragraphs: {len(paragraphs)} paras, {len(paragraphs_text)} chars, {paragraphs_tokens} tokens")
    logger.info(f"Additional sources: {len(additional_sources) if additional_sources else 0}")
    if additional_sources:
        logger.info(f"Total sources tokens: {sources_tokens}")
    logger.info(f"Total input tokens: {total_input}")
    logger.info(f"TPM limit: {service.options.tpm_limit}")

    # Estimate output
    num_refs = len(additional_sources) if additional_sources else 0
    estimated_output = service.estimate_output_tokens(paragraphs, num_refs)
    logger.info(f"Estimated output tokens for {len(paragraphs)} and {num_refs} refereces: {estimated_output}")
    logger.info(f"Total tokens (input + output): {total_input + estimated_output}")


class TestLimitAdditionalSources:
    """Test additional sources limiting logic"""

    def test_no_additional_sources(self, translation_service):
        """When no additional sources provided, should return None"""
        paragraphs = create_paragraphs(5)
        result = translation_service.limit_additional_sources(paragraphs, None)
        assert result is None

    def test_empty_additional_sources(self, translation_service):
        """When empty list provided, should return None"""
        paragraphs = create_paragraphs(5)
        result = translation_service.limit_additional_sources(paragraphs, [])
        assert result is None

    def test_single_additional_source(self, translation_service):
        """Should limit single additional source to paragraphs_length * 1.5"""
        paragraphs = create_paragraphs(2, words_per_paragraph=10)  # ~20 words total
        # Create large additional source
        large_source = create_paragraph(1000)  # Much larger than limit

        result = translation_service.limit_additional_sources(paragraphs, [large_source])

        assert result is not None
        assert len(result) == 1
        # Should be limited (approximately paragraphs_length * 1.5)
        paragraphs_text = "\n".join(paragraphs)
        max_chars = int(len(paragraphs_text) * ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER)
        assert len(result[0]) <= max_chars
        assert len(result[0]) < len(large_source)  # Should be truncated

    def test_multiple_additional_sources(self, translation_service):
        """Each source should get full budget (1.5x input) to reference all paragraphs"""
        paragraphs = create_paragraphs(3, words_per_paragraph=50)
        sources = [create_paragraph(1000) for _ in range(3)]

        log_token_info(translation_service, "Multiple additional sources limiting",
                      "Test prompt", paragraphs, sources)

        result = translation_service.limit_additional_sources(paragraphs, sources)

        assert result is not None
        assert len(result) == 3

        # All should be approximately same length (each gets full multiplier budget)
        lengths = [len(s) for s in result]
        logger.info(f"Limited source lengths: {lengths}")
        assert max(lengths) - min(lengths) < 5  # Should be very close

        # Each source should have enough tokens to extract references for all paragraphs
        # With ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER = 1.5, each source gets ~1.5x paragraph tokens
        paragraphs_tokens = sum(len(translation_service.encoding.encode(p)) for p in paragraphs)
        logger.info(f"Total paragraphs tokens: {paragraphs_tokens}")

        for i, source in enumerate(result):
            source_tokens = len(translation_service.encoding.encode(source))
            logger.info(f"Limited source {i}: {source_tokens} tokens")
            # Each source should have at least as many tokens as all paragraphs combined
            # (since each source needs to contain references for all paragraphs)
            # Use 0.9 instead of 1.0 to allow for character-to-token conversion variance
            assert source_tokens >= paragraphs_tokens * 0.9, \
                f"Source {i} has only {source_tokens} tokens, expected at least {paragraphs_tokens * 0.9}"

    def test_small_sources_not_truncated(self, translation_service):
        """Sources smaller than budget should not be modified"""
        paragraphs = create_paragraphs(10, words_per_paragraph=50)  # Large paragraph set
        small_source = create_paragraph(10)  # Small source

        result = translation_service.limit_additional_sources(paragraphs, [small_source])

        assert result is not None
        assert len(result) == 1
        assert result[0] == small_source  # Should be unchanged


class TestReduceParagraphsToFit:
    """Test paragraph reduction logic to fit within limits"""

    def test_no_paragraphs(self, translation_service):
        """Should raise error when no paragraphs provided"""
        task_prompt = "Translate the following:"

        with pytest.raises(ValueError, match="Cannot fit any paragraphs"):
            translation_service.reduce_paragraphs_to_fit(task_prompt, [], None)

    def test_single_paragraph_fits(self, translation_service):
        """Single small paragraph should fit"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(1, words_per_paragraph=10)

        log_token_info(translation_service, "Single paragraph fits", task_prompt, paragraphs)

        result_paras, result_sources, output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} paragraphs, available_output_tokens: {output_tokens}")

        assert len(result_paras) == 1
        assert result_sources is None
        assert output_tokens > 0

    def test_all_paragraphs_fit(self, translation_service):
        """Multiple small paragraphs should all fit"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(10, words_per_paragraph=10)

        log_token_info(translation_service, "All paragraphs fit", task_prompt, paragraphs)

        result_paras, result_sources, output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} paragraphs, available_output_tokens: {output_tokens}")

        assert len(result_paras) == 10
        assert result_sources is None
        assert output_tokens > 0

    def test_tpm_limit_reduces_paragraphs(self, translation_service):
        """TPM limit should reduce number of paragraphs"""
        task_prompt = "Translate:"
        # Create many large paragraphs that will exceed TPM limit
        paragraphs = create_paragraphs(100, words_per_paragraph=100)

        log_token_info(translation_service, "TPM limit reduces paragraphs", task_prompt, paragraphs)

        result_paras, result_sources, output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} of {len(paragraphs)} paragraphs fit")
        logger.info(f"Available output tokens: {output_tokens}")

        # Calculate actual tokens used
        actual_input = translation_service.calculate_input_tokens(task_prompt, result_paras, result_sources)
        actual_output = translation_service.estimate_output_tokens(result_paras, 0)
        logger.info(f"Actual input tokens: {actual_input}")
        logger.info(f"Actual estimated output: {actual_output}")
        logger.info(f"Actual total: {actual_input + actual_output}")

        # Should reduce paragraphs to fit under TPM limit
        assert len(result_paras) < 100
        assert len(result_paras) > 0
        assert result_sources is None
        assert output_tokens > 0

        # Verify we're under TPM limit
        assert actual_input + actual_output <= translation_service.options.tpm_limit

    def test_context_window_limit(self, translation_service_no_tpm):
        """Context window should limit paragraphs when TPM disabled"""
        task_prompt = "Translate:"
        # Create paragraphs that would exceed context window
        # gpt-4o has 128K context window, need ~100K+ tokens to trigger reduction
        paragraphs = create_paragraphs(2000, words_per_paragraph=50)

        log_token_info(translation_service_no_tpm, "Context window limit (TPM disabled)",
                      task_prompt, paragraphs)

        result_paras, result_sources, output_tokens = translation_service_no_tpm.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} of {len(paragraphs)} paragraphs fit")
        logger.info(f"Available output tokens: {output_tokens}")

        # Should reduce to fit context window
        assert len(result_paras) < 2000, f"Expected reduction but got {len(result_paras)} paragraphs"
        assert len(result_paras) > 0
        assert output_tokens > 0

    def test_with_additional_sources_no_sources(self, translation_service):
        """Should handle additional sources = 0"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(5, words_per_paragraph=20)

        log_token_info(translation_service, "Zero additional sources", task_prompt, paragraphs, None)

        result_paras, result_sources, output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} paragraphs, available_output_tokens: {output_tokens}")

        assert len(result_paras) > 0
        assert result_sources is None
        assert output_tokens > 0

    def test_with_additional_sources_one_source(self, translation_service):
        """Should handle additional sources = 1"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(5, words_per_paragraph=20)
        additional_sources = [create_paragraph(500)]

        log_token_info(translation_service, "One additional source", task_prompt, paragraphs, additional_sources)

        result_paras, result_sources, output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, additional_sources
        )

        logger.info(f"Result: {len(result_paras)} paragraphs")
        logger.info(f"Limited source: {len(result_sources[0])} chars (original: {len(additional_sources[0])} chars)")
        logger.info(f"Available output tokens: {output_tokens}")

        assert len(result_paras) > 0
        assert result_sources is not None
        assert len(result_sources) == 1
        # Should be limited
        assert len(result_sources[0]) <= len(additional_sources[0])
        assert output_tokens > 0

    def test_with_additional_sources_two_sources(self, translation_service):
        """Should handle additional sources = 2"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(5, words_per_paragraph=20)
        additional_sources = [create_paragraph(500), create_paragraph(500)]

        log_token_info(translation_service, "Two additional sources", task_prompt, paragraphs, additional_sources)

        result_paras, result_sources, output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, additional_sources
        )

        logger.info(f"Result: {len(result_paras)} paragraphs")
        for i, src in enumerate(result_sources):
            logger.info(f"Limited source {i}: {len(src)} chars (original: {len(additional_sources[i])} chars)")
        logger.info(f"Available output tokens: {output_tokens}")

        assert len(result_paras) > 0
        assert result_sources is not None
        assert len(result_sources) == 2
        # Both should be limited
        for i in range(2):
            assert len(result_sources[i]) <= len(additional_sources[i])
        assert output_tokens > 0

    def test_with_additional_sources_three_sources(self, translation_service):
        """Should handle additional sources = 3"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(5, words_per_paragraph=20)
        additional_sources = [create_paragraph(500) for _ in range(3)]

        log_token_info(translation_service, "Three additional sources", task_prompt, paragraphs, additional_sources)

        result_paras, result_sources, output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, additional_sources
        )

        logger.info(f"Result: {len(result_paras)} paragraphs")
        for i, src in enumerate(result_sources):
            logger.info(f"Limited source {i}: {len(src)} chars (original: {len(additional_sources[i])} chars)")
        logger.info(f"Available output tokens: {output_tokens}")

        assert len(result_paras) > 0
        assert result_sources is not None
        assert len(result_sources) == 3
        assert output_tokens > 0

    def test_additional_sources_reduce_paragraph_count(self, translation_service):
        """More additional sources should reduce number of paragraphs that fit"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(50, words_per_paragraph=20)

        logger.info(f"\n{'='*60}")
        logger.info(f"TEST: Additional sources reduce paragraph count")
        logger.info(f"{'='*60}")

        # Test with 0 sources
        log_token_info(translation_service, "With 0 sources", task_prompt, paragraphs, None)
        result_0, _, _ = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )
        logger.info(f"With 0 sources: {len(result_0)} paragraphs fit")

        # Test with 1 source
        sources_1 = [create_paragraph(1000)]
        log_token_info(translation_service, "With 1 source", task_prompt, paragraphs, sources_1)
        result_1, _, _ = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, sources_1
        )
        logger.info(f"With 1 source: {len(result_1)} paragraphs fit")

        # Test with 2 sources
        sources_2 = [create_paragraph(1000), create_paragraph(1000)]
        log_token_info(translation_service, "With 2 sources", task_prompt, paragraphs, sources_2)
        result_2, _, _ = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, sources_2
        )
        logger.info(f"With 2 sources: {len(result_2)} paragraphs fit")

        # More sources should allow fewer paragraphs
        assert len(result_0) >= len(result_1)
        assert len(result_1) >= len(result_2)

    def test_maximum_paragraphs_used(self, translation_service):
        """Should use maximum possible number of paragraphs"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(100, words_per_paragraph=20)

        log_token_info(translation_service, "Maximum paragraphs used", task_prompt, paragraphs)

        result_paras, _, _ = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Maximum fit: {len(result_paras)} paragraphs")

        # Try adding one more paragraph - should exceed limits
        test_paras = paragraphs[:len(result_paras) + 1]
        try:
            # This should either fit (if we were conservative) or exceed limits
            test_result, _, _ = translation_service.reduce_paragraphs_to_fit(
                task_prompt, test_paras, None
            )
            # If it fits, we should get all paragraphs
            logger.info(f"Adding one more: {len(test_result)} paragraphs fit (was conservative)")
            assert len(test_result) == len(test_paras)
        except ValueError:
            # If it doesn't fit, that's expected - we're at maximum
            logger.info(f"Adding one more exceeds limits (at maximum)")
            pass


class TestTokenCalculations:
    """Test token counting and estimation"""

    def test_calculate_input_tokens_no_sources(self, translation_service):
        """Should calculate tokens correctly without additional sources"""
        task_prompt = "Translate the following text:"
        paragraphs = create_paragraphs(3, words_per_paragraph=10)

        tokens = translation_service.calculate_input_tokens(task_prompt, paragraphs, None)

        assert tokens > 0
        # Should be roughly: prompt tokens + paragraph tokens
        prompt_tokens = len(translation_service.encoding.encode(task_prompt))
        assert tokens > prompt_tokens

    def test_calculate_input_tokens_with_sources(self, translation_service):
        """Should include additional sources in token count"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(3, words_per_paragraph=10)
        sources = [create_paragraph(50)]

        tokens_with = translation_service.calculate_input_tokens(task_prompt, paragraphs, sources)
        tokens_without = translation_service.calculate_input_tokens(task_prompt, paragraphs, None)

        # With sources should have more tokens
        assert tokens_with > tokens_without

    def test_estimate_output_tokens_scales_with_input(self, translation_service):
        """Output estimation should scale with input size"""
        small_paras = create_paragraphs(1, words_per_paragraph=10)
        large_paras = create_paragraphs(10, words_per_paragraph=10)

        small_output = translation_service.estimate_output_tokens(small_paras, 0)
        large_output = translation_service.estimate_output_tokens(large_paras, 0)

        assert large_output > small_output

    def test_estimate_output_tokens_increases_with_references(self, translation_service):
        """More references should increase output estimation"""
        paragraphs = create_paragraphs(5, words_per_paragraph=20)

        output_0_refs = translation_service.estimate_output_tokens(paragraphs, 0)
        output_1_ref = translation_service.estimate_output_tokens(paragraphs, 1)
        output_2_refs = translation_service.estimate_output_tokens(paragraphs, 2)

        # More references = larger multiplier = more output
        assert output_1_ref > output_0_refs
        assert output_2_refs > output_1_ref


class TestTPMLimiting:
    """Test TPM rate limiting behavior"""

    def test_tpm_disabled_allows_more_paragraphs(self, translation_service, translation_service_no_tpm):
        """Disabling TPM should allow more paragraphs"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(100, words_per_paragraph=50)

        logger.info(f"\n{'='*60}")
        logger.info(f"TEST: TPM disabled allows more paragraphs")
        logger.info(f"{'='*60}")

        log_token_info(translation_service, "With TPM limit (30K)", task_prompt, paragraphs)
        with_tpm, _, _ = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )
        logger.info(f"With TPM limit: {len(with_tpm)} paragraphs")

        log_token_info(translation_service_no_tpm, "Without TPM limit", task_prompt, paragraphs)
        without_tpm, _, _ = translation_service_no_tpm.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )
        logger.info(f"Without TPM limit: {len(without_tpm)} paragraphs")

        # Without TPM limit should allow more (only limited by context window)
        assert len(without_tpm) >= len(with_tpm)

    def test_very_large_additional_sources_exceed_tpm(self, translation_service):
        """Very large additional sources should trigger TPM limiting"""
        task_prompt = "Translate: " * 2000
        paragraphs = create_paragraphs(50, words_per_paragraph=40)
        # Create huge additional sources
        huge_sources = [create_paragraph(10000) for _ in range(3)]

        log_token_info(translation_service, "Very large additional sources",
                      task_prompt, paragraphs, huge_sources)

        result_paras, result_sources, available_output_tokens = translation_service.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, huge_sources
        )

        logger.info(f"Result: {len(result_paras)} paragraphs")
        logger.info(f"Available output tokens: {available_output_tokens}")
        logger.info(f"TPM limit: {translation_service.options.tpm_limit}")
        logger.info(f"Context window: {translation_service.get_model_token_limit()['context_window']}")
        for i, src in enumerate(result_sources):
            src_tokens = len(translation_service.encoding.encode(src))
            orig_tokens = len(translation_service.encoding.encode(huge_sources[i]))
            logger.info(f"Limited source {i}: {src_tokens} tokens / {len(src)} chars (original: {orig_tokens} tokens / {len(huge_sources[i])} chars)")
            logger.info(f"  Token reduction: {100 * (1 - src_tokens/orig_tokens):.1f}%, Char reduction: {100 * (1 - len(src)/len(huge_sources[i])):.1f}%")

        # Should still return something (limited)
        assert len(result_paras) > 0
        assert result_sources is not None
        # Sources should be significantly truncated
        for i in range(3):
            assert len(result_sources[i]) < len(huge_sources[i])

    def test_error_message_includes_token_breakdown(self, translation_service):
        """Error should include helpful token breakdown"""
        # Test with empty paragraphs list - should always raise ValueError with helpful message
        task_prompt = "Translate the following:"
        paragraphs = []  # Empty list - cannot fit any paragraphs
        huge_sources = [create_paragraph(1000)]

        logger.info("\n" + "="*60)
        logger.info("TEST: Error message includes token breakdown")
        logger.info("="*60)

        with pytest.raises(ValueError) as exc_info:
            translation_service.reduce_paragraphs_to_fit(task_prompt, paragraphs, huge_sources)

        error_msg = str(exc_info.value)
        logger.info(f"Error message: {error_msg}")

        assert "Prompt:" in error_msg
        assert "Additional sources:" in error_msg
        assert "TPM limit:" in error_msg
        assert "tokens" in error_msg


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])  # -s to show print/logging output
