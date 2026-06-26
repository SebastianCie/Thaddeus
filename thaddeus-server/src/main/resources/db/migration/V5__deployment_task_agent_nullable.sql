-- Allow deployment tasks to survive agent deletion (keep audit history)
ALTER TABLE deployment_task DROP CONSTRAINT deployment_task_agent_id_fkey;
ALTER TABLE deployment_task ALTER COLUMN agent_id DROP NOT NULL;
ALTER TABLE deployment_task ADD CONSTRAINT deployment_task_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE SET NULL;
