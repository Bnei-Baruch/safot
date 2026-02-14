"""
Cost calculation utilities for translation services.

Provides functions to calculate costs from token counts using provider pricing.
"""
from services.openai_provider import OPENAI_MODELS
from services.claude_provider import CLAUDE_MODELS
from models import Provider


def get_model_pricing(provider: Provider, model: str) -> dict:
    """
    Get pricing information for a provider/model combination.

    Args:
        provider: Provider enum (OPENAI or CLAUDE)
        model: Model identifier string (e.g., "gpt-4o", "claude-sonnet-4-5-20250929")

    Returns:
        dict with keys:
            - input_price: Price per 1M input tokens (USD)
            - output_price: Price per 1M output tokens (USD)

    Raises:
        ValueError: If model not found for the given provider
    """
    if provider == Provider.OPENAI:
        models_list = OPENAI_MODELS
    elif provider == Provider.CLAUDE:
        models_list = CLAUDE_MODELS
    else:
        raise ValueError(f"Unknown provider: {provider}")

    for model_info in models_list:
        if model_info["value"] == model:
            return {
                "input_price": model_info["input_price"],
                "output_price": model_info["output_price"]
            }

    raise ValueError(f"Unknown model '{model}' for provider '{provider.value}'")


def calculate_cost(
    input_tokens: int,
    output_tokens: int,
    provider: Provider,
    model: str
) -> dict:
    """
    Calculate cost from token counts using provider pricing.

    Prices are per 1M tokens. Returns costs in USD rounded to 4 decimal places.

    Args:
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        provider: Provider enum
        model: Model identifier

    Returns:
        dict with keys:
            - input_tokens: int - Input token count
            - output_tokens: int - Output token count
            - input_cost: float - Cost for input tokens (USD)
            - output_cost: float - Cost for output tokens (USD)
            - total_cost: float - Total cost (USD)
            - currency: str - Always "USD"

    Raises:
        ValueError: If model not found for the given provider

    Example:
        >>> calculate_cost(1000, 2000, Provider.OPENAI, "gpt-4o")
        {
            "input_tokens": 1000,
            "output_tokens": 2000,
            "input_cost": 0.0025,
            "output_cost": 0.0200,
            "total_cost": 0.0225,
            "currency": "USD"
        }
    """
    pricing = get_model_pricing(provider, model)

    # Prices are per 1M tokens
    input_cost = (input_tokens / 1_000_000) * pricing["input_price"]
    output_cost = (output_tokens / 1_000_000) * pricing["output_price"]
    total_cost = input_cost + output_cost

    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost": round(input_cost, 4),
        "output_cost": round(output_cost, 4),
        "total_cost": round(total_cost, 4),
        "currency": "USD"
    }
