-- Runs once on first Postgres init (as the superuser POSTGRES_USER).
-- Creates the agent_os database (teamly is POSTGRES_DB) and enables pgvector in
-- both, so the apps' `CREATE EXTENSION IF NOT EXISTS vector` migrations are no-ops.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE DATABASE agent_os;
\connect agent_os
CREATE EXTENSION IF NOT EXISTS vector;
