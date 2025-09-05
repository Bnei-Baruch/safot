# Keycloak Setup Guide for Safot User Management

## Overview
This guide explains how to configure Keycloak to support the role-based access control (RBAC) system implemented in Safot.

## Required Roles

The system expects the following roles to be configured in Keycloak:

1. **safot-admin** - Full system access (highest level)
2. **safot-write** - Can create, edit, and delete content
3. **safot-read** - Read-only access (lowest level)

## Setup Steps

### 1. Access Keycloak Admin Console
- Navigate to your Keycloak server (typically `http://localhost:8080`)
- Log in with admin credentials
- Select your realm (or create a new one called `safot`)

### 2. Create Roles
1. Go to **Configure** → **Roles**
2. Click **Add Role** for each role:

   **safot-admin:**
   - Role Name: `safot-admin`
   - Description: `Full system access for Safot administrators`

   **safot-write:**
   - Role Name: `safot-write`
   - Description: `Can create, edit, and delete Safot content`

   **safot-read:**
   - Role Name: `safot-read`
   - Description: `Read-only access to Safot content`

### 3. Assign Roles to Users
1. Go to **Manage** → **Users**
2. Select a user
3. Go to **Role Mappings** tab
4. Add the appropriate role(s) to the user

### 4. Set Default Role (Optional)
1. Go to **Configure** → **Realm Settings**
2. Click **Roles** tab
3. Set **Default Roles** to include `safot-read` for new users

## Role Hierarchy

The system uses a hierarchical role system:
- **safot-admin** (level 3): Can access everything
- **safot-write** (level 2): Can create, edit, delete content
- **safot-read** (level 1): Can only view content

Users with higher-level roles automatically have access to lower-level permissions.

## Testing

To test the role-based access:

1. **Create a test user with `safot-read` role:**
   - Should only be able to view content
   - Cannot create, edit, or delete

2. **Create a test user with `safot-write` role:**
   - Should be able to create, edit, and delete content
   - Cannot access admin features

3. **Create a test user with `safot-admin` role:**
   - Should have full access to all features

## Troubleshooting

### Common Issues:

1. **Roles not appearing in frontend:**
   - Ensure roles are assigned to the user
   - Check that the client has the roles configured
   - Verify the token contains the roles

2. **Permission denied errors:**
   - Check that the user has the required role
   - Verify the role hierarchy is working correctly
   - Check backend logs for authentication errors

3. **Token issues:**
   - Ensure the client is configured to include roles in tokens
   - Check that the realm is correctly configured

## Environment Variables

Make sure your backend has the correct Keycloak configuration:

```bash
KEYCLOAK_SERVER_URL=http://localhost:8080
KEYCLOAK_CLIENT_ID=your-client-id
KEYCLOAK_REALM_NAME=your-realm-name
KEYCLOAK_CLIENT_SECRET=your-client-secret
```

## Security Notes

- Roles are managed entirely through Keycloak
- No user management database is needed
- All authentication and authorization is handled by Keycloak
- The system follows the principle of least privilege