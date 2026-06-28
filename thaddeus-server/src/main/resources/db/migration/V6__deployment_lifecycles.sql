CREATE TABLE deployment_lifecycle (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE lifecycle_phase (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lifecycle_id UUID    NOT NULL REFERENCES deployment_lifecycle(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    position     INT     NOT NULL,
    optional     BOOLEAN NOT NULL DEFAULT false,
    auto_deploy  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE lifecycle_phase_environment (
    phase_id       UUID NOT NULL REFERENCES lifecycle_phase(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environment(id),
    PRIMARY KEY (phase_id, environment_id)
);

ALTER TABLE project ADD COLUMN lifecycle_id UUID REFERENCES deployment_lifecycle(id) ON DELETE SET NULL;
