import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'thaddeus',
  clientId: 'thaddeus-ui',
});

export default keycloak;
