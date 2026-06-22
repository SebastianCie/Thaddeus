package de.thaddeus.agent.sse;

import io.quarkus.oidc.client.OidcClient;
import io.quarkus.oidc.client.Tokens;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.Instant;

/**
 * Caches and refreshes the OIDC client_credentials access token.
 */
@ApplicationScoped
public class TokenProvider {

    @Inject OidcClient oidcClient;

    private String cachedToken;
    private Instant expiresAt = Instant.EPOCH;

    public synchronized String getToken() {
        if (cachedToken == null || Instant.now().isAfter(expiresAt.minusSeconds(30))) {
            Tokens tokens = oidcClient.getTokens().await().indefinitely();
            cachedToken = tokens.getAccessToken();
            expiresAt = Instant.now().plusSeconds(300);
        }
        return cachedToken;
    }
}
