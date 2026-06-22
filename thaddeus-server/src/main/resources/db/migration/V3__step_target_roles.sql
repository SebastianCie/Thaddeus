-- Add target_roles to deployment_step.
-- Stores a JSON array of role names (e.g. ["web-server","api-server"]).
-- DeploymentService uses environment + these roles to find matching agents for each step.
ALTER TABLE deployment_step ADD COLUMN target_roles TEXT NOT NULL DEFAULT '[]';
