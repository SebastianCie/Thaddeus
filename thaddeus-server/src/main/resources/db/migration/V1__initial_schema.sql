-- Thaddeus initial schema
-- Issues: #1 (agents), #4 (environments), #5 (targets), #6 (packages),
--         #9 (projects), #10 (steps), #11 (variables), #12 (releases),
--         #13 (release_variable), #14 (deployments), #20 (task_log), #24 (audit_log)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────
-- Infrastructure
-- ───────────────────────────────────────────────

CREATE TABLE environment (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color       VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role (
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TYPE agent_status AS ENUM ('ONLINE', 'OFFLINE');

CREATE TABLE agent (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname      VARCHAR(255) NOT NULL UNIQUE,
    ip            VARCHAR(45),
    os_version    VARCHAR(255),
    agent_version VARCHAR(50),
    status        agent_status NOT NULL DEFAULT 'OFFLINE',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_environment (
    agent_id       UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environment(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, environment_id)
);

CREATE TABLE agent_role (
    agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    role_id  UUID NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, role_id)
);

-- ───────────────────────────────────────────────
-- Packages
-- ───────────────────────────────────────────────

CREATE TABLE package (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id  VARCHAR(255) NOT NULL,
    version     VARCHAR(100) NOT NULL,
    filename    VARCHAR(500) NOT NULL,
    path        VARCHAR(1000) NOT NULL,
    size_bytes  BIGINT NOT NULL,
    sha256      VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (package_id, version)
);

CREATE INDEX idx_package_package_id ON package(package_id);

-- ───────────────────────────────────────────────
-- Projects
-- ───────────────────────────────────────────────

CREATE TABLE project (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    package_id  VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deployment_step (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    position   INT NOT NULL,
    type       VARCHAR(100) NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE (project_id, position)
);

CREATE INDEX idx_deployment_step_project ON deployment_step(project_id, position);

CREATE TABLE project_variable (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    value_encrypted TEXT NOT NULL,
    is_secret       BOOLEAN NOT NULL DEFAULT false,
    environment_id  UUID REFERENCES environment(id) ON DELETE SET NULL,
    UNIQUE (project_id, name, environment_id)
);

CREATE INDEX idx_project_variable_project ON project_variable(project_id);

-- ───────────────────────────────────────────────
-- Releases
-- ───────────────────────────────────────────────

CREATE TABLE release (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID NOT NULL REFERENCES project(id),
    version               VARCHAR(50) NOT NULL,
    package_id            VARCHAR(255) NOT NULL,
    package_version       VARCHAR(100) NOT NULL,
    process_snapshot_json TEXT NOT NULL DEFAULT '[]',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, version)
);

CREATE INDEX idx_release_project ON release(project_id, created_at DESC);

CREATE TABLE release_variable (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id     UUID NOT NULL REFERENCES release(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    value_encrypted TEXT NOT NULL,
    is_secret      BOOLEAN NOT NULL DEFAULT false,
    environment_id UUID REFERENCES environment(id) ON DELETE SET NULL
);

CREATE INDEX idx_release_variable_release ON release_variable(release_id);

-- ───────────────────────────────────────────────
-- Deployments & Tasks
-- ───────────────────────────────────────────────

CREATE TYPE deployment_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');
CREATE TYPE task_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

CREATE TABLE deployment (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id     UUID NOT NULL REFERENCES release(id),
    environment_id UUID NOT NULL REFERENCES environment(id),
    status         deployment_status NOT NULL DEFAULT 'PENDING',
    created_by     VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ
);

CREATE INDEX idx_deployment_release ON deployment(release_id);
CREATE INDEX idx_deployment_status ON deployment(status);

CREATE TABLE deployment_task (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployment(id) ON DELETE CASCADE,
    agent_id      UUID NOT NULL REFERENCES agent(id),
    step_position INT NOT NULL,
    step_type     VARCHAR(100) NOT NULL,
    status        task_status NOT NULL DEFAULT 'PENDING',
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ
);

CREATE INDEX idx_deployment_task_deployment ON deployment_task(deployment_id);
CREATE INDEX idx_deployment_task_agent ON deployment_task(agent_id);

CREATE TABLE task_log (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id   UUID NOT NULL REFERENCES deployment_task(id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    level     VARCHAR(10) NOT NULL DEFAULT 'INFO',
    message   TEXT NOT NULL
);

CREATE INDEX idx_task_log_task ON task_log(task_id, logged_at);

-- ───────────────────────────────────────────────
-- Audit
-- ───────────────────────────────────────────────

CREATE TABLE audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id       VARCHAR(255) NOT NULL,
    username      VARCHAR(255),
    action        VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id   VARCHAR(255),
    ip_address    VARCHAR(45),
    details_json  TEXT
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
