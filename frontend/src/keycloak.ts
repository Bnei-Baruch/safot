import Keycloak from 'keycloak-js';

const REACT_APP_KEYCLOAK_URL="https://auth.2serv.eu/auth";
const REACT_APP_KEYCLOAK_REALM="master";
const REACT_APP_KEYCLOAK_CLIENT_ID="kolman-dev";

const keycloakConfig = {
  url: REACT_APP_KEYCLOAK_URL,
  realm: REACT_APP_KEYCLOAK_REALM,
  clientId: REACT_APP_KEYCLOAK_CLIENT_ID,
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
