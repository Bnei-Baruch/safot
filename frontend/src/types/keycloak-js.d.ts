declare module 'keycloak-js' {
  export interface KeycloakInstance {
    init: (config: KeycloakInitOptions) => Promise<boolean>;
    login: () => void;
    logout: () => void;

    // Add more KeycloakInstance methods as needed
		authenticated?: boolean;
  }

  export interface KeycloakInitOptions {
    onLoad: string;
    checkLoginIframe?: boolean;
    enableLogging?: boolean;
    pkceMethod?: string;
  }

	const Keycloak: {
    new (config?: KeycloakConfig): KeycloakInstance;
  };

  export default Keycloak;
  
  export interface KeycloakConfig {
    url: string;
    realm: string;
    clientId: string;
    // Add more configuration options as needed
  }
}
