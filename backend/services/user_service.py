import os
import logging
import requests
from typing import List, Dict, Optional
from keycloak import KeycloakAdmin
from keycloak.exceptions import KeycloakGetError, KeycloakPutError

logger = logging.getLogger(__name__)

class UserManagementService:
    def __init__(self):
        self.server_url = os.getenv('KEYCLOAK_SERVER_URL', 'http://keycloak:8080')
        self.admin_username = os.getenv('KEYCLOAK_ADMIN_USERNAME', 'admin')
        self.admin_password = os.getenv('KEYCLOAK_ADMIN_PASSWORD', 'admin')
        self.target_realm = os.getenv('KEYCLOAK_REALM_NAME', 'safot')
        self._admin_token = None

    def _get_admin_token(self):
        """Get admin token from master realm"""
        if self._admin_token:
            return self._admin_token

        token_url = f"{self.server_url}/realms/master/protocol/openid-connect/token"
        data = {
            'username': self.admin_username,
            'password': self.admin_password,
            'grant_type': 'password',
            'client_id': 'admin-cli'
        }

        response = requests.post(token_url, data=data)
        if response.status_code == 200:
            self._admin_token = response.json()['access_token']
            return self._admin_token
        else:
            raise Exception(f"Failed to get admin token: {response.status_code} - {response.text}")

    def _make_admin_request(self, method, endpoint, **kwargs):
        """Make authenticated request to Keycloak admin API"""
        token = self._get_admin_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        headers.update(kwargs.get('headers', {}))

        url = f"{self.server_url}/admin/realms/{self.target_realm}/{endpoint}"
        response = requests.request(method, url, headers=headers, **kwargs)

        if response.status_code == 401:
            # Token expired, refresh it
            self._admin_token = None
            token = self._get_admin_token()
            headers['Authorization'] = f'Bearer {token}'
            response = requests.request(method, url, headers=headers, **kwargs)

        return response

    def get_all_users(self, search: str = None) -> List[Dict]:
        """Fetch all users from Keycloak with their roles"""
        try:
            # Add search parameter if provided
            params = {}
            if search:
                params['search'] = search
                logger.info(f"Searching for users with search term: '{search}'")

            response = self._make_admin_request('GET', 'users', params=params)
            if response.status_code != 200:
                raise Exception(f"Failed to fetch users: {response.status_code} - {response.text}")

            users = response.json()
            logger.info(f"Keycloak returned {len(users)} users")
            users_with_roles = []

            for user in users:
                # Get user roles
                user_roles = self.get_user_roles(user['id'])

                user_data = {
                    'id': user['id'],
                    'name': f"{user.get('firstName', '')} {user.get('lastName', '')}".strip() or user.get('username', ''),
                    'email': user.get('email', ''),
                    'roles': user_roles,
                    'enabled': user.get('enabled', True),
                    'createdTimestamp': user.get('createdTimestamp', 0)
                }
                users_with_roles.append(user_data)

            logger.info(f"Returning {len(users_with_roles)} users with roles")
            return users_with_roles
        except Exception as e:
            logger.error(f"Failed to fetch users from Keycloak: {e}")
            raise Exception("Failed to fetch users from Keycloak")

    def get_user_roles(self, user_id: str) -> List[str]:
        """Get roles for a specific user"""
        try:
            response = self._make_admin_request('GET', f'users/{user_id}/role-mappings/realm')
            if response.status_code != 200:
                logger.error(f"Failed to get roles for user {user_id}: {response.status_code} - {response.text}")
                return []

            realm_roles = response.json()
            # Filter for our custom roles (safot-*)
            safot_roles = [role['name'] for role in realm_roles if role['name'].startswith('safot-')]

            return safot_roles
        except Exception as e:
            logger.error(f"Failed to get roles for user {user_id}: {e}")
            return []

    def update_user_roles(self, user_id: str, roles: List[str]) -> bool:
        """Update user roles in Keycloak"""
        try:
            # Get all available realm roles
            response = self._make_admin_request('GET', 'roles')
            if response.status_code != 200:
                raise Exception(f"Failed to get available roles: {response.status_code} - {response.text}")

            all_roles = response.json()
            role_mapping = {role['name']: role for role in all_roles}

            # Filter to only include valid safot roles
            valid_roles = [role for role in roles if role.startswith('safot-') and role in role_mapping]

            # Get current user roles
            current_response = self._make_admin_request('GET', f'users/{user_id}/role-mappings/realm')
            if current_response.status_code != 200:
                raise Exception(f"Failed to get current user roles: {current_response.status_code} - {current_response.text}")

            current_roles = current_response.json()
            current_role_names = [role['name'] for role in current_roles if role['name'].startswith('safot-')]

            # Determine roles to add and remove
            roles_to_add = [role_mapping[role] for role in valid_roles if role not in current_role_names]
            roles_to_remove = [role for role in current_roles if role['name'].startswith('safot-') and role['name'] not in valid_roles]

            # Update roles - use the correct format for Keycloak API
            if roles_to_add:
                # Format roles correctly for Keycloak API
                formatted_roles = []
                for role in roles_to_add:
                    formatted_roles.append({
                        'id': role['id'],
                        'name': role['name'],
                        'description': role.get('description', ''),
                        'composite': role.get('composite', False),
                        'clientRole': role.get('clientRole', False),
                        'containerId': role.get('containerId', '')
                    })

                logger.info(f"Adding roles to user {user_id}: {[r['name'] for r in formatted_roles]}")
                add_response = self._make_admin_request('POST', f'users/{user_id}/role-mappings/realm', json=formatted_roles)
                logger.info(f"Add roles response: {add_response.status_code} - {add_response.text}")
                if add_response.status_code not in [200, 204]:
                    raise Exception(f"Failed to assign roles: {add_response.status_code} - {add_response.text}")

            if roles_to_remove:
                logger.info(f"Removing roles from user {user_id}: {[r['name'] for r in roles_to_remove]}")
                remove_response = self._make_admin_request('DELETE', f'users/{user_id}/role-mappings/realm', json=roles_to_remove)
                logger.info(f"Remove roles response: {remove_response.status_code} - {remove_response.text}")
                if remove_response.status_code not in [200, 204]:
                    raise Exception(f"Failed to remove roles: {remove_response.status_code} - {remove_response.text}")

            logger.info(f"Successfully updated roles for user {user_id}: {valid_roles}")
            return True

        except Exception as e:
            logger.error(f"Failed to update roles for user {user_id}: {e}")
            raise Exception(f"Failed to update user roles: {str(e)}")

    def get_available_roles(self) -> List[str]:
        """Get all available safot roles in the realm"""
        try:
            response = self._make_admin_request('GET', 'roles')
            if response.status_code != 200:
                logger.error(f"Failed to fetch available roles: {response.status_code} - {response.text}")
                # Return default roles if Keycloak is unavailable
                return ['safot-admin', 'safot-write', 'safot-read']

            all_roles = response.json()
            safot_roles = [role['name'] for role in all_roles if role['name'].startswith('safot-')]
            return safot_roles
        except Exception as e:
            logger.error(f"Failed to fetch available roles: {e}")
            # Return default roles if Keycloak is unavailable
            return ['safot-admin', 'safot-write', 'safot-read']

