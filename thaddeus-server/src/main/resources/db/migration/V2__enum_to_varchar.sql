-- Replace PostgreSQL custom ENUM types with VARCHAR for Hibernate compatibility.
-- Hibernate maps Java enums as VARCHAR by default; custom PG ENUM types cause
-- "column is of type X but expression is of type character varying" errors.

ALTER TABLE agent ALTER COLUMN status TYPE VARCHAR(50);
ALTER TABLE deployment ALTER COLUMN status TYPE VARCHAR(50);
ALTER TABLE deployment_task ALTER COLUMN status TYPE VARCHAR(50);

DROP TYPE IF EXISTS agent_status;
DROP TYPE IF EXISTS deployment_status;
DROP TYPE IF EXISTS task_status;
