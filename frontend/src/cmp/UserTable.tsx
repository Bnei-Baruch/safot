import React, { memo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  FormControlLabel,
  Button,
  Box
} from '@mui/material';
import { User } from '../types/frontend-types';

interface UserTableProps {
  users: User[];
  availableRoles: string[];
  userChanges: Map<string, string[]>;
  onRoleChange: (userId: string, roles: string[]) => void;
  onSaveUser: (userId: string) => void;
  onCancelChanges: (userId: string) => void;
  currentUserId?: string;
}

const UserTable: React.FC<UserTableProps> = memo(({
  users,
  availableRoles,
  userChanges,
  onRoleChange,
  onSaveUser,
  onCancelChanges,
  currentUserId,
}) => {
  const handleRoleToggle = (userId: string, roleName: string, checked: boolean) => {
    // Prevent users from removing their own admin role
    if (currentUserId === userId && !checked && roleName.toLowerCase().includes('admin')) {
      const currentRoles = userChanges.get(userId) || users.find(u => u.id === userId)?.roles || [];
      const hasOtherAdminRoles = currentRoles.some(role => 
        role !== roleName && role.toLowerCase().includes('admin')
      );

      if (!hasOtherAdminRoles) {
        alert('You cannot remove your own admin role');
        return;
      }
    }

    const currentRoles = userChanges.get(userId) || users.find(u => u.id === userId)?.roles || [];
    const newRoles = checked
      ? [...currentRoles, roleName]
      : currentRoles.filter(role => role !== roleName);

    onRoleChange(userId, newRoles);
  };

  const hasChanges = (userId: string) => {
    const originalRoles = users.find(u => u.id === userId)?.roles || [];
    const changedRoles = userChanges.get(userId) || [];
    return JSON.stringify(originalRoles.sort()) !== JSON.stringify(changedRoles.sort());
  };

  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Roles</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map(user => {
            const currentRoles = userChanges.get(user.id) || user.roles;
            const hasUserChanges = hasChanges(user.id);

            return (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {availableRoles.map(role => (
                      <FormControlLabel
                        key={role}
                        control={
                          <Checkbox
                            checked={currentRoles.includes(role)}
                            onChange={(e) => handleRoleToggle(user.id, role, e.target.checked)}
                            size="small"
                          />
                        }
                        label={role}
                        sx={{ margin: 0 }}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => onSaveUser(user.id)}
                      disabled={!hasUserChanges}
                    >
                      Save
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => onCancelChanges(user.id)}
                      disabled={!hasUserChanges}
                    >
                      Cancel
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

UserTable.displayName = 'UserTable';

export default UserTable;
