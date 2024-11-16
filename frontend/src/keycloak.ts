import Keycloak from 'keycloak-js';

const KEYCLOAK_URL = process.env.REACT_APP_KEYCLOAK_URL;
const KEYCLOAK_REALM = process.env.REACT_APP_KEYCLOAK_REALM;
const KEYCLOAK_CLIENT_ID = process.env.REACT_APP_KEYCLOAK_CLIENT_ID;

const keycloakConfig = {
  url: KEYCLOAK_URL,
  realm: KEYCLOAK_REALM,
  clientId: KEYCLOAK_CLIENT_ID,
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
