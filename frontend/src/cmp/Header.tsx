import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import { useKeycloak } from '@react-keycloak/web';
import logo from '../style/logo.png';

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
               
                <Box display="flex" alignItems="center" gap={0} sx={{ ml: '-72px' }}>
                {/* <Box display="flex" alignItems="center" gap={1}> */}
                <img src={logo} alt="Safot Logo" style={{ height: 70 }} />
                <Typography variant="h6" sx={{ fontFamily: 'JetBrains Mono, monospace', color: '#284952'}}>
                    Safot
                </Typography>
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
