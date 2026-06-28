package de.thaddeus.agent.sse;

import io.quarkus.oidc.client.OidcClient;
import io.quarkus.oidc.client.Tokens;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;

/**
 * Caches and refreshes the OIDC client_credentials access token.
 */
@ApplicationScoped
public class TokenProvider {

    private static final Logger log = Logger.getLogger(TokenProvider.class);

    @Inject OidcClient oidcClient;

    private String cachedToken;
    private Instant expiresAt = Instant.EPOCH;

    public synchronized String getToken() {
        if (cachedToken == null || Instant.now().isAfter(expiresAt.minusSeconds(30))) {
            Tokens tokens = oidcClient.getTokens().await().atMost(Duration.ofSeconds(10));
            cachedToken = tokens.getAccessToken();
            expiresAt = Instant.now().plusSeconds(300);
            log.debug("OIDC token refreshed");
        }
        return cachedToken;
    }
}
