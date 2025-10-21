from functools import wraps
from fastapi import HTTPException, status
from typing import Callable, List
from keycloak import KeycloakOpenID
import os
from fastapi import Request
import logging

logger = logging.getLogger(__name__)

# Initialize Keycloak
logger.info('Initializing keycloak with URL: %s, Client ID: %s, Realm: %s', 
            os.getenv('KEYCLOAK_SERVER_URL'),
            os.getenv('KEYCLOAK_CLIENT_ID'), 
            os.getenv('KEYCLOAK_REALM_NAME'))

keycloak_openid = KeycloakOpenID(
    server_url=os.getenv('KEYCLOAK_SERVER_URL'),
    client_id=os.getenv('KEYCLOAK_CLIENT_ID'),
    realm_name=os.getenv('KEYCLOAK_REALM_NAME'),
)

# User info middlware
async def get_user_info(request: Request):
    # Extract token from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        logger.error('Missing authorization header')
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED,
                            detail='Missing or invalid token')

    token = auth_header[len('Bearer '):].strip()
    try:
        # Validate token and get user info
        user_info = keycloak_openid.decode_token(token)
        return user_info
    except Exception as e:
        logger.error('Invalid or expired token: %s', e)
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED,
                            detail='Invalid or expired token')


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

            user_roles = set()
            client_access = user_info.get('resource_access', {})
            client_id = keycloak_openid.client_id
            if client_id in client_access:
                user_roles.update(client_access[client_id].get('roles', []))
            user_roles.update(user_info.get('roles', []))

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

