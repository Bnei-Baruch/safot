import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { userService } from '../services/user.service';
import UserTable from '../cmp/UserTable';
import UserSearch from '../cmp/UserSearch';
import { useUser } from '../contexts/UserContext';
import { User } from '../types/frontend-types';

const UserManagement: React.FC = () => {
  const { permissions, currentUser } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userChanges, setUserChanges] = useState<Map<string, string[]>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    if (permissions.hasRole('safot-admin')) {
      loadInitialData();
    }
  }, [permissions]);

  // Handle search with debouncing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (permissions.hasRole('safot-admin')) {
        searchUsers(searchTerm);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, permissions]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, rolesData] = await Promise.all([
        userService.getUsers(),
        userService.getAvailableRoles()
      ]);
      setUsers(usersData);
      setAvailableRoles(rolesData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const usersData = await userService.getUsers(search || undefined);
      setUsers(usersData);
    } catch (err) {
      setError('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = useCallback((userId: string, roles: string[]) => {
    setUserChanges(prev => new Map(prev.set(userId, roles)));
  }, []);

  const handleSaveUser = useCallback(async (userId: string) => {
    const roles = userChanges.get(userId);
    if (roles) {
      try {
        await userService.updateUserRoles(userId, roles);
        setUserChanges(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        // Refresh search results
        searchUsers(searchTerm);
      } catch (err) {
        setError('Failed to update user roles');
      }
    }
  }, [userChanges, searchTerm]);

  const handleCancelChanges = useCallback((userId: string) => {
    setUserChanges(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  if (!permissions.hasRole('safot-admin')) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">Access Denied</Typography>
          <Typography>You need admin privileges to access user management.</Typography>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        User Management
      </Typography>
      
      <UserSearch
        value={searchTerm}
        onChange={handleSearchChange}
      />
      
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <UserTable
          users={users}
          availableRoles={availableRoles}
          userChanges={userChanges}
          onRoleChange={handleRoleChange}
          onSaveUser={handleSaveUser}
          onCancelChanges={handleCancelChanges}
          currentUserId={currentUser?.sub}
        />
      )}
    </Container>
  );
};

export default UserManagement;
