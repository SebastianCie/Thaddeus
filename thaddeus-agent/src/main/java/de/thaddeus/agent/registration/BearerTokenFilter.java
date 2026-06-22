package de.thaddeus.agent.registration;

import de.thaddeus.agent.sse.TokenProvider;
import jakarta.enterprise.inject.spi.CDI;
import jakarta.ws.rs.client.ClientRequestContext;
import jakarta.ws.rs.client.ClientRequestFilter;

public class BearerTokenFilter implements ClientRequestFilter {

    @Override
    public void filter(ClientRequestContext ctx) {
        TokenProvider provider = CDI.current().select(TokenProvider.class).get();
        String token = provider.getToken();
        ctx.getHeaders().putSingle("Authorization", "Bearer " + token);
    }
}
