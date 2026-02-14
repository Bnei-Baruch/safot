"""
Tests for provider abstraction and both OpenAI/Claude providers
"""
import pytest
import logging
from unittest.mock import MagicMock, patch
from services.base_provider import OTHER_LANG_TEXT_MULTIPLIER
from services.openai_provider import OpenAIProvider
from services.claude_provider import ClaudeProvider
from models import TranslationServiceOptions, Provider

# Setup logging for test visibility
logging.basicConfig(level=logging.DEBUG, format='%(message)s')
logger = logging.getLogger(__name__)


@pytest.fixture(params=[
    (Provider.OPENAI, "gpt-4o"),
    (Provider.CLAUDE, "claude-sonnet-4-5-20250929"),
])
def translation_provider(request):
    """Create provider instances for both OpenAI and Claude"""
    provider_type, model = request.param
    options = TranslationServiceOptions(
        model=model,
        provider=provider_type,
        temperature=0.2,
        tpm_limit=30000
    )

    if provider_type == Provider.OPENAI:
        provider = OpenAIProvider(api_key="test_key", options=options)
    elif provider_type == Provider.CLAUDE:
        provider = ClaudeProvider(api_key="test_key", options=options)
    else:
        raise ValueError(f"Unknown provider: {provider_type}")

    # Add provider name to request for logging
    request.node.provider_name = f"{provider_type.value}/{model}"
    return provider


@pytest.fixture(params=[
    (Provider.OPENAI, "gpt-4o"),
    (Provider.CLAUDE, "claude-sonnet-4-5-20250929"),
])
def translation_provider_no_tpm(request):
    """Create provider instances with TPM limiting disabled"""
    provider_type, model = request.param
    options = TranslationServiceOptions(
        model=model,
        provider=provider_type,
        temperature=0.2,
        tpm_limit=0  # Disabled
    )

    if provider_type == Provider.OPENAI:
        provider = OpenAIProvider(api_key="test_key", options=options)
    elif provider_type == Provider.CLAUDE:
        provider = ClaudeProvider(api_key="test_key", options=options)
    else:
        raise ValueError(f"Unknown provider: {provider_type}")

    request.node.provider_name = f"{provider_type.value}/{model}"
    return provider


def create_paragraph(words: int) -> str:
    """Create a paragraph with approximately N words (for token estimation)"""
    return " ".join([f"word{i}" for i in range(words)])


def create_paragraphs(num: int, words_per_paragraph: int = 50) -> list[str]:
    """Create multiple paragraphs"""
    return [create_paragraph(words_per_paragraph) for _ in range(num)]


def log_token_info(provider, description, task_prompt, paragraphs, additional_sources=None):
    """Helper to log token information for debugging"""
    prompt_tokens = provider.calculate_input_tokens(task_prompt, [], None)

    paragraphs_text = "\n".join(paragraphs)
    paragraphs_tokens = provider.calculate_input_tokens("", paragraphs, None)

    sources_tokens = 0
    if additional_sources:
        for i, source in enumerate(additional_sources):
            tokens = provider.calculate_input_tokens("", [source], None)
            sources_tokens += tokens
            logger.info(f"  Additional source {i}: {len(source)} chars, {tokens} tokens")

    total_input = prompt_tokens + paragraphs_tokens + sources_tokens

    logger.info(f"\n{'='*60}")
    logger.info(f"TEST: {description}")
    logger.info(f"Provider: {provider.options.provider.value} / {provider.options.model}")
    logger.info(f"{'='*60}")
    logger.info(f"Prompt tokens: {prompt_tokens}")
    logger.info(f"Paragraphs: {len(paragraphs)} paras, {len(paragraphs_text)} chars, {paragraphs_tokens} tokens")
    logger.info(f"Additional sources: {len(additional_sources) if additional_sources else 0}")
    if additional_sources:
        logger.info(f"Total sources tokens: {sources_tokens}")
    logger.info(f"Total input tokens: {total_input}")
    logger.info(f"TPM limit: {provider.options.tpm_limit}")

    # Estimate output
    num_refs = len(additional_sources) if additional_sources else 0
    estimated_output = provider.estimate_output_tokens(paragraphs, num_refs)
    logger.info(f"Estimated output tokens for {len(paragraphs)} paras and {num_refs} references: {estimated_output}")
    logger.info(f"Total tokens (input + output): {total_input + estimated_output}")


class TestProviderAbstraction:
    """Test that both providers implement the required interface"""

    def test_get_model_token_limit(self, translation_provider):
        """All providers should return model limits"""
        limits = translation_provider.get_model_token_limit()

        assert "context_window" in limits
        assert "max_output_tokens" in limits
        assert limits["context_window"] > 0
        assert limits["max_output_tokens"] > 0

        logger.info(f"\nProvider: {translation_provider.options.provider.value}")
        logger.info(f"Model: {translation_provider.options.model}")
        logger.info(f"Context window: {limits['context_window']}")
        logger.info(f"Max output tokens: {limits['max_output_tokens']}")

    def test_calculate_input_tokens(self, translation_provider):
        """All providers should calculate input tokens"""
        task_prompt = "Translate the following:"
        paragraphs = create_paragraphs(3, words_per_paragraph=10)

        tokens = translation_provider.calculate_input_tokens(task_prompt, paragraphs, None)

        assert tokens > 0
        assert isinstance(tokens, int)

        logger.info(f"\nProvider: {translation_provider.options.provider.value}")
        logger.info(f"Task prompt + 3 paragraphs: {tokens} tokens")

    def test_estimate_output_tokens(self, translation_provider):
        """All providers should estimate output tokens"""
        paragraphs = create_paragraphs(5, words_per_paragraph=20)

        output_no_refs = translation_provider.estimate_output_tokens(paragraphs, 0)
        output_with_refs = translation_provider.estimate_output_tokens(paragraphs, 2)

        assert output_no_refs > 0
        assert output_with_refs > output_no_refs

        logger.info(f"\nProvider: {translation_provider.options.provider.value}")
        logger.info(f"Output estimate (0 refs): {output_no_refs}")
        logger.info(f"Output estimate (2 refs): {output_with_refs}")


class TestLimitAdditionalSources:
    """Test additional sources limiting logic (shared across providers)"""

    def test_no_additional_sources(self, translation_provider):
        """When no additional sources provided, should return None"""
        paragraphs = create_paragraphs(5)
        result = translation_provider.limit_additional_sources(paragraphs, None)
        assert result is None

    def test_single_additional_source(self, translation_provider):
        """Should limit single additional source to paragraphs_length * 1.5"""
        paragraphs = create_paragraphs(2, words_per_paragraph=10)
        large_source = create_paragraph(1000)

        result = translation_provider.limit_additional_sources(paragraphs, [large_source])

        assert result is not None
        assert len(result) == 1
        paragraphs_text = "\n".join(paragraphs)
        max_chars = int(len(paragraphs_text) * OTHER_LANG_TEXT_MULTIPLIER)
        assert len(result[0]) <= max_chars
        assert len(result[0]) < len(large_source)

    def test_multiple_additional_sources(self, translation_provider):
        """Each source should get full budget (1.5x input)"""
        paragraphs = create_paragraphs(3, words_per_paragraph=50)
        sources = [create_paragraph(1000) for _ in range(3)]

        result = translation_provider.limit_additional_sources(paragraphs, sources)

        assert result is not None
        assert len(result) == 3

        # All should be approximately same length
        lengths = [len(s) for s in result]
        logger.info(f"Limited source lengths: {lengths}")
        assert max(lengths) - min(lengths) < 5


class TestReduceParagraphsToFit:
    """Test paragraph reduction logic (shared across providers)"""

    def test_no_paragraphs(self, translation_provider):
        """Should raise error when no paragraphs provided"""
        task_prompt = "Translate the following:"

        with pytest.raises(ValueError, match="Cannot fit any paragraphs"):
            translation_provider.reduce_paragraphs_to_fit(task_prompt, [], None)

    def test_single_paragraph_fits(self, translation_provider):
        """Single small paragraph should fit"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(1, words_per_paragraph=10)

        log_token_info(translation_provider, "Single paragraph fits", task_prompt, paragraphs)

        result_paras, result_sources, output_tokens = translation_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} paragraphs, available_output_tokens: {output_tokens}")

        assert len(result_paras) == 1
        assert result_sources is None
        assert output_tokens > 0

    def test_all_paragraphs_fit(self, translation_provider):
        """Multiple small paragraphs should all fit"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(10, words_per_paragraph=10)

        log_token_info(translation_provider, "All paragraphs fit", task_prompt, paragraphs)

        result_paras, result_sources, output_tokens = translation_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} paragraphs, available_output_tokens: {output_tokens}")

        assert len(result_paras) == 10
        assert result_sources is None
        assert output_tokens > 0

    def test_tpm_limit_reduces_paragraphs(self, translation_provider):
        """TPM limit should reduce number of paragraphs"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(100, words_per_paragraph=100)

        log_token_info(translation_provider, "TPM limit reduces paragraphs", task_prompt, paragraphs)

        result_paras, result_sources, output_tokens = translation_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"Result: {len(result_paras)} of {len(paragraphs)} paragraphs fit")
        logger.info(f"Available output tokens: {output_tokens}")

        # Calculate actual tokens used
        actual_input = translation_provider.calculate_input_tokens(task_prompt, result_paras, result_sources)
        actual_output = translation_provider.estimate_output_tokens(result_paras, 0)
        logger.info(f"Actual input tokens: {actual_input}")
        logger.info(f"Actual estimated output: {actual_output}")
        logger.info(f"Actual total: {actual_input + actual_output}")

        # Should reduce paragraphs
        assert len(result_paras) < 100
        assert len(result_paras) > 0
        assert result_sources is None
        assert output_tokens > 0

        # Verify we're under TPM limit
        assert actual_input + actual_output <= translation_provider.options.tpm_limit

    def test_with_additional_sources(self, translation_provider):
        """Should handle additional sources correctly"""
        task_prompt = "Translate:"
        paragraphs = create_paragraphs(5, words_per_paragraph=20)
        additional_sources = [create_paragraph(500), create_paragraph(500)]

        log_token_info(translation_provider, "With additional sources", task_prompt, paragraphs, additional_sources)

        result_paras, result_sources, output_tokens = translation_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, additional_sources
        )

        logger.info(f"Result: {len(result_paras)} paragraphs")
        for i, src in enumerate(result_sources):
            logger.info(f"Limited source {i}: {len(src)} chars (original: {len(additional_sources[i])} chars)")
        logger.info(f"Available output tokens: {output_tokens}")

        assert len(result_paras) > 0
        assert result_sources is not None
        assert len(result_sources) == 2
        assert output_tokens > 0


class TestTPMLimiting:
    """Test TPM rate limiting behavior"""

    def test_tpm_disabled_allows_more_paragraphs(self, translation_provider, translation_provider_no_tpm):
        """Disabling TPM should allow more paragraphs"""
        # Skip if providers don't match
        if translation_provider.options.provider != translation_provider_no_tpm.options.provider:
            pytest.skip("Provider mismatch in fixture")

        task_prompt = "Translate:"
        paragraphs = create_paragraphs(100, words_per_paragraph=50)

        logger.info(f"\n{'='*60}")
        logger.info(f"TEST: TPM disabled allows more paragraphs")
        logger.info(f"Provider: {translation_provider.options.provider.value}")
        logger.info(f"{'='*60}")

        log_token_info(translation_provider, "With TPM limit (30K)", task_prompt, paragraphs)
        with_tpm, _, _ = translation_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )
        logger.info(f"With TPM limit: {len(with_tpm)} paragraphs")

        log_token_info(translation_provider_no_tpm, "Without TPM limit", task_prompt, paragraphs)
        without_tpm, _, _ = translation_provider_no_tpm.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )
        logger.info(f"Without TPM limit: {len(without_tpm)} paragraphs")

        # Without TPM limit should allow more (only limited by context window)
        assert len(without_tpm) >= len(with_tpm)


class TestOpenAISpecific:
    """OpenAI-specific tests"""

    def test_openai_model_limits(self):
        """Test OpenAI model limits are correct"""
        options = TranslationServiceOptions(
            model="gpt-4o",
            provider=Provider.OPENAI,
            temperature=0.2,
            tpm_limit=30000
        )
        provider = OpenAIProvider(api_key="test_key", options=options)

        limits = provider.get_model_token_limit()
        assert limits["context_window"] == 128000
        assert limits["max_output_tokens"] == 16384

    def test_openai_uses_tiktoken(self):
        """Test OpenAI uses tiktoken for encoding"""
        options = TranslationServiceOptions(
            model="gpt-4o",
            provider=Provider.OPENAI,
            temperature=0.2,
            tpm_limit=30000
        )
        provider = OpenAIProvider(api_key="test_key", options=options)

        # Should have encoding attribute
        assert hasattr(provider, 'encoding')
        assert provider.encoding is not None


class TestClaudeSpecific:
    """Claude-specific tests"""

    def test_claude_model_limits(self):
        """Test Claude model limits are correct"""
        options = TranslationServiceOptions(
            model="claude-sonnet-4-5-20250929",
            provider=Provider.CLAUDE,
            temperature=0.2,
            tpm_limit=30000
        )
        provider = ClaudeProvider(api_key="test_key", options=options)

        limits = provider.get_model_token_limit()
        assert limits["context_window"] == 200000
        assert limits["max_output_tokens"] == 16384

    def test_claude_opus_model_limits(self):
        """Test Claude Opus has correct limits"""
        options = TranslationServiceOptions(
            model="claude-opus-4-6-20250514",
            provider=Provider.CLAUDE,
            temperature=0.2,
            tpm_limit=30000
        )
        provider = ClaudeProvider(api_key="test_key", options=options)

        limits = provider.get_model_token_limit()
        assert limits["context_window"] == 200000
        assert limits["max_output_tokens"] == 16384

    def test_claude_uses_tiktoken_approximation(self):
        """Test Claude uses tiktoken as approximation"""
        options = TranslationServiceOptions(
            model="claude-sonnet-4-5-20250929",
            provider=Provider.CLAUDE,
            temperature=0.2,
            tpm_limit=30000
        )
        provider = ClaudeProvider(api_key="test_key", options=options)

        # Should have encoding attribute (using tiktoken as approximation)
        assert hasattr(provider, 'encoding')
        assert provider.encoding is not None


class TestProviderComparison:
    """Compare behavior across providers"""

    def test_both_providers_handle_same_input(self):
        """Both providers should handle same input similarly"""
        task_prompt = "Translate the following text:"
        paragraphs = create_paragraphs(10, words_per_paragraph=20)

        # OpenAI provider
        openai_options = TranslationServiceOptions(
            model="gpt-4o",
            provider=Provider.OPENAI,
            temperature=0.2,
            tpm_limit=30000
        )
        openai_provider = OpenAIProvider(api_key="test_key", options=openai_options)

        # Claude provider
        claude_options = TranslationServiceOptions(
            model="claude-sonnet-4-5-20250929",
            provider=Provider.CLAUDE,
            temperature=0.2,
            tpm_limit=30000
        )
        claude_provider = ClaudeProvider(api_key="test_key", options=claude_options)

        # Both should fit all paragraphs (small input)
        openai_result, _, openai_output = openai_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )
        claude_result, _, claude_output = claude_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"\nOpenAI: {len(openai_result)} paragraphs, {openai_output} output tokens")
        logger.info(f"Claude: {len(claude_result)} paragraphs, {claude_output} output tokens")

        # Both should fit all paragraphs
        assert len(openai_result) == 10
        assert len(claude_result) == 10

        # Claude has larger context window, so should have more output tokens available
        assert claude_output >= openai_output

    def test_claude_allows_more_with_larger_context(self):
        """Claude's larger context window should allow more paragraphs"""
        task_prompt = "Translate:"
        # Create many paragraphs to potentially exceed gpt-4o but not Claude
        paragraphs = create_paragraphs(500, words_per_paragraph=80)

        # OpenAI provider (128K context)
        openai_options = TranslationServiceOptions(
            model="gpt-4o",
            provider=Provider.OPENAI,
            temperature=0.2,
            tpm_limit=0  # Disable TPM to test context window only
        )
        openai_provider = OpenAIProvider(api_key="test_key", options=openai_options)

        # Claude provider (200K context)
        claude_options = TranslationServiceOptions(
            model="claude-sonnet-4-5-20250929",
            provider=Provider.CLAUDE,
            temperature=0.2,
            tpm_limit=0  # Disable TPM to test context window only
        )
        claude_provider = ClaudeProvider(api_key="test_key", options=claude_options)

        openai_result, _, _ = openai_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )
        claude_result, _, _ = claude_provider.reduce_paragraphs_to_fit(
            task_prompt, paragraphs, None
        )

        logger.info(f"\nWith 500 large paragraphs:")
        logger.info(f"OpenAI (128K context): {len(openai_result)} paragraphs")
        logger.info(f"Claude (200K context): {len(claude_result)} paragraphs")

        # Claude should fit more or equal paragraphs
        assert len(claude_result) >= len(openai_result)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])  # -s to show print/logging output
