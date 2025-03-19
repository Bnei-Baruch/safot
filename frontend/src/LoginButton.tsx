import React, { useState } from 'react';
import { useKeycloak } from '@react-keycloak/web';

interface CustomTokenParsed {
  name?: string;
  preferred_username?: string;
}

declare module 'keycloak-js' {
  interface KeycloakInstance {
    tokenParsed?: CustomTokenParsed;
  }
}
import './LoginButton.css';
import { Avatar, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';

const LoginButton: React.FC = () => {
  const { keycloak } = useKeycloak();

  const getUserInitials = () => {
    const name = keycloak?.tokenParsed?.name || keycloak?.tokenParsed?.preferred_username;
    return name
      ? name
        .split(' ')
        .map((n) => n[0].toUpperCase())
        .slice(0, 2)
        .join('')
      : '';
  };

  const handleLogin = () => {
    keycloak.login();
  };

  const handleLogout = () => {
    keycloak.logout();
  };

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton onClick={handleOpenMenu} sx={{ padding: 0 }}>
        <Avatar sx={{
          color: (keycloak.authenticated ? 'primary.contrastText' : 'background.paper'),
          bgcolor: (keycloak.authenticated ? 'primary.main' : 'text.secondary'),
          width: 40, height: 40,
        }}>
          {keycloak.authenticated ?
            <Typography>
              {getUserInitials()}
            </Typography> :
            <LoginIcon />
          }
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        PaperProps={{
          style: {
            borderRadius: 8,
            padding: 0,
            minWidth: 120,
          },
        }}
      >
        <MenuItem
          onClick={keycloak.authenticated ? handleLogout : handleLogin}
        >
          {keycloak.authenticated ? 'Logout' : 'Login'}
        </MenuItem>
      </Menu>
    </>
  );
};

export default LoginButton;
