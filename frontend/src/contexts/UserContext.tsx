import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const { keycloak, initialized } = useKeycloak();

  const refreshUser = async () => {
    if (keycloak?.authenticated && keycloak.tokenParsed) {
      try {
        // Extract user info directly from Keycloak token (matching backend logic)
        const tokenParsed = keycloak.tokenParsed;
        
        // Extract roles from token claims - only custom user roles
        let userRoles: string[] = [];
        
        // Check direct roles property (this is where our custom roles are!)
        if (tokenParsed.roles && Array.isArray(tokenParsed.roles)) {
          userRoles = [...tokenParsed.roles];
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
  };

  useEffect(() => {
    if (initialized && keycloak?.authenticated) {
      refreshUser().finally(() => setIsLoading(false));
    } else if (initialized) {
      setIsLoading(false);
    }
  }, [initialized, keycloak?.authenticated]);

  // Role-based permissions (matching backend logic)
  const permissions: UserPermissions = {
    // Check if user has a specific role or higher
    hasRole: (requiredRole: string) => {
      const roleHierarchy = { 'safot-admin': 3, 'safot-write': 2, 'safot-read': 1 };
      const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;
      
      // Check if user has any role with equal or higher level
      for (const [role, level] of Object.entries(roleHierarchy)) {
        if (currentUser?.roles?.includes(role) && level >= requiredLevel) {
          return true;
        }
      }
      return false;
    },
    
    // Generate authorization message
    getAuthMessage: (action: string, requiredRole: string) => {
      const userRole = currentUser?.roles?.includes('safot-admin') ? 'safot-admin' :
                      currentUser?.roles?.includes('safot-write') ? 'safot-write' :
                      currentUser?.roles?.includes('safot-read') ? 'safot-read' : 'none';
      
      return `You need '${requiredRole}' role or higher to ${action}. Current role: ${userRole}`;
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
