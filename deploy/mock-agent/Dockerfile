# Stage 1: Build agent JAR
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml mvnw ./
COPY .mvn .mvn
COPY thaddeus-server/pom.xml thaddeus-server/pom.xml
COPY thaddeus-agent thaddeus-agent
RUN --mount=type=cache,target=/root/.m2 mvn -pl thaddeus-agent -am package -DskipTests -q

# Stage 2: PowerShell Core (Ubuntu) + JDK 21 runtime + agent
FROM mcr.microsoft.com/powershell:7.4-ubuntu-22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-21-jre-headless curl \
    && rm -rf /var/lib/apt/lists/*

# Install mock WebAdministration module for the root user
RUN mkdir -p /root/.local/share/powershell/Modules/WebAdministration
COPY deploy/mock-agent/WebAdministration.psm1 /root/.local/share/powershell/Modules/WebAdministration/

WORKDIR /deployments
COPY --from=build /build/thaddeus-agent/target/quarkus-app/lib/ ./lib/
COPY --from=build /build/thaddeus-agent/target/quarkus-app/*.jar ./
COPY --from=build /build/thaddeus-agent/target/quarkus-app/app/ ./app/
COPY --from=build /build/thaddeus-agent/target/quarkus-app/quarkus/ ./quarkus/

ENV THADDEUS_SERVER_URL=http://host.containers.internal:8081
ENV OIDC_ISSUER_URL=http://host.containers.internal:8080/realms/thaddeus
ENV OIDC_CLIENT_ID=thaddeus-agent
ENV OIDC_CLIENT_SECRET=thaddeus-agent-secret
ENV JAVA_OPTS="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"

EXPOSE 8090
CMD ["java", "-jar", "quarkus-run.jar"]
