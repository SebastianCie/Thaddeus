FROM registry.access.redhat.com/ubi9/openjdk-21:1.20 AS build
WORKDIR /build
COPY --chown=185 . .
RUN ./mvnw -pl thaddeus-server -am package -DskipTests -q

FROM registry.access.redhat.com/ubi9/openjdk-21-runtime:1.20
WORKDIR /deployments
COPY --from=build /build/thaddeus-server/target/quarkus-app/lib/ ./lib/
COPY --from=build /build/thaddeus-server/target/quarkus-app/*.jar ./
COPY --from=build /build/thaddeus-server/target/quarkus-app/app/ ./app/
COPY --from=build /build/thaddeus-server/target/quarkus-app/quarkus/ ./quarkus/
EXPOSE 8080
ENV JAVA_OPTS_APPEND="-Dquarkus.http.host=0.0.0.0 -Djava.util.logging.manager=org.jboss.logmanager.LogManager"
CMD ["java", "-jar", "quarkus-run.jar"]
