package de.thaddeus.agent.registration;

public record RegisterRequest(
        String hostname,
        String ip,
        String osVersion,
        String agentVersion
) {}
