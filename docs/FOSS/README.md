# Cometa – FOSS Disclosure

Open Source Software (FOSS) disclosure for the Cometa Docker services.

## Documents

| Document | Service |
| --- | --- |
| [cometa_django_foss_disclosure.md](./cometa_django_foss_disclosure.md) | Django API / backend |
| [cometa_behave_foss_disclosure.md](./cometa_behave_foss_disclosure.md) | Behave test execution |
| [cometa_socket_foss_disclosure.md](./cometa_socket_foss_disclosure.md) | Socket.IO / WebSocket server |
| [cometa_front_foss_disclosure.md](./cometa_front_foss_disclosure.md) | Angular frontend (Apache) |
| [cometa_novnc_foss_disclosure.md](./cometa_novnc_foss_disclosure.md) | noVNC remote desktop |
| [cometa_crontab_foss_disclosure.md](./cometa_crontab_foss_disclosure.md) | Crontab helper |
| [cometa_postgres_foss_disclosure.md](./cometa_postgres_foss_disclosure.md) | PostgreSQL |
| [cometa_redis_foss_disclosure.md](./cometa_redis_foss_disclosure.md) | Redis |
| [LICENSES.md](./LICENSES.md) | Full license texts |
| [sha256sums.txt](./sha256sums.txt) | SHA-256 hashes of the annex files |

## Scope

These documents describe the FOSS components of the eight Cometa containers that form a complete
Cometa deployment: Django, Behave, Socket, Front, noVNC, Crontab, PostgreSQL, and Redis.

Each disclosure uses the same field table for every component (name, version, license, copyright,
license text link, notes, source location, source of supply, reference date). License bodies are
collected in `LICENSES.md`.

## Hashes

See [sha256sums.txt](./sha256sums.txt) for SHA-256 hashes of the Markdown annexes. Use those values
when completing the customer FOSS disclosure form (NP.50.70.108).
