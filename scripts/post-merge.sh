#!/bin/bash
set -e
pnpm install --frozen-lockfile
# CAD is browser-local. Database schema changes are an explicit scaffold task,
# never an automatic side effect of merging this repository.
