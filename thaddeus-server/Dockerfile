FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./
COPY .mvn .mvn
COPY mvnw ./
COPY thaddeus-server thaddeus-server
COPY thaddeus-agent/pom.xml thaddeus-agent/pom.xml
RUN --mount=type=cache,target=/root/.m2 mvn -pl thaddeus-server -am package -DskipTests -q

FROM registry.access.redhat.com/ubi9/openjdk-21-runtime:1.20
WORKDIR /deployments
COPY --from=build /build/thaddeus-server/target/quarkus-app/lib/ ./lib/
COPY --from=build /build/thaddeus-server/target/quarkus-app/*.jar ./
COPY --from=build /build/thaddeus-server/target/quarkus-app/app/ ./app/
COPY --from=build /build/thaddeus-server/target/quarkus-app/quarkus/ ./quarkus/
EXPOSE 8080
ENV JAVA_OPTS_APPEND="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
CMD ["java", "-jar", "quarkus-run.jar"]
