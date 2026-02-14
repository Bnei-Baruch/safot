"""
Tests for cost calculator utility
"""
import pytest
from services.cost_calculator import get_model_pricing, calculate_cost
from models import Provider


class TestGetModelPricing:
    """Test model pricing retrieval"""

    def test_openai_gpt4o_pricing(self):
        """Test getting pricing for GPT-4o"""
        pricing = get_model_pricing(Provider.OPENAI, "gpt-4o")

        assert "input_price" in pricing
        assert "output_price" in pricing
        assert pricing["input_price"] == 2.5
        assert pricing["output_price"] == 10.0

    def test_claude_sonnet_pricing(self):
        """Test getting pricing for Claude Sonnet 4.5"""
        pricing = get_model_pricing(Provider.CLAUDE, "claude-sonnet-4-5-20250929")

        assert "input_price" in pricing
        assert "output_price" in pricing
        assert pricing["input_price"] == 3.0
        assert pricing["output_price"] == 15.0

    def test_unknown_model_raises_error(self):
        """Test that unknown model raises ValueError"""
        with pytest.raises(ValueError, match="Unknown model"):
            get_model_pricing(Provider.OPENAI, "nonexistent-model")

    def test_unknown_provider_raises_error(self):
        """Test that unknown provider raises ValueError"""
        with pytest.raises(ValueError, match="Unknown provider"):
            get_model_pricing("invalid-provider", "gpt-4o")


class TestCalculateCost:
    """Test cost calculation"""

    def test_basic_cost_calculation(self):
        """Test basic cost calculation for GPT-4o"""
        result = calculate_cost(
            input_tokens=1000,
            output_tokens=2000,
            provider=Provider.OPENAI,
            model="gpt-4o"
        )

        # GPT-4o: $2.50 input / $10.00 output per 1M tokens
        # Input: 1000 / 1,000,000 * 2.5 = 0.0025
        # Output: 2000 / 1,000,000 * 10.0 = 0.0200
        # Total: 0.0225

        assert result["input_tokens"] == 1000
        assert result["output_tokens"] == 2000
        assert result["input_cost"] == 0.0025
        assert result["output_cost"] == 0.0200
        assert result["total_cost"] == 0.0225
        assert result["currency"] == "USD"

    def test_claude_cost_calculation(self):
        """Test cost calculation for Claude"""
        result = calculate_cost(
            input_tokens=5000,
            output_tokens=10000,
            provider=Provider.CLAUDE,
            model="claude-sonnet-4-5-20250929"
        )

        # Claude Sonnet: $3.00 input / $15.00 output per 1M tokens
        # Input: 5000 / 1,000,000 * 3.0 = 0.0150
        # Output: 10000 / 1,000,000 * 15.0 = 0.1500
        # Total: 0.1650

        assert result["input_tokens"] == 5000
        assert result["output_tokens"] == 10000
        assert result["input_cost"] == 0.0150
        assert result["output_cost"] == 0.1500
        assert result["total_cost"] == 0.1650
        assert result["currency"] == "USD"

    def test_zero_tokens(self):
        """Test with zero tokens"""
        result = calculate_cost(
            input_tokens=0,
            output_tokens=0,
            provider=Provider.OPENAI,
            model="gpt-4o"
        )

        assert result["input_cost"] == 0.0
        assert result["output_cost"] == 0.0
        assert result["total_cost"] == 0.0

    def test_large_token_counts(self):
        """Test with large token counts"""
        result = calculate_cost(
            input_tokens=100000,
            output_tokens=200000,
            provider=Provider.OPENAI,
            model="gpt-4o"
        )

        # Input: 100000 / 1,000,000 * 2.5 = 0.25
        # Output: 200000 / 1,000,000 * 10.0 = 2.00
        # Total: 2.25

        assert result["input_cost"] == 0.25
        assert result["output_cost"] == 2.00
        assert result["total_cost"] == 2.25

    def test_cost_comparison_between_providers(self):
        """Compare costs between OpenAI and Claude for same token counts"""
        tokens_in = 50000
        tokens_out = 100000

        openai_cost = calculate_cost(tokens_in, tokens_out, Provider.OPENAI, "gpt-4o")
        claude_cost = calculate_cost(tokens_in, tokens_out, Provider.CLAUDE, "claude-sonnet-4-5-20250929")

        # GPT-4o: (50K * 2.5 + 100K * 10.0) / 1M = 0.125 + 1.0 = 1.125
        # Claude: (50K * 3.0 + 100K * 15.0) / 1M = 0.15 + 1.5 = 1.65

        assert openai_cost["total_cost"] == 1.125
        assert claude_cost["total_cost"] == 1.65
        assert claude_cost["total_cost"] > openai_cost["total_cost"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
