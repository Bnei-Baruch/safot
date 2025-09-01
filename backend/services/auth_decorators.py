from functools import wraps
from fastapi import HTTPException, status
from typing import Callable, Any
import logging

# Control what gets imported with 'from services.auth_decorators import *'
__all__ = [
    'require_admin',
    'require_write',
    'require_read'
]

logger = logging.getLogger(__name__)

# Role hierarchy: admin > write > read
REQUIRED_ROLE_HIERARCHY = {
    'safot-admin': 3,
    'safot-write': 2,
    'safot-read': 1
}

def get_user_role_level(user_info: str):
    for role in REQUIRED_ROLE_HIERARCHY:
        if role in user_info['roles']:
            return REQUIRED_ROLE_HIERARCHY[role]
    return 0

def require_role(required_role: str):
    """Decorator to require specific role for endpoint access"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, user_info: dict = None, **kwargs):
            if not user_info:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="User info not available"
                )           
            
            user_level = get_user_role_level(user_info)
            required_level = REQUIRED_ROLE_HIERARCHY.get(required_role, 0)
            if user_level < required_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required role: {required_role}"
                )
            
            # Check if the function is async and await it accordingly
            result = func(*args, user_info=user_info, **kwargs)
            if hasattr(result, '__await__'):  # Check if it's a coroutine
                return await result
            return result
        return wrapper
    return decorator

def require_admin(func: Callable) -> Callable:
    """Decorator to require admin role"""
    return require_role('safot-admin')(func)

def require_write(func: Callable) -> Callable:
    """Decorator to require write role or higher"""
    return require_role('safot-write')(func)

def require_read(func: Callable) -> Callable:
    """Decorator to require read role or higher"""
    return require_role('safot-read')(func)