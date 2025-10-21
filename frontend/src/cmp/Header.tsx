import React from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from '@mui/material';
import { useKeycloak } from '@react-keycloak/web';
import logo from '../assets/img/logo.png';

const Header: React.FC = () => {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  const handleLogin = () => {
    keycloak?.login();
  };

  const handleLogout = () => {
    keycloak?.logout();
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: '#ffffff', color: '#284952', boxShadow: 'none' }}>
    
        <Container maxWidth="lg" disableGutters>
            <Toolbar sx={{ px: 0, justifyContent: 'space-between' }}>
                <Box display="flex" alignItems="center" gap={0} sx={{ pt: 1 }}>
                  <img src={logo} alt="Safot Logo" style={{ height: 80 }} />
                  <Box display="flex" flexDirection="column" justifyContent="center" alignItems="flex-start">
                    <Typography sx={{ fontFamily: 'Roboto, Helvetica, Arial, sans-serif', fontWeight: 'bold', color: '#284952', fontSize: 18, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1 }}>
                      BNEI BARUCH
                    </Typography>
                    <Typography variant="h6" sx={{ fontFamily: 'JetBrains Mono, monospace', color: '#284952', fontSize: 22, mt: 0.5 }}>
                      Safot
                    </Typography>
                  </Box>
                </Box>

                {keycloak?.authenticated ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 ,fontFamily: 'Kanit, sans-serif'}}>
                    <Typography variant="body1"sx={{ fontFamily: 'inherit' }}>
                    {keycloak.tokenParsed?.preferred_username || 'User'}
                    </Typography>
                    <Button onClick={handleLogout} sx={{ color: '#1976d2',fontFamily: 'inherit' }}>
                    Logout
                    </Button>
                </Box>
                ) : (
                <Button onClick={handleLogin} sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                    Login
                </Button>
                )}
            </Toolbar>
        </Container>
    </AppBar>
  );
};

export default Header;
