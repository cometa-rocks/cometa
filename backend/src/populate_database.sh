#!/bin/bash
docker exec -it cometa_postgres psql -f /code/src/populate_database.sql postgres postgres
