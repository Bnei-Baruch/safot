import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useKeycloak } from '@react-keycloak/web';

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
        <AppBar position="static" sx={{ backgroundColor: '#1976d2', color: '#fff' }}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Safot CMS
                </Typography>
                {keycloak?.authenticated ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1">
                            Welcome, {keycloak.tokenParsed?.preferred_username || 'User'}
                        </Typography>
                        <Button color="inherit" onClick={handleLogout}>
                            Logout
                        </Button>
                    </Box>
                ) : (
                    <Button color="inherit" onClick={handleLogin}>
                        Login
                    </Button>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default Header;
