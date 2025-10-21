import React, { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { CurrentUser, UserPermissions } from '../types/frontend-types';
import { useKeycloak } from '@react-keycloak/web';

interface UserContextType {
  currentUser: CurrentUser | null;
  permissions: UserPermissions;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {keycloak, initialized} = useKeycloak();

  const refreshUser = useCallback(async () => {
    if (keycloak?.authenticated && keycloak.tokenParsed) {
      try {
        // Extract user info directly from Keycloak token (matching backend logic)
        const tokenParsed = keycloak.tokenParsed as any;

        // Extract roles from token claims - only custom user roles
        let userRoles: string[] = [];

        // Check direct roles property (this is where our custom roles are!)
        if (tokenParsed.roles && Array.isArray(tokenParsed.roles)) {
          userRoles = [...tokenParsed.roles];
        } else if (tokenParsed.resource_access && tokenParsed.resource_access[keycloak.clientId] &&
            Array.isArray(tokenParsed.resource_access[keycloak.clientId].roles)) {
          userRoles = [...tokenParsed.resource_access[keycloak.clientId].roles];
        }

        const userData: CurrentUser = {
          sub: tokenParsed.sub || '',
          preferred_username: tokenParsed.preferred_username,
          email: tokenParsed.email,
          name: tokenParsed.name,
          roles: userRoles
        };

        setCurrentUser(userData);
      } catch (error) {
        console.error('Failed to parse user info from token:', error);
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
  }, [keycloak]);

  useEffect(() => {
    if (initialized && keycloak?.authenticated) {
      refreshUser().finally(() => setIsLoading(false));
    } else if (initialized) {
      setIsLoading(false);
    }
  }, [initialized, refreshUser, keycloak?.authenticated]);

  const permissions: UserPermissions = {
    // Role checking with hierarchy: admin > write > read
    hasRole: (role: string) => {
      if (!currentUser?.roles) return false;

      // Admin can do everything
      if (currentUser.roles.includes('safot-admin')) return true;

      // Check specific role
      if (role === 'safot-write') return currentUser.roles.includes('safot-write');
      if (role === 'safot-read') return currentUser.roles.includes('safot-read') || currentUser.roles.includes('safot-write');

      return false;
    },

    hasAnyRole: (roles: string[]) => {
      return roles.some(role => permissions.hasRole(role));
    },

    // Helper for authorization messages (backward compatible)
    getAuthMessage: (action: string, requiredRole: string | string[]) => {
      const userRole = currentUser?.roles?.includes('safot-admin') ? 'safot-admin' :
                      currentUser?.roles?.includes('safot-write') ? 'safot-write' :
                      currentUser?.roles?.includes('safot-read') ? 'safot-read' : 'none';

      if (Array.isArray(requiredRole)) {
        const rolesStr = requiredRole.join(' or ');
        return `You need ${rolesStr} role to ${action}. Current role: ${userRole}`;
      } else {
        return `You need '${requiredRole}' role to ${action}. Current role: ${userRole}`;
      }
    }
  };

  const value: UserContextType = {
    currentUser,
    permissions,
    isLoading,
    refreshUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

