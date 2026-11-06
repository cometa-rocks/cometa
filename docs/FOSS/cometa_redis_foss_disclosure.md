# Open Source Software (FOSS) Components

# Cometa Redis – FOSS Disclosure

This document lists the Free and Open Source Software (FOSS) components that are part of the
**Cometa Redis** service (`redis:7.2.0`), the cache and queue backend used by Cometa.

It covers Redis 7.2.0 (BSD-licensed), jemalloc, and the Debian base image of the official container.

Full license texts: [LICENSES.md](./LICENSES.md)

### 1. Redis

| Field | Value |
|------|--------|
| **FOSS Component Name** | Redis |
| **Version** | 7.2.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Redis Ltd. |
| **License text** | [See License](./LICENSES.md#redis-7-2-0) |
| **Author's notes** | Redis 7.2.0 remains under BSD-3-Clause; RSALv2/SSPL applies from Redis 7.4 onward. |
| **Source code location** | https://github.com/redis/redis |
| **Source of supply** | https://hub.docker.com/_/redis |
| **Reference date** | – |

---

### 2. jemalloc

| Field | Value |
|------|--------|
| **FOSS Component Name** | jemalloc |
| **Version** | 5.3.0 |
| **FOSS License (exact name)** | BSD-2-Clause |
| **Copyright information** | © Jason Evans |
| **License text** | [See License](./LICENSES.md#jemalloc-5-3-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/jemalloc/jemalloc |
| **Source of supply** | https://hub.docker.com/_/redis |
| **Reference date** | – |

---

### 3. Debian GNU/Linux

| Field | Value |
|------|--------|
| **FOSS Component Name** | Debian GNU/Linux |
| **Version** | 12 (bookworm) |
| **FOSS License (exact name)** | Multiple (Debian copyright) |
| **Copyright information** | © Software in the Public Interest, Inc. and package authors |
| **License text** | [See License](./LICENSES.md#debian-gnu-linux-12-bookworm) |
| **Author's notes** | None |
| **Source code location** | https://www.debian.org/ |
| **Source of supply** | https://hub.docker.com/_/redis |
| **Reference date** | – |

---
