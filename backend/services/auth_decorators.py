from functools import wraps
from fastapi import HTTPException, status
from typing import Callable, List

def require_roles(*roles: str):
    """Decorator to require ANY of the specified roles"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, user_info: dict = None, **kwargs):
            if not user_info:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User info not available"
                )
            
            user_roles = user_info.get('roles', [])
            if not any(role in user_roles for role in roles):
                roles_str = " or ".join(roles)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Required roles: {roles_str}"
                )
            
            result = func(*args, user_info=user_info, **kwargs)
            if hasattr(result, '__await__'):
                return await result
            return result
        return wrapper
    return decorator

# Convenience decorators for common role combinations
# Note: Admin role is included by default in all decorators
def require_admin(func: Callable) -> Callable:
    """Require admin role only"""
    return require_roles('safot-admin')(func)

def require_write(func: Callable) -> Callable:
    """Require write or admin role"""
    return require_roles('safot-write', 'safot-admin')(func)

def require_read(func: Callable) -> Callable:
    """Require read, write, or admin role (basically any authenticated user)"""
    return require_roles('safot-read', 'safot-write', 'safot-admin')(func)