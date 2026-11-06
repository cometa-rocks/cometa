# Open Source Software (FOSS) Components

# Cometa Behave – FOSS Disclosure

This document lists the Free and Open Source Software (FOSS) components that are part of the
**Cometa Behave** service (`cometa/behave`), the test-execution backend for Cometa.

It covers the Python runtime, the Playwright Node.js driver, the Debian packages required by the
service Dockerfile, and the Python libraries installed for the service.

Microsoft ODBC Driver 18 may be present in the image for database connectivity. It is proprietary
and is not listed here. unixODBC is listed as FOSS.

Full license texts: [LICENSES.md](./LICENSES.md)

### 1. Python

| Field | Value |
|------|--------|
| **FOSS Component Name** | Python |
| **Version** | 3.11.18 |
| **FOSS License (exact name)** | PSF-2.0 |
| **Copyright information** | © Python Software Foundation |
| **License text** | [See License](./LICENSES.md#python-3-11-18) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python/cpython |
| **Source of supply** | https://hub.docker.com/_/python |
| **Reference date** | – |

---

### 2. Node.js

| Field | Value |
|------|--------|
| **FOSS Component Name** | Node.js |
| **Version** | v22.23.4 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Joyent, Inc., Node.js Foundation, OpenJS Foundation, and Node.js contributors |
| **License text** | [See License](./LICENSES.md#node-js-v22-23-4) |
| **Author's notes** | Node.js runtime used by the Playwright driver in this service. |
| **Source code location** | https://github.com/nodejs/node |
| **Source of supply** | https://nodejs.org/dist/ |
| **Reference date** | – |

---

### 3. Debian GNU/Linux

| Field | Value |
|------|--------|
| **FOSS Component Name** | Debian GNU/Linux |
| **Version** | 13 (trixie) |
| **FOSS License (exact name)** | Multiple (Debian copyright) |
| **Copyright information** | © Software in the Public Interest, Inc. and package authors |
| **License text** | [See License](./LICENSES.md#debian-gnu-linux-13-trixie) |
| **Author's notes** | None |
| **Source code location** | https://www.debian.org/ |
| **Source of supply** | https://hub.docker.com/_/python |
| **Reference date** | – |

---

### 4. OpenSSL

| Field | Value |
|------|--------|
| **FOSS Component Name** | OpenSSL |
| **Version** | 3.5.7-1~deb13u3 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © The OpenSSL Project Authors |
| **License text** | [See License](./LICENSES.md#openssl-3-5-7-1-deb13u3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/openssl/openssl |
| **Source of supply** | https://packages.debian.org/trixie/openssl |
| **Reference date** | – |

---

### 5. curl

| Field | Value |
|------|--------|
| **FOSS Component Name** | curl |
| **Version** | 8.14.1-2+deb13u7 |
| **FOSS License (exact name)** | curl |
| **Copyright information** | © Daniel Stenberg |
| **License text** | [See License](./LICENSES.md#curl-8-14-1-2-deb13u7) |
| **Author's notes** | None |
| **Source code location** | https://github.com/curl/curl |
| **Source of supply** | https://packages.debian.org/trixie/curl |
| **Reference date** | – |

---

### 6. jq

| Field | Value |
|------|--------|
| **FOSS Component Name** | jq |
| **Version** | 1.7.1-6+deb13u4 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Stephen Dolan |
| **License text** | [See License](./LICENSES.md#jq-1-7-1-6-deb13u4) |
| **Author's notes** | None |
| **Source code location** | https://github.com/jqlang/jq |
| **Source of supply** | https://packages.debian.org/trixie/jq |
| **Reference date** | – |

---

### 7. rsyslog

| Field | Value |
|------|--------|
| **FOSS Component Name** | rsyslog |
| **Version** | 8.2504.0-1+deb13u2 |
| **FOSS License (exact name)** | GPL-3.0-only |
| **Copyright information** | © Rainer Gerhards and Adiscon GmbH |
| **License text** | [See License](./LICENSES.md#rsyslog-8-2504-0-1-deb13u2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/rsyslog/rsyslog |
| **Source of supply** | https://packages.debian.org/trixie/rsyslog |
| **Reference date** | – |

---

### 8. supervisor

| Field | Value |
|------|--------|
| **FOSS Component Name** | supervisor |
| **Version** | 4.2.5-3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Agendaless Consulting and Contributors |
| **License text** | [See License](./LICENSES.md#supervisor-4-2-5-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Supervisor/supervisor |
| **Source of supply** | https://packages.debian.org/trixie/supervisor |
| **Reference date** | – |

---

### 9. unixODBC

| Field | Value |
|------|--------|
| **FOSS Component Name** | unixODBC |
| **Version** | 2.3.12-2+deb13u1 |
| **FOSS License (exact name)** | LGPL-2.1-only |
| **Copyright information** | © Peter Harvey and unixODBC contributors |
| **License text** | [See License](./LICENSES.md#unixodbc-2-3-12-2-deb13u1) |
| **Author's notes** | Accompanying FOSS ODBC stack; Microsoft ODBC Driver 18 itself is proprietary and is not listed as FOSS. |
| **Source code location** | https://github.com/lurcher/unixODBC |
| **Source of supply** | https://packages.debian.org/trixie/unixodbc |
| **Reference date** | – |

---

### 10. Mesa libgl1

| Field | Value |
|------|--------|
| **FOSS Component Name** | Mesa libgl1 |
| **Version** | 1.7.0-1+b2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Mesa authors |
| **License text** | [See License](./LICENSES.md#mesa-libgl1-1-7-0-1-b2) |
| **Author's notes** | None |
| **Source code location** | https://gitlab.freedesktop.org/mesa/mesa |
| **Source of supply** | https://packages.debian.org/trixie/libgl1 |
| **Reference date** | – |

---

### 11. GnuPG

| Field | Value |
|------|--------|
| **FOSS Component Name** | GnuPG |
| **Version** | 2.4.7-21+deb13u1 |
| **FOSS License (exact name)** | GPL-3.0-only |
| **Copyright information** | © Free Software Foundation |
| **License text** | [See License](./LICENSES.md#gnupg-2-4-7-21-deb13u1) |
| **Author's notes** | None |
| **Source code location** | https://gnupg.org/ |
| **Source of supply** | https://packages.debian.org/trixie/gnupg2 |
| **Reference date** | – |

---

### 12. aiofiles

| Field | Value |
|------|--------|
| **FOSS Component Name** | aiofiles |
| **Version** | 24.1.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © aiofiles contributors |
| **License text** | [See License](./LICENSES.md#aiofiles-24-1-0) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/aiofiles/ |
| **Source of supply** | https://pypi.org/project/aiofiles/24.1.0/ |
| **Reference date** | – |

---

### 13. aiohappyeyeballs

| Field | Value |
|------|--------|
| **FOSS Component Name** | aiohappyeyeballs |
| **Version** | 2.6.1 |
| **FOSS License (exact name)** | PSF-2.0 |
| **Copyright information** | © J. Nick Koston |
| **License text** | [See License](./LICENSES.md#aiohappyeyeballs-2-6-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/aio-libs/aiohappyeyeballs |
| **Source of supply** | https://pypi.org/project/aiohappyeyeballs/2.6.1/ |
| **Reference date** | – |

---

### 14. aiohttp

| Field | Value |
|------|--------|
| **FOSS Component Name** | aiohttp |
| **Version** | 3.12.15 |
| **FOSS License (exact name)** | Apache-2.0 AND MIT |
| **Copyright information** | © aiohttp team <team@aiohttp.org> |
| **License text** | [See License](./LICENSES.md#aiohttp-3-12-15) |
| **Author's notes** | None |
| **Source code location** | https://github.com/aio-libs/aiohttp |
| **Source of supply** | https://pypi.org/project/aiohttp/3.12.15/ |
| **Reference date** | – |

---

### 15. aiosignal

| Field | Value |
|------|--------|
| **FOSS Component Name** | aiosignal |
| **Version** | 1.4.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © aiohttp team <team@aiohttp.org> |
| **License text** | [See License](./LICENSES.md#aiosignal-1-4-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/aio-libs/aiosignal |
| **Source of supply** | https://pypi.org/project/aiosignal/1.4.0/ |
| **Reference date** | – |

---

### 16. annotated-types

| Field | Value |
|------|--------|
| **FOSS Component Name** | annotated-types |
| **Version** | 0.7.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © annotated-types contributors |
| **License text** | [See License](./LICENSES.md#annotated-types-0-7-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/annotated-types/annotated-types |
| **Source of supply** | https://pypi.org/project/annotated-types/0.7.0/ |
| **Reference date** | – |

---

### 17. anthropic

| Field | Value |
|------|--------|
| **FOSS Component Name** | anthropic |
| **Version** | 0.67.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © anthropic contributors |
| **License text** | [See License](./LICENSES.md#anthropic-0-67-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/anthropics/anthropic-sdk-python |
| **Source of supply** | https://pypi.org/project/anthropic/0.67.0/ |
| **Reference date** | – |

---

### 18. anyio

| Field | Value |
|------|--------|
| **FOSS Component Name** | anyio |
| **Version** | 4.9.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © anyio contributors |
| **License text** | [See License](./LICENSES.md#anyio-4-9-0) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/anyio/ |
| **Source of supply** | https://pypi.org/project/anyio/4.9.0/ |
| **Reference date** | – |

---

### 19. Appium-Python-Client

| Field | Value |
|------|--------|
| **FOSS Component Name** | Appium-Python-Client |
| **Version** | 4.2.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Isaac Murchie |
| **License text** | [See License](./LICENSES.md#appium-python-client-4-2-1) |
| **Author's notes** | None |
| **Source code location** | http://appium.io/ |
| **Source of supply** | https://pypi.org/project/Appium-Python-Client/4.2.1/ |
| **Reference date** | – |

---

### 20. arrow

| Field | Value |
|------|--------|
| **FOSS Component Name** | arrow |
| **Version** | 1.2.3 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Chris Smith |
| **License text** | [See License](./LICENSES.md#arrow-1-2-3) |
| **Author's notes** | None |
| **Source code location** | https://arrow.readthedocs.io |
| **Source of supply** | https://pypi.org/project/arrow/1.2.3/ |
| **Reference date** | – |

---

### 21. asgiref

| Field | Value |
|------|--------|
| **FOSS Component Name** | asgiref |
| **Version** | 3.7.2 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Django Software Foundation |
| **License text** | [See License](./LICENSES.md#asgiref-3-7-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/django/asgiref/ |
| **Source of supply** | https://pypi.org/project/asgiref/3.7.2/ |
| **Reference date** | – |

---

### 22. attrs

| Field | Value |
|------|--------|
| **FOSS Component Name** | attrs |
| **Version** | 23.2.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © attrs contributors |
| **License text** | [See License](./LICENSES.md#attrs-23-2-0) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/attrs/ |
| **Source of supply** | https://pypi.org/project/attrs/23.2.0/ |
| **Reference date** | – |

---

### 23. Authlib

| Field | Value |
|------|--------|
| **FOSS Component Name** | Authlib |
| **Version** | 1.6.3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Authlib contributors |
| **License text** | [See License](./LICENSES.md#authlib-1-6-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/authlib/authlib |
| **Source of supply** | https://pypi.org/project/Authlib/1.6.3/ |
| **Reference date** | – |

---

### 24. awesome-slugify

| Field | Value |
|------|--------|
| **FOSS Component Name** | awesome-slugify |
| **Version** | 1.6.5 |
| **FOSS License (exact name)** | GPL-3.0-only |
| **Copyright information** | © Dmitry Voronin |
| **License text** | [See License](./LICENSES.md#awesome-slugify-1-6-5) |
| **Author's notes** | None |
| **Source code location** | https://github.com/dimka665/awesome-slugify |
| **Source of supply** | https://pypi.org/project/awesome-slugify/1.6.5/ |
| **Reference date** | – |

---

### 25. backoff

| Field | Value |
|------|--------|
| **FOSS Component Name** | backoff |
| **Version** | 2.2.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Bob Green |
| **License text** | [See License](./LICENSES.md#backoff-2-2-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/litl/backoff |
| **Source of supply** | https://pypi.org/project/backoff/2.2.1/ |
| **Reference date** | – |

---

### 26. beautifulsoup4

| Field | Value |
|------|--------|
| **FOSS Component Name** | beautifulsoup4 |
| **Version** | 4.12.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © beautifulsoup4 contributors |
| **License text** | [See License](./LICENSES.md#beautifulsoup4-4-12-2) |
| **Author's notes** | None |
| **Source code location** | https://www.crummy.com/software/BeautifulSoup/bs4/ |
| **Source of supply** | https://pypi.org/project/beautifulsoup4/4.12.2/ |
| **Reference date** | – |

---

### 27. behave

| Field | Value |
|------|--------|
| **FOSS Component Name** | behave |
| **Version** | 1.2.6 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Jens Engel, Benno Rice and Richard Jones |
| **License text** | [See License](./LICENSES.md#behave-1-2-6) |
| **Author's notes** | None |
| **Source code location** | http://github.com/behave/behave |
| **Source of supply** | https://pypi.org/project/behave/1.2.6/ |
| **Reference date** | – |

---

### 28. browser-use

| Field | Value |
|------|--------|
| **FOSS Component Name** | browser-use |
| **Version** | 0.7.7 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Gregor Zunic |
| **License text** | [See License](./LICENSES.md#browser-use-0-7-7) |
| **Author's notes** | None |
| **Source code location** | https://github.com/browser-use/browser-use |
| **Source of supply** | https://pypi.org/project/browser-use/0.7.7/ |
| **Reference date** | – |

---

### 29. bs4

| Field | Value |
|------|--------|
| **FOSS Component Name** | bs4 |
| **Version** | 0.0.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © bs4 contributors |
| **License text** | [See License](./LICENSES.md#bs4-0-0-2) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/bs4/ |
| **Source of supply** | https://pypi.org/project/bs4/0.0.2/ |
| **Reference date** | – |

---

### 30. bubus

| Field | Value |
|------|--------|
| **FOSS Component Name** | bubus |
| **Version** | 1.5.6 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Nick Sweeting |
| **License text** | [See License](./LICENSES.md#bubus-1-5-6) |
| **Author's notes** | None |
| **Source code location** | https://github.com/browser-use/bubus |
| **Source of supply** | https://pypi.org/project/bubus/1.5.6/ |
| **Reference date** | – |

---

### 31. cachetools

| Field | Value |
|------|--------|
| **FOSS Component Name** | cachetools |
| **Version** | 5.5.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Thomas Kemmer |
| **License text** | [See License](./LICENSES.md#cachetools-5-5-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/tkem/cachetools/ |
| **Source of supply** | https://pypi.org/project/cachetools/5.5.1/ |
| **Reference date** | – |

---

### 32. cdp-use

| Field | Value |
|------|--------|
| **FOSS Component Name** | cdp-use |
| **Version** | 1.4.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © cdp-use contributors |
| **License text** | [See License](./LICENSES.md#cdp-use-1-4-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/browser-use/cdp-use |
| **Source of supply** | https://pypi.org/project/cdp-use/1.4.0/ |
| **Reference date** | – |

---

### 33. certifi

| Field | Value |
|------|--------|
| **FOSS Component Name** | certifi |
| **Version** | 2024.2.2 |
| **FOSS License (exact name)** | MPL-2.0 |
| **Copyright information** | © Kenneth Reitz |
| **License text** | [See License](./LICENSES.md#certifi-2024-2-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/certifi/python-certifi |
| **Source of supply** | https://pypi.org/project/certifi/2024.2.2/ |
| **Reference date** | – |

---

### 34. cffi

| Field | Value |
|------|--------|
| **FOSS Component Name** | cffi |
| **Version** | 1.16.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Armin Rigo, Maciej Fijalkowski |
| **License text** | [See License](./LICENSES.md#cffi-1-16-0) |
| **Author's notes** | None |
| **Source code location** | http://cffi.readthedocs.org |
| **Source of supply** | https://pypi.org/project/cffi/1.16.0/ |
| **Reference date** | – |

---

### 35. charset-normalizer

| Field | Value |
|------|--------|
| **FOSS Component Name** | charset-normalizer |
| **Version** | 3.3.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Ahmed TAHRI |
| **License text** | [See License](./LICENSES.md#charset-normalizer-3-3-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Ousret/charset_normalizer |
| **Source of supply** | https://pypi.org/project/charset-normalizer/3.3.2/ |
| **Reference date** | – |

---

### 36. click

| Field | Value |
|------|--------|
| **FOSS Component Name** | click |
| **Version** | 8.1.8 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © click contributors |
| **License text** | [See License](./LICENSES.md#click-8-1-8) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pallets/click/ |
| **Source of supply** | https://pypi.org/project/click/8.1.8/ |
| **Reference date** | – |

---

### 37. coreapi

| Field | Value |
|------|--------|
| **FOSS Component Name** | coreapi |
| **Version** | 2.3.3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Tom Christie |
| **License text** | [See License](./LICENSES.md#coreapi-2-3-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/core-api/python-client |
| **Source of supply** | https://pypi.org/project/coreapi/2.3.3/ |
| **Reference date** | – |

---

### 38. coreschema

| Field | Value |
|------|--------|
| **FOSS Component Name** | coreschema |
| **Version** | 0.0.4 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Tom Christie |
| **License text** | [See License](./LICENSES.md#coreschema-0-0-4) |
| **Author's notes** | None |
| **Source code location** | https://github.com/core-api/python-coreschema |
| **Source of supply** | https://pypi.org/project/coreschema/0.0.4/ |
| **Reference date** | – |

---

### 39. cryptography

| Field | Value |
|------|--------|
| **FOSS Component Name** | cryptography |
| **Version** | 44.0.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © The cryptography developers <cryptography-dev@python.org> |
| **License text** | [See License](./LICENSES.md#cryptography-44-0-0) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/cryptography/ |
| **Source of supply** | https://pypi.org/project/cryptography/44.0.0/ |
| **Reference date** | – |

---

### 40. cx_Oracle

| Field | Value |
|------|--------|
| **FOSS Component Name** | cx_Oracle |
| **Version** | 8.3.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © "Anthony Tuininga", |
| **License text** | [See License](./LICENSES.md#cx-oracle-8-3-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/oracle/python-cx_Oracle |
| **Source of supply** | https://pypi.org/project/cx_Oracle/8.3.0/ |
| **Reference date** | – |

---

### 41. distro

| Field | Value |
|------|--------|
| **FOSS Component Name** | distro |
| **Version** | 1.9.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Nir Cohen |
| **License text** | [See License](./LICENSES.md#distro-1-9-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-distro/distro |
| **Source of supply** | https://pypi.org/project/distro/1.9.0/ |
| **Reference date** | – |

---

### 42. Django

| Field | Value |
|------|--------|
| **FOSS Component Name** | Django |
| **Version** | 3.2.25 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Django Software Foundation |
| **License text** | [See License](./LICENSES.md#django-3-2-25) |
| **Author's notes** | None |
| **Source code location** | https://github.com/django/django |
| **Source of supply** | https://pypi.org/project/Django/3.2.25/ |
| **Reference date** | – |

---

### 43. django-filter

| Field | Value |
|------|--------|
| **FOSS Component Name** | django-filter |
| **Version** | 2.4.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Alex Gaynor |
| **License text** | [See License](./LICENSES.md#django-filter-2-4-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/carltongibson/django-filter/tree/master |
| **Source of supply** | https://pypi.org/project/django-filter/2.4.0/ |
| **Reference date** | – |

---

### 44. django-rq

| Field | Value |
|------|--------|
| **FOSS Component Name** | django-rq |
| **Version** | 2.8.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Selwin Ong |
| **License text** | [See License](./LICENSES.md#django-rq-2-8-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/rq/django-rq |
| **Source of supply** | https://pypi.org/project/django-rq/2.8.1/ |
| **Reference date** | – |

---

### 45. djangorestframework

| Field | Value |
|------|--------|
| **FOSS Component Name** | djangorestframework |
| **Version** | 3.14.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Tom Christie |
| **License text** | [See License](./LICENSES.md#djangorestframework-3-14-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/encode/django-rest-framework |
| **Source of supply** | https://pypi.org/project/djangorestframework/3.14.0/ |
| **Reference date** | – |

---

### 46. dnspython

| Field | Value |
|------|--------|
| **FOSS Component Name** | dnspython |
| **Version** | 2.6.1 |
| **FOSS License (exact name)** | ISC |
| **Copyright information** | © dnspython contributors |
| **License text** | [See License](./LICENSES.md#dnspython-2-6-1) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/dnspython/ |
| **Source of supply** | https://pypi.org/project/dnspython/2.6.1/ |
| **Reference date** | – |

---

### 47. docker

| Field | Value |
|------|--------|
| **FOSS Component Name** | docker |
| **Version** | 7.1.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © docker contributors |
| **License text** | [See License](./LICENSES.md#docker-7-1-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/docker/docker-py |
| **Source of supply** | https://pypi.org/project/docker/7.1.0/ |
| **Reference date** | – |

---

### 48. durationpy

| Field | Value |
|------|--------|
| **FOSS Component Name** | durationpy |
| **Version** | 0.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Ilia Choly |
| **License text** | [See License](./LICENSES.md#durationpy-0-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/icholy/durationpy |
| **Source of supply** | https://pypi.org/project/durationpy/0.9/ |
| **Reference date** | – |

---

### 49. et-xmlfile

| Field | Value |
|------|--------|
| **FOSS Component Name** | et-xmlfile |
| **Version** | 1.1.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © See ATUHORS.txt |
| **License text** | [See License](./LICENSES.md#et-xmlfile-1-1-0) |
| **Author's notes** | None |
| **Source code location** | https://foss.heptapod.net/openpyxl/et_xmlfile |
| **Source of supply** | https://pypi.org/project/et-xmlfile/1.1.0/ |
| **Reference date** | – |

---

### 50. Faker

| Field | Value |
|------|--------|
| **FOSS Component Name** | Faker |
| **Version** | 37.0.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © joke2k |
| **License text** | [See License](./LICENSES.md#faker-37-0-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/joke2k/faker |
| **Source of supply** | https://pypi.org/project/Faker/37.0.2/ |
| **Reference date** | – |

---

### 51. frozenlist

| Field | Value |
|------|--------|
| **FOSS Component Name** | frozenlist |
| **Version** | 1.7.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © aiohttp team <team@aiohttp.org> |
| **License text** | [See License](./LICENSES.md#frozenlist-1-7-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/aio-libs/frozenlist |
| **Source of supply** | https://pypi.org/project/frozenlist/1.7.0/ |
| **Reference date** | – |

---

### 52. google-api-core

| Field | Value |
|------|--------|
| **FOSS Component Name** | google-api-core |
| **Version** | 2.25.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © google-api-core contributors |
| **License text** | [See License](./LICENSES.md#google-api-core-2-25-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/googleapis/python-api-core |
| **Source of supply** | https://pypi.org/project/google-api-core/2.25.1/ |
| **Reference date** | – |

---

### 53. google-api-python-client

| Field | Value |
|------|--------|
| **FOSS Component Name** | google-api-python-client |
| **Version** | 2.181.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Google LLC |
| **License text** | [See License](./LICENSES.md#google-api-python-client-2-181-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/googleapis/google-api-python-client/ |
| **Source of supply** | https://pypi.org/project/google-api-python-client/2.181.0/ |
| **Reference date** | – |

---

### 54. google-auth

| Field | Value |
|------|--------|
| **FOSS Component Name** | google-auth |
| **Version** | 2.40.3 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Google Cloud Platform |
| **License text** | [See License](./LICENSES.md#google-auth-2-40-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/googleapis/google-auth-library-python |
| **Source of supply** | https://pypi.org/project/google-auth/2.40.3/ |
| **Reference date** | – |

---

### 55. google-auth-httplib2

| Field | Value |
|------|--------|
| **FOSS Component Name** | google-auth-httplib2 |
| **Version** | 0.2.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Google Cloud Platform |
| **License text** | [See License](./LICENSES.md#google-auth-httplib2-0-2-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/GoogleCloudPlatform/google-auth-library-python-httplib2 |
| **Source of supply** | https://pypi.org/project/google-auth-httplib2/0.2.0/ |
| **Reference date** | – |

---

### 56. google-auth-oauthlib

| Field | Value |
|------|--------|
| **FOSS Component Name** | google-auth-oauthlib |
| **Version** | 1.2.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Google Cloud Platform |
| **License text** | [See License](./LICENSES.md#google-auth-oauthlib-1-2-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/GoogleCloudPlatform/google-auth-library-python-oauthlib |
| **Source of supply** | https://pypi.org/project/google-auth-oauthlib/1.2.2/ |
| **Reference date** | – |

---

### 57. google-genai

| Field | Value |
|------|--------|
| **FOSS Component Name** | google-genai |
| **Version** | 1.36.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © google-genai contributors |
| **License text** | [See License](./LICENSES.md#google-genai-1-36-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/googleapis/python-genai |
| **Source of supply** | https://pypi.org/project/google-genai/1.36.0/ |
| **Reference date** | – |

---

### 58. googleapis-common-protos

| Field | Value |
|------|--------|
| **FOSS Component Name** | googleapis-common-protos |
| **Version** | 1.70.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © googleapis-common-protos contributors |
| **License text** | [See License](./LICENSES.md#googleapis-common-protos-1-70-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/googleapis/google-cloud-python/tree/main/packages/googleapis-common-protos |
| **Source of supply** | https://pypi.org/project/googleapis-common-protos/1.70.0/ |
| **Reference date** | – |

---

### 59. greenlet

| Field | Value |
|------|--------|
| **FOSS Component Name** | greenlet |
| **Version** | 3.1.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Alexey Borzenkov |
| **License text** | [See License](./LICENSES.md#greenlet-3-1-1) |
| **Author's notes** | None |
| **Source code location** | https://greenlet.readthedocs.io/ |
| **Source of supply** | https://pypi.org/project/greenlet/3.1.1/ |
| **Reference date** | – |

---

### 60. groq

| Field | Value |
|------|--------|
| **FOSS Component Name** | groq |
| **Version** | 0.31.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © groq contributors |
| **License text** | [See License](./LICENSES.md#groq-0-31-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/groq/groq-python |
| **Source of supply** | https://pypi.org/project/groq/0.31.1/ |
| **Reference date** | – |

---

### 61. gunicorn

| Field | Value |
|------|--------|
| **FOSS Component Name** | gunicorn |
| **Version** | 20.1.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Benoit Chesneau |
| **License text** | [See License](./LICENSES.md#gunicorn-20-1-0) |
| **Author's notes** | None |
| **Source code location** | https://gunicorn.org |
| **Source of supply** | https://pypi.org/project/gunicorn/20.1.0/ |
| **Reference date** | – |

---

### 62. h11

| Field | Value |
|------|--------|
| **FOSS Component Name** | h11 |
| **Version** | 0.16.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Nathaniel J. Smith |
| **License text** | [See License](./LICENSES.md#h11-0-16-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-hyper/h11 |
| **Source of supply** | https://pypi.org/project/h11/0.16.0/ |
| **Reference date** | – |

---

### 63. html-diff

| Field | Value |
|------|--------|
| **FOSS Component Name** | html-diff |
| **Version** | 0.3.0 |
| **FOSS License (exact name)** | AGPL-3.0-or-later |
| **Copyright information** | © Quentin Wenger |
| **License text** | [See License](./LICENSES.md#html-diff-0-3-0) |
| **Author's notes** | None |
| **Source code location** | https://gitlab.com/matpi/html-diff |
| **Source of supply** | https://pypi.org/project/html-diff/0.3.0/ |
| **Reference date** | – |

---

### 64. html2text

| Field | Value |
|------|--------|
| **FOSS Component Name** | html2text |
| **Version** | 2025.4.15 |
| **FOSS License (exact name)** | GPL-3.0-or-later |
| **Copyright information** | © html2text contributors |
| **License text** | [See License](./LICENSES.md#html2text-2025-4-15) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Alir3z4/html2text/ |
| **Source of supply** | https://pypi.org/project/html2text/2025.4.15/ |
| **Reference date** | – |

---

### 65. httpcore

| Field | Value |
|------|--------|
| **FOSS Component Name** | httpcore |
| **Version** | 1.0.9 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © httpcore contributors |
| **License text** | [See License](./LICENSES.md#httpcore-1-0-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/encode/httpcore |
| **Source of supply** | https://pypi.org/project/httpcore/1.0.9/ |
| **Reference date** | – |

---

### 66. httplib2

| Field | Value |
|------|--------|
| **FOSS Component Name** | httplib2 |
| **Version** | 0.31.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Joe Gregorio |
| **License text** | [See License](./LICENSES.md#httplib2-0-31-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/httplib2/httplib2 |
| **Source of supply** | https://pypi.org/project/httplib2/0.31.0/ |
| **Reference date** | – |

---

### 67. httpx

| Field | Value |
|------|--------|
| **FOSS Component Name** | httpx |
| **Version** | 0.28.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © httpx contributors |
| **License text** | [See License](./LICENSES.md#httpx-0-28-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/encode/httpx |
| **Source of supply** | https://pypi.org/project/httpx/0.28.1/ |
| **Reference date** | – |

---

### 68. httpx-sse

| Field | Value |
|------|--------|
| **FOSS Component Name** | httpx-sse |
| **Version** | 0.4.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © httpx-sse contributors |
| **License text** | [See License](./LICENSES.md#httpx-sse-0-4-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/florimondmanca/httpx-sse |
| **Source of supply** | https://pypi.org/project/httpx-sse/0.4.1/ |
| **Reference date** | – |

---

### 69. ibm_db

| Field | Value |
|------|--------|
| **FOSS Component Name** | ibm_db |
| **Version** | 3.2.5 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © IBM Application Development Team |
| **License text** | [See License](./LICENSES.md#ibm-db-3-2-5) |
| **Author's notes** | None |
| **Source code location** | http://pypi.python.org/pypi/ibm_db/ |
| **Source of supply** | https://pypi.org/project/ibm_db/3.2.5/ |
| **Reference date** | – |

---

### 70. ibm_db_sa

| Field | Value |
|------|--------|
| **FOSS Component Name** | ibm_db_sa |
| **Version** | 0.4.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © IBM Application Development Team |
| **License text** | [See License](./LICENSES.md#ibm-db-sa-0-4-1) |
| **Author's notes** | None |
| **Source code location** | http://pypi.python.org/pypi/ibm_db_sa/ |
| **Source of supply** | https://pypi.org/project/ibm_db_sa/0.4.1/ |
| **Reference date** | – |

---

### 71. idna

| Field | Value |
|------|--------|
| **FOSS Component Name** | idna |
| **Version** | 2.10 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Kim Davies |
| **License text** | [See License](./LICENSES.md#idna-2-10) |
| **Author's notes** | None |
| **Source code location** | https://github.com/kjd/idna |
| **Source of supply** | https://pypi.org/project/idna/2.10/ |
| **Reference date** | – |

---

### 72. itypes

| Field | Value |
|------|--------|
| **FOSS Component Name** | itypes |
| **Version** | 1.2.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Tom Christie |
| **License text** | [See License](./LICENSES.md#itypes-1-2-0) |
| **Author's notes** | None |
| **Source code location** | http://github.com/PavanTatikonda/itypes |
| **Source of supply** | https://pypi.org/project/itypes/1.2.0/ |
| **Reference date** | – |

---

### 73. Jinja2

| Field | Value |
|------|--------|
| **FOSS Component Name** | Jinja2 |
| **Version** | 3.1.3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Pallets |
| **License text** | [See License](./LICENSES.md#jinja2-3-1-3) |
| **Author's notes** | None |
| **Source code location** | https://palletsprojects.com/p/jinja/ |
| **Source of supply** | https://pypi.org/project/Jinja2/3.1.3/ |
| **Reference date** | – |

---

### 74. jiter

| Field | Value |
|------|--------|
| **FOSS Component Name** | jiter |
| **Version** | 0.9.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Samuel Colvin <samuel@pydantic.dev> |
| **License text** | [See License](./LICENSES.md#jiter-0-9-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pydantic/jiter/ |
| **Source of supply** | https://pypi.org/project/jiter/0.9.0/ |
| **Reference date** | – |

---

### 75. jq

| Field | Value |
|------|--------|
| **FOSS Component Name** | jq |
| **Version** | 1.6.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Michael Williamson |
| **License text** | [See License](./LICENSES.md#jq-1-6-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/mwilliamson/jq.py |
| **Source of supply** | https://pypi.org/project/jq/1.6.0/ |
| **Reference date** | – |

---

### 76. jsonschema

| Field | Value |
|------|--------|
| **FOSS Component Name** | jsonschema |
| **Version** | 4.25.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © jsonschema contributors |
| **License text** | [See License](./LICENSES.md#jsonschema-4-25-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-jsonschema/jsonschema |
| **Source of supply** | https://pypi.org/project/jsonschema/4.25.1/ |
| **Reference date** | – |

---

### 77. jsonschema-specifications

| Field | Value |
|------|--------|
| **FOSS Component Name** | jsonschema-specifications |
| **Version** | 2025.9.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © jsonschema-specifications contributors |
| **License text** | [See License](./LICENSES.md#jsonschema-specifications-2025-9-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-jsonschema/jsonschema-specifications |
| **Source of supply** | https://pypi.org/project/jsonschema-specifications/2025.9.1/ |
| **Reference date** | – |

---

### 78. kubernetes

| Field | Value |
|------|--------|
| **FOSS Component Name** | kubernetes |
| **Version** | 31.0.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Kubernetes |
| **License text** | [See License](./LICENSES.md#kubernetes-31-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/kubernetes-client/python |
| **Source of supply** | https://pypi.org/project/kubernetes/31.0.0/ |
| **Reference date** | – |

---

### 79. MarkupSafe

| Field | Value |
|------|--------|
| **FOSS Component Name** | MarkupSafe |
| **Version** | 2.1.3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Pallets |
| **License text** | [See License](./LICENSES.md#markupsafe-2-1-3) |
| **Author's notes** | None |
| **Source code location** | https://palletsprojects.com/p/markupsafe/ |
| **Source of supply** | https://pypi.org/project/MarkupSafe/2.1.3/ |
| **Reference date** | – |

---

### 80. mcp

| Field | Value |
|------|--------|
| **FOSS Component Name** | mcp |
| **Version** | 1.10.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Anthropic, PBC. |
| **License text** | [See License](./LICENSES.md#mcp-1-10-1) |
| **Author's notes** | None |
| **Source code location** | https://modelcontextprotocol.io |
| **Source of supply** | https://pypi.org/project/mcp/1.10.1/ |
| **Reference date** | – |

---

### 81. monotonic

| Field | Value |
|------|--------|
| **FOSS Component Name** | monotonic |
| **Version** | 1.6 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Ori Livneh |
| **License text** | [See License](./LICENSES.md#monotonic-1-6) |
| **Author's notes** | None |
| **Source code location** | https://github.com/atdt/monotonic |
| **Source of supply** | https://pypi.org/project/monotonic/1.6/ |
| **Reference date** | – |

---

### 82. multidict

| Field | Value |
|------|--------|
| **FOSS Component Name** | multidict |
| **Version** | 6.6.4 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Andrew Svetlov |
| **License text** | [See License](./LICENSES.md#multidict-6-6-4) |
| **Author's notes** | None |
| **Source code location** | https://github.com/aio-libs/multidict |
| **Source of supply** | https://pypi.org/project/multidict/6.6.4/ |
| **Reference date** | – |

---

### 83. mysql-connector-python

| Field | Value |
|------|--------|
| **FOSS Component Name** | mysql-connector-python |
| **Version** | 8.4.0 |
| **FOSS License (exact name)** | GPL-2.0-only WITH MySQL-FOSS-exception |
| **Copyright information** | © Oracle and/or its affiliates |
| **License text** | [See License](./LICENSES.md#mysql-connector-python-8-4-0) |
| **Author's notes** | None |
| **Source code location** | http://dev.mysql.com/doc/connector-python/en/index.html |
| **Source of supply** | https://pypi.org/project/mysql-connector-python/8.4.0/ |
| **Reference date** | – |

---

### 84. mysqlclient

| Field | Value |
|------|--------|
| **FOSS Component Name** | mysqlclient |
| **Version** | 2.2.7 |
| **FOSS License (exact name)** | GPL-2.0-or-later |
| **Copyright information** | © mysqlclient contributors |
| **License text** | [See License](./LICENSES.md#mysqlclient-2-2-7) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/mysqlclient/ |
| **Source of supply** | https://pypi.org/project/mysqlclient/2.2.7/ |
| **Reference date** | – |

---

### 85. nest-asyncio

| Field | Value |
|------|--------|
| **FOSS Component Name** | nest-asyncio |
| **Version** | 1.6.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Ewald R. de Wit |
| **License text** | [See License](./LICENSES.md#nest-asyncio-1-6-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/erdewit/nest_asyncio |
| **Source of supply** | https://pypi.org/project/nest-asyncio/1.6.0/ |
| **Reference date** | – |

---

### 86. numpy

| Field | Value |
|------|--------|
| **FOSS Component Name** | numpy |
| **Version** | 2.2.5 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Travis E. Oliphant et al. |
| **License text** | [See License](./LICENSES.md#numpy-2-2-5) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/numpy/ |
| **Source of supply** | https://pypi.org/project/numpy/2.2.5/ |
| **Reference date** | – |

---

### 87. oauthlib

| Field | Value |
|------|--------|
| **FOSS Component Name** | oauthlib |
| **Version** | 3.2.2 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © The OAuthlib Community |
| **License text** | [See License](./LICENSES.md#oauthlib-3-2-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/oauthlib/oauthlib |
| **Source of supply** | https://pypi.org/project/oauthlib/3.2.2/ |
| **Reference date** | – |

---

### 88. ollama

| Field | Value |
|------|--------|
| **FOSS Component Name** | ollama |
| **Version** | 0.5.3 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © ollama contributors |
| **License text** | [See License](./LICENSES.md#ollama-0-5-3) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/ollama/ |
| **Source of supply** | https://pypi.org/project/ollama/0.5.3/ |
| **Reference date** | – |

---

### 89. openai

| Field | Value |
|------|--------|
| **FOSS Component Name** | openai |
| **Version** | 1.107.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © openai contributors |
| **License text** | [See License](./LICENSES.md#openai-1-107-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/openai/openai-python |
| **Source of supply** | https://pypi.org/project/openai/1.107.1/ |
| **Reference date** | – |

---

### 90. opencv-python

| Field | Value |
|------|--------|
| **FOSS Component Name** | opencv-python |
| **Version** | 4.11.0.86 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © OpenCV Team |
| **License text** | [See License](./LICENSES.md#opencv-python-4-11-0-86) |
| **Author's notes** | None |
| **Source code location** | https://github.com/opencv/opencv-python |
| **Source of supply** | https://pypi.org/project/opencv-python/4.11.0.86/ |
| **Reference date** | – |

---

### 91. openpyxl

| Field | Value |
|------|--------|
| **FOSS Component Name** | openpyxl |
| **Version** | 3.1.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © See AUTHORS |
| **License text** | [See License](./LICENSES.md#openpyxl-3-1-2) |
| **Author's notes** | None |
| **Source code location** | https://foss.heptapod.net/openpyxl/openpyxl |
| **Source of supply** | https://pypi.org/project/openpyxl/3.1.2/ |
| **Reference date** | – |

---

### 92. orjson

| Field | Value |
|------|--------|
| **FOSS Component Name** | orjson |
| **Version** | 3.10.15 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © ijl <ijl@mailbox.org> |
| **License text** | [See License](./LICENSES.md#orjson-3-10-15) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/orjson/ |
| **Source of supply** | https://pypi.org/project/orjson/3.10.15/ |
| **Reference date** | – |

---

### 93. outcome

| Field | Value |
|------|--------|
| **FOSS Component Name** | outcome |
| **Version** | 1.3.0.post0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Frazer McLean |
| **License text** | [See License](./LICENSES.md#outcome-1-3-0-post0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-trio/outcome |
| **Source of supply** | https://pypi.org/project/outcome/1.3.0.post0/ |
| **Reference date** | – |

---

### 94. packaging

| Field | Value |
|------|--------|
| **FOSS Component Name** | packaging |
| **Version** | 24.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © packaging contributors |
| **License text** | [See License](./LICENSES.md#packaging-24-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pypa/packaging |
| **Source of supply** | https://pypi.org/project/packaging/24.2/ |
| **Reference date** | – |

---

### 95. pandas

| Field | Value |
|------|--------|
| **FOSS Component Name** | pandas |
| **Version** | 2.2.3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © pandas contributors |
| **License text** | [See License](./LICENSES.md#pandas-2-2-3) |
| **Author's notes** | None |
| **Source code location** | https://pandas.pydata.org |
| **Source of supply** | https://pypi.org/project/pandas/2.2.3/ |
| **Reference date** | – |

---

### 96. parse

| Field | Value |
|------|--------|
| **FOSS Component Name** | parse |
| **Version** | 1.19.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © parse contributors |
| **License text** | [See License](./LICENSES.md#parse-1-19-1) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/parse/ |
| **Source of supply** | https://pypi.org/project/parse/1.19.1/ |
| **Reference date** | – |

---

### 97. parse-type

| Field | Value |
|------|--------|
| **FOSS Component Name** | parse-type |
| **Version** | 0.5.2 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Jens Engel |
| **License text** | [See License](./LICENSES.md#parse-type-0-5-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/jenisys/parse_type |
| **Source of supply** | https://pypi.org/project/parse-type/0.5.2/ |
| **Reference date** | – |

---

### 98. pillow

| Field | Value |
|------|--------|
| **FOSS Component Name** | pillow |
| **Version** | 11.2.1 |
| **FOSS License (exact name)** | MIT-CMU |
| **Copyright information** | © pillow contributors |
| **License text** | [See License](./LICENSES.md#pillow-11-2-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-pillow/Pillow |
| **Source of supply** | https://pypi.org/project/pillow/11.2.1/ |
| **Reference date** | – |

---

### 99. playwright

| Field | Value |
|------|--------|
| **FOSS Component Name** | playwright |
| **Version** | 1.51.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Microsoft Corporation |
| **License text** | [See License](./LICENSES.md#playwright-1-51-0) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/playwright/ |
| **Source of supply** | https://pypi.org/project/playwright/1.51.0/ |
| **Reference date** | – |

---

### 100. portalocker

| Field | Value |
|------|--------|
| **FOSS Component Name** | portalocker |
| **Version** | 2.10.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © portalocker contributors |
| **License text** | [See License](./LICENSES.md#portalocker-2-10-1) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/portalocker/ |
| **Source of supply** | https://pypi.org/project/portalocker/2.10.1/ |
| **Reference date** | – |

---

### 101. posthog

| Field | Value |
|------|--------|
| **FOSS Component Name** | posthog |
| **Version** | 3.25.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Posthog |
| **License text** | [See License](./LICENSES.md#posthog-3-25-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/posthog/posthog-python |
| **Source of supply** | https://pypi.org/project/posthog/3.25.0/ |
| **Reference date** | – |

---

### 102. propcache

| Field | Value |
|------|--------|
| **FOSS Component Name** | propcache |
| **Version** | 0.3.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Andrew Svetlov |
| **License text** | [See License](./LICENSES.md#propcache-0-3-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/aio-libs/propcache |
| **Source of supply** | https://pypi.org/project/propcache/0.3.2/ |
| **Reference date** | – |

---

### 103. proto-plus

| Field | Value |
|------|--------|
| **FOSS Component Name** | proto-plus |
| **Version** | 1.26.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © proto-plus contributors |
| **License text** | [See License](./LICENSES.md#proto-plus-1-26-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/googleapis/proto-plus-python |
| **Source of supply** | https://pypi.org/project/proto-plus/1.26.1/ |
| **Reference date** | – |

---

### 104. protobuf

| Field | Value |
|------|--------|
| **FOSS Component Name** | protobuf |
| **Version** | 5.29.4 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © protobuf@googlegroups.com |
| **License text** | [See License](./LICENSES.md#protobuf-5-29-4) |
| **Author's notes** | None |
| **Source code location** | https://developers.google.com/protocol-buffers/ |
| **Source of supply** | https://pypi.org/project/protobuf/5.29.4/ |
| **Reference date** | – |

---

### 105. psutil

| Field | Value |
|------|--------|
| **FOSS Component Name** | psutil |
| **Version** | 7.0.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Giampaolo Rodola |
| **License text** | [See License](./LICENSES.md#psutil-7-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/giampaolo/psutil |
| **Source of supply** | https://pypi.org/project/psutil/7.0.0/ |
| **Reference date** | – |

---

### 106. psycopg

| Field | Value |
|------|--------|
| **FOSS Component Name** | psycopg |
| **Version** | 3.2.4 |
| **FOSS License (exact name)** | LGPL-3.0-only |
| **Copyright information** | © Daniele Varrazzo |
| **License text** | [See License](./LICENSES.md#psycopg-3-2-4) |
| **Author's notes** | None |
| **Source code location** | https://psycopg.org/ |
| **Source of supply** | https://pypi.org/project/psycopg/3.2.4/ |
| **Reference date** | – |

---

### 107. psycopg-binary

| Field | Value |
|------|--------|
| **FOSS Component Name** | psycopg-binary |
| **Version** | 3.2.4 |
| **FOSS License (exact name)** | LGPL-3.0-only |
| **Copyright information** | © Daniele Varrazzo |
| **License text** | [See License](./LICENSES.md#psycopg-binary-3-2-4) |
| **Author's notes** | None |
| **Source code location** | https://psycopg.org/ |
| **Source of supply** | https://pypi.org/project/psycopg-binary/3.2.4/ |
| **Reference date** | – |

---

### 108. psycopg2

| Field | Value |
|------|--------|
| **FOSS Component Name** | psycopg2 |
| **Version** | 2.9.6 |
| **FOSS License (exact name)** | LGPL-2.1-only |
| **Copyright information** | © Federico Di Gregorio |
| **License text** | [See License](./LICENSES.md#psycopg2-2-9-6) |
| **Author's notes** | None |
| **Source code location** | https://psycopg.org/ |
| **Source of supply** | https://pypi.org/project/psycopg2/2.9.6/ |
| **Reference date** | – |

---

### 109. psycopg2-binary

| Field | Value |
|------|--------|
| **FOSS Component Name** | psycopg2-binary |
| **Version** | 2.9.10 |
| **FOSS License (exact name)** | LGPL-2.1-only |
| **Copyright information** | © Federico Di Gregorio |
| **License text** | [See License](./LICENSES.md#psycopg2-binary-2-9-10) |
| **Author's notes** | None |
| **Source code location** | https://psycopg.org/ |
| **Source of supply** | https://pypi.org/project/psycopg2-binary/2.9.10/ |
| **Reference date** | – |

---

### 110. pyasn1

| Field | Value |
|------|--------|
| **FOSS Component Name** | pyasn1 |
| **Version** | 0.6.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Ilya Etingof |
| **License text** | [See License](./LICENSES.md#pyasn1-0-6-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pyasn1/pyasn1 |
| **Source of supply** | https://pypi.org/project/pyasn1/0.6.1/ |
| **Reference date** | – |

---

### 111. pyasn1_modules

| Field | Value |
|------|--------|
| **FOSS Component Name** | pyasn1_modules |
| **Version** | 0.4.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Ilya Etingof |
| **License text** | [See License](./LICENSES.md#pyasn1-modules-0-4-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pyasn1/pyasn1-modules |
| **Source of supply** | https://pypi.org/project/pyasn1_modules/0.4.1/ |
| **Reference date** | – |

---

### 112. pycparser

| Field | Value |
|------|--------|
| **FOSS Component Name** | pycparser |
| **Version** | 2.21 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Eli Bendersky |
| **License text** | [See License](./LICENSES.md#pycparser-2-21) |
| **Author's notes** | None |
| **Source code location** | https://github.com/eliben/pycparser |
| **Source of supply** | https://pypi.org/project/pycparser/2.21/ |
| **Reference date** | – |

---

### 113. pycryptodome

| Field | Value |
|------|--------|
| **FOSS Component Name** | pycryptodome |
| **Version** | 3.20.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Helder Eijs |
| **License text** | [See License](./LICENSES.md#pycryptodome-3-20-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Legrandin/pycryptodome/ |
| **Source of supply** | https://pypi.org/project/pycryptodome/3.20.0/ |
| **Reference date** | – |

---

### 114. pydantic

| Field | Value |
|------|--------|
| **FOSS Component Name** | pydantic |
| **Version** | 2.11.7 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © pydantic contributors |
| **License text** | [See License](./LICENSES.md#pydantic-2-11-7) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pydantic/pydantic |
| **Source of supply** | https://pypi.org/project/pydantic/2.11.7/ |
| **Reference date** | – |

---

### 115. pydantic-settings

| Field | Value |
|------|--------|
| **FOSS Component Name** | pydantic-settings |
| **Version** | 2.10.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © pydantic-settings contributors |
| **License text** | [See License](./LICENSES.md#pydantic-settings-2-10-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pydantic/pydantic-settings |
| **Source of supply** | https://pypi.org/project/pydantic-settings/2.10.1/ |
| **Reference date** | – |

---

### 116. pydantic_core

| Field | Value |
|------|--------|
| **FOSS Component Name** | pydantic_core |
| **Version** | 2.33.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © pydantic_core contributors |
| **License text** | [See License](./LICENSES.md#pydantic-core-2-33-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pydantic/pydantic-core |
| **Source of supply** | https://pypi.org/project/pydantic_core/2.33.2/ |
| **Reference date** | – |

---

### 117. pydash

| Field | Value |
|------|--------|
| **FOSS Component Name** | pydash |
| **Version** | 7.0.7 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Derrick Gilland |
| **License text** | [See License](./LICENSES.md#pydash-7-0-7) |
| **Author's notes** | None |
| **Source code location** | https://github.com/dgilland/pydash |
| **Source of supply** | https://pypi.org/project/pydash/7.0.7/ |
| **Reference date** | – |

---

### 118. pyee

| Field | Value |
|------|--------|
| **FOSS Component Name** | pyee |
| **Version** | 12.1.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © pyee contributors |
| **License text** | [See License](./LICENSES.md#pyee-12-1-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/jfhbrook/pyee |
| **Source of supply** | https://pypi.org/project/pyee/12.1.1/ |
| **Reference date** | – |

---

### 119. pymongo

| Field | Value |
|------|--------|
| **FOSS Component Name** | pymongo |
| **Version** | 4.10.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © The MongoDB Python Team |
| **License text** | [See License](./LICENSES.md#pymongo-4-10-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/mongodb/mongo-python-driver |
| **Source of supply** | https://pypi.org/project/pymongo/4.10.1/ |
| **Reference date** | – |

---

### 120. PyMySQL

| Field | Value |
|------|--------|
| **FOSS Component Name** | PyMySQL |
| **Version** | 1.1.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © PyMySQL contributors |
| **License text** | [See License](./LICENSES.md#pymysql-1-1-1) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/PyMySQL/ |
| **Source of supply** | https://pypi.org/project/PyMySQL/1.1.1/ |
| **Reference date** | – |

---

### 121. pyodbc

| Field | Value |
|------|--------|
| **FOSS Component Name** | pyodbc |
| **Version** | 5.2.0 |
| **FOSS License (exact name)** | MIT-0 |
| **Copyright information** | © Michael Kleehammer |
| **License text** | [See License](./LICENSES.md#pyodbc-5-2-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/mkleehammer/pyodbc |
| **Source of supply** | https://pypi.org/project/pyodbc/5.2.0/ |
| **Reference date** | – |

---

### 122. pyotp

| Field | Value |
|------|--------|
| **FOSS Component Name** | pyotp |
| **Version** | 2.9.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © PyOTP contributors |
| **License text** | [See License](./LICENSES.md#pyotp-2-9-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pyotp/pyotp |
| **Source of supply** | https://pypi.org/project/pyotp/2.9.0/ |
| **Reference date** | – |

---

### 123. pyparsing

| Field | Value |
|------|--------|
| **FOSS Component Name** | pyparsing |
| **Version** | 3.2.3 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © pyparsing contributors |
| **License text** | [See License](./LICENSES.md#pyparsing-3-2-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pyparsing/pyparsing/ |
| **Source of supply** | https://pypi.org/project/pyparsing/3.2.3/ |
| **Reference date** | – |

---

### 124. pypdf

| Field | Value |
|------|--------|
| **FOSS Component Name** | pypdf |
| **Version** | 5.7.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © stefan6419846 |
| **License text** | [See License](./LICENSES.md#pypdf-5-7-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/py-pdf/pypdf |
| **Source of supply** | https://pypi.org/project/pypdf/5.7.0/ |
| **Reference date** | – |

---

### 125. PySocks

| Field | Value |
|------|--------|
| **FOSS Component Name** | PySocks |
| **Version** | 1.7.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Anorov |
| **License text** | [See License](./LICENSES.md#pysocks-1-7-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Anorov/PySocks |
| **Source of supply** | https://pypi.org/project/PySocks/1.7.1/ |
| **Reference date** | – |

---

### 126. python-crontab

| Field | Value |
|------|--------|
| **FOSS Component Name** | python-crontab |
| **Version** | 2.7.1 |
| **FOSS License (exact name)** | LGPL-3.0-or-later |
| **Copyright information** | © Martin Owens |
| **License text** | [See License](./LICENSES.md#python-crontab-2-7-1) |
| **Author's notes** | None |
| **Source code location** | https://gitlab.com/doctormo/python-crontab/ |
| **Source of supply** | https://pypi.org/project/python-crontab/2.7.1/ |
| **Reference date** | – |

---

### 127. python-dateutil

| Field | Value |
|------|--------|
| **FOSS Component Name** | python-dateutil |
| **Version** | 2.8.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Gustavo Niemeyer |
| **License text** | [See License](./LICENSES.md#python-dateutil-2-8-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/dateutil/dateutil |
| **Source of supply** | https://pypi.org/project/python-dateutil/2.8.2/ |
| **Reference date** | – |

---

### 128. python-dotenv

| Field | Value |
|------|--------|
| **FOSS Component Name** | python-dotenv |
| **Version** | 1.1.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Saurabh Kumar |
| **License text** | [See License](./LICENSES.md#python-dotenv-1-1-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/theskumar/python-dotenv |
| **Source of supply** | https://pypi.org/project/python-dotenv/1.1.0/ |
| **Reference date** | – |

---

### 129. python-multipart

| Field | Value |
|------|--------|
| **FOSS Component Name** | python-multipart |
| **Version** | 0.0.20 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © python-multipart contributors |
| **License text** | [See License](./LICENSES.md#python-multipart-0-0-20) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Kludex/python-multipart |
| **Source of supply** | https://pypi.org/project/python-multipart/0.0.20/ |
| **Reference date** | – |

---

### 130. pytz

| Field | Value |
|------|--------|
| **FOSS Component Name** | pytz |
| **Version** | 2024.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Stuart Bishop |
| **License text** | [See License](./LICENSES.md#pytz-2024-2) |
| **Author's notes** | None |
| **Source code location** | http://pythonhosted.org/pytz |
| **Source of supply** | https://pypi.org/project/pytz/2024.2/ |
| **Reference date** | – |

---

### 131. PyYAML

| Field | Value |
|------|--------|
| **FOSS Component Name** | PyYAML |
| **Version** | 6.0.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Kirill Simonov |
| **License text** | [See License](./LICENSES.md#pyyaml-6-0-2) |
| **Author's notes** | None |
| **Source code location** | https://pyyaml.org/ |
| **Source of supply** | https://pypi.org/project/PyYAML/6.0.2/ |
| **Reference date** | – |

---

### 132. redis

| Field | Value |
|------|--------|
| **FOSS Component Name** | redis |
| **Version** | 5.0.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Redis Inc. |
| **License text** | [See License](./LICENSES.md#redis-5-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/redis/redis-py |
| **Source of supply** | https://pypi.org/project/redis/5.0.0/ |
| **Reference date** | – |

---

### 133. referencing

| Field | Value |
|------|--------|
| **FOSS Component Name** | referencing |
| **Version** | 0.36.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © referencing contributors |
| **License text** | [See License](./LICENSES.md#referencing-0-36-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-jsonschema/referencing |
| **Source of supply** | https://pypi.org/project/referencing/0.36.2/ |
| **Reference date** | – |

---

### 134. regex

| Field | Value |
|------|--------|
| **FOSS Component Name** | regex |
| **Version** | 2023.6.3 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Matthew Barnett |
| **License text** | [See License](./LICENSES.md#regex-2023-6-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/mrabarnett/mrab-regex |
| **Source of supply** | https://pypi.org/project/regex/2023.6.3/ |
| **Reference date** | – |

---

### 135. reportlab

| Field | Value |
|------|--------|
| **FOSS Component Name** | reportlab |
| **Version** | 4.4.3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Andy Robinson, Robin Becker, the ReportLab team and the community |
| **License text** | [See License](./LICENSES.md#reportlab-4-4-3) |
| **Author's notes** | None |
| **Source code location** | https://www.reportlab.com/ |
| **Source of supply** | https://pypi.org/project/reportlab/4.4.3/ |
| **Reference date** | – |

---

### 136. requests

| Field | Value |
|------|--------|
| **FOSS Component Name** | requests |
| **Version** | 2.32.3 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Kenneth Reitz |
| **License text** | [See License](./LICENSES.md#requests-2-32-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/psf/requests |
| **Source of supply** | https://pypi.org/project/requests/2.32.3/ |
| **Reference date** | – |

---

### 137. requests-oauthlib

| Field | Value |
|------|--------|
| **FOSS Component Name** | requests-oauthlib |
| **Version** | 2.0.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Kenneth Reitz |
| **License text** | [See License](./LICENSES.md#requests-oauthlib-2-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/requests/requests-oauthlib |
| **Source of supply** | https://pypi.org/project/requests-oauthlib/2.0.0/ |
| **Reference date** | – |

---

### 138. rpds-py

| Field | Value |
|------|--------|
| **FOSS Component Name** | rpds-py |
| **Version** | 0.27.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © rpds-py contributors |
| **License text** | [See License](./LICENSES.md#rpds-py-0-27-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/crate-py/rpds |
| **Source of supply** | https://pypi.org/project/rpds-py/0.27.1/ |
| **Reference date** | – |

---

### 139. rq

| Field | Value |
|------|--------|
| **FOSS Component Name** | rq |
| **Version** | 1.15.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Vincent Driessen |
| **License text** | [See License](./LICENSES.md#rq-1-15-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/nvie/rq/ |
| **Source of supply** | https://pypi.org/project/rq/1.15.1/ |
| **Reference date** | – |

---

### 140. rsa

| Field | Value |
|------|--------|
| **FOSS Component Name** | rsa |
| **Version** | 4.9 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Sybren A. Stüvel |
| **License text** | [See License](./LICENSES.md#rsa-4-9) |
| **Author's notes** | None |
| **Source code location** | https://stuvel.eu/rsa |
| **Source of supply** | https://pypi.org/project/rsa/4.9/ |
| **Reference date** | – |

---

### 141. rstr

| Field | Value |
|------|--------|
| **FOSS Component Name** | rstr |
| **Version** | 3.2.2 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © rstr contributors |
| **License text** | [See License](./LICENSES.md#rstr-3-2-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/leapfrogonline/rstr |
| **Source of supply** | https://pypi.org/project/rstr/3.2.2/ |
| **Reference date** | – |

---

### 142. screeninfo

| Field | Value |
|------|--------|
| **FOSS Component Name** | screeninfo |
| **Version** | 0.8.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Marcin Kurczewski |
| **License text** | [See License](./LICENSES.md#screeninfo-0-8-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/rr-/screeninfo |
| **Source of supply** | https://pypi.org/project/screeninfo/0.8.1/ |
| **Reference date** | – |

---

### 143. selenium

| Field | Value |
|------|--------|
| **FOSS Component Name** | selenium |
| **Version** | 4.16.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © selenium contributors |
| **License text** | [See License](./LICENSES.md#selenium-4-16-0) |
| **Author's notes** | None |
| **Source code location** | https://www.selenium.dev |
| **Source of supply** | https://pypi.org/project/selenium/4.16.0/ |
| **Reference date** | – |

---

### 144. sentry-sdk

| Field | Value |
|------|--------|
| **FOSS Component Name** | sentry-sdk |
| **Version** | 1.28.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © Sentry Team and Contributors |
| **License text** | [See License](./LICENSES.md#sentry-sdk-1-28-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/getsentry/sentry-python |
| **Source of supply** | https://pypi.org/project/sentry-sdk/1.28.1/ |
| **Reference date** | – |

---

### 145. simplejson

| Field | Value |
|------|--------|
| **FOSS Component Name** | simplejson |
| **Version** | 3.19.1 |
| **FOSS License (exact name)** | AFL-3.0 |
| **Copyright information** | © Bob Ippolito |
| **License text** | [See License](./LICENSES.md#simplejson-3-19-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/simplejson/simplejson |
| **Source of supply** | https://pypi.org/project/simplejson/3.19.1/ |
| **Reference date** | – |

---

### 146. six

| Field | Value |
|------|--------|
| **FOSS Component Name** | six |
| **Version** | 1.16.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Benjamin Peterson |
| **License text** | [See License](./LICENSES.md#six-1-16-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/benjaminp/six |
| **Source of supply** | https://pypi.org/project/six/1.16.0/ |
| **Reference date** | – |

---

### 147. sniffio

| Field | Value |
|------|--------|
| **FOSS Component Name** | sniffio |
| **Version** | 1.3.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Nathaniel J. Smith |
| **License text** | [See License](./LICENSES.md#sniffio-1-3-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-trio/sniffio |
| **Source of supply** | https://pypi.org/project/sniffio/1.3.0/ |
| **Reference date** | – |

---

### 148. sortedcontainers

| Field | Value |
|------|--------|
| **FOSS Component Name** | sortedcontainers |
| **Version** | 2.4.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Grant Jenks |
| **License text** | [See License](./LICENSES.md#sortedcontainers-2-4-0) |
| **Author's notes** | None |
| **Source code location** | http://www.grantjenks.com/docs/sortedcontainers/ |
| **Source of supply** | https://pypi.org/project/sortedcontainers/2.4.0/ |
| **Reference date** | – |

---

### 149. soupsieve

| Field | Value |
|------|--------|
| **FOSS Component Name** | soupsieve |
| **Version** | 2.4.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © soupsieve contributors |
| **License text** | [See License](./LICENSES.md#soupsieve-2-4-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/facelessuser/soupsieve |
| **Source of supply** | https://pypi.org/project/soupsieve/2.4.1/ |
| **Reference date** | – |

---

### 150. SQLAlchemy

| Field | Value |
|------|--------|
| **FOSS Component Name** | SQLAlchemy |
| **Version** | 2.0.37 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Mike Bayer |
| **License text** | [See License](./LICENSES.md#sqlalchemy-2-0-37) |
| **Author's notes** | None |
| **Source code location** | https://www.sqlalchemy.org |
| **Source of supply** | https://pypi.org/project/SQLAlchemy/2.0.37/ |
| **Reference date** | – |

---

### 151. sqlparse

| Field | Value |
|------|--------|
| **FOSS Component Name** | sqlparse |
| **Version** | 0.4.4 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © sqlparse contributors |
| **License text** | [See License](./LICENSES.md#sqlparse-0-4-4) |
| **Author's notes** | None |
| **Source code location** | https://github.com/andialbrecht/sqlparse |
| **Source of supply** | https://pypi.org/project/sqlparse/0.4.4/ |
| **Reference date** | – |

---

### 152. sse-starlette

| Field | Value |
|------|--------|
| **FOSS Component Name** | sse-starlette |
| **Version** | 3.0.2 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © sse-starlette contributors |
| **License text** | [See License](./LICENSES.md#sse-starlette-3-0-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/sysid/sse-starlette |
| **Source of supply** | https://pypi.org/project/sse-starlette/3.0.2/ |
| **Reference date** | – |

---

### 153. starlette

| Field | Value |
|------|--------|
| **FOSS Component Name** | starlette |
| **Version** | 0.47.3 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © starlette contributors |
| **License text** | [See License](./LICENSES.md#starlette-0-47-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/encode/starlette |
| **Source of supply** | https://pypi.org/project/starlette/0.47.3/ |
| **Reference date** | – |

---

### 154. tenacity

| Field | Value |
|------|--------|
| **FOSS Component Name** | tenacity |
| **Version** | 9.1.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Julien Danjou |
| **License text** | [See License](./LICENSES.md#tenacity-9-1-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/jd/tenacity |
| **Source of supply** | https://pypi.org/project/tenacity/9.1.2/ |
| **Reference date** | – |

---

### 155. tqdm

| Field | Value |
|------|--------|
| **FOSS Component Name** | tqdm |
| **Version** | 4.65.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © tqdm developers |
| **License text** | [See License](./LICENSES.md#tqdm-4-65-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/tqdm/tqdm |
| **Source of supply** | https://pypi.org/project/tqdm/4.65.0/ |
| **Reference date** | – |

---

### 156. trio

| Field | Value |
|------|--------|
| **FOSS Component Name** | trio |
| **Version** | 0.23.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © trio contributors |
| **License text** | [See License](./LICENSES.md#trio-0-23-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-trio/trio |
| **Source of supply** | https://pypi.org/project/trio/0.23.2/ |
| **Reference date** | – |

---

### 157. trio-websocket

| Field | Value |
|------|--------|
| **FOSS Component Name** | trio-websocket |
| **Version** | 0.11.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Mark E. Haase |
| **License text** | [See License](./LICENSES.md#trio-websocket-0-11-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-trio/trio-websocket |
| **Source of supply** | https://pypi.org/project/trio-websocket/0.11.1/ |
| **Reference date** | – |

---

### 158. typing-inspection

| Field | Value |
|------|--------|
| **FOSS Component Name** | typing-inspection |
| **Version** | 0.4.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © typing-inspection contributors |
| **License text** | [See License](./LICENSES.md#typing-inspection-0-4-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/pydantic/typing-inspection |
| **Source of supply** | https://pypi.org/project/typing-inspection/0.4.1/ |
| **Reference date** | – |

---

### 159. typing_extensions

| Field | Value |
|------|--------|
| **FOSS Component Name** | typing_extensions |
| **Version** | 4.13.2 |
| **FOSS License (exact name)** | PSF-2.0 |
| **Copyright information** | © typing_extensions contributors |
| **License text** | [See License](./LICENSES.md#typing-extensions-4-13-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python/typing_extensions |
| **Source of supply** | https://pypi.org/project/typing_extensions/4.13.2/ |
| **Reference date** | – |

---

### 160. tzdata

| Field | Value |
|------|--------|
| **FOSS Component Name** | tzdata |
| **Version** | 2025.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Python Software Foundation |
| **License text** | [See License](./LICENSES.md#tzdata-2025-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python/tzdata |
| **Source of supply** | https://pypi.org/project/tzdata/2025.1/ |
| **Reference date** | – |

---

### 161. Unidecode

| Field | Value |
|------|--------|
| **FOSS Component Name** | Unidecode |
| **Version** | 0.4.21 |
| **FOSS License (exact name)** | GPL-2.0-or-later |
| **Copyright information** | © Tomaz Solc |
| **License text** | [See License](./LICENSES.md#unidecode-0-4-21) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/Unidecode/ |
| **Source of supply** | https://pypi.org/project/Unidecode/0.4.21/ |
| **Reference date** | – |

---

### 162. uritemplate

| Field | Value |
|------|--------|
| **FOSS Component Name** | uritemplate |
| **Version** | 4.1.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Ian Stapleton Cordasco |
| **License text** | [See License](./LICENSES.md#uritemplate-4-1-1) |
| **Author's notes** | None |
| **Source code location** | https://uritemplate.readthedocs.org |
| **Source of supply** | https://pypi.org/project/uritemplate/4.1.1/ |
| **Reference date** | – |

---

### 163. urllib3

| Field | Value |
|------|--------|
| **FOSS Component Name** | urllib3 |
| **Version** | 2.2.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © urllib3 contributors |
| **License text** | [See License](./LICENSES.md#urllib3-2-2-1) |
| **Author's notes** | None |
| **Source code location** | https://pypi.org/project/urllib3/ |
| **Source of supply** | https://pypi.org/project/urllib3/2.2.1/ |
| **Reference date** | – |

---

### 164. uuid7

| Field | Value |
|------|--------|
| **FOSS Component Name** | uuid7 |
| **Version** | 0.1.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Stephen Simmons |
| **License text** | [See License](./LICENSES.md#uuid7-0-1-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/stevesimmons/uuid7 |
| **Source of supply** | https://pypi.org/project/uuid7/0.1.0/ |
| **Reference date** | – |

---

### 165. uvicorn

| Field | Value |
|------|--------|
| **FOSS Component Name** | uvicorn |
| **Version** | 0.35.0 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © uvicorn contributors |
| **License text** | [See License](./LICENSES.md#uvicorn-0-35-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/encode/uvicorn |
| **Source of supply** | https://pypi.org/project/uvicorn/0.35.0/ |
| **Reference date** | – |

---

### 166. watchdog

| Field | Value |
|------|--------|
| **FOSS Component Name** | watchdog |
| **Version** | 6.0.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Mickaël Schoentgen |
| **License text** | [See License](./LICENSES.md#watchdog-6-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/gorakhargosh/watchdog/ |
| **Source of supply** | https://pypi.org/project/watchdog/6.0.0/ |
| **Reference date** | – |

---

### 167. webdriver-manager

| Field | Value |
|------|--------|
| **FOSS Component Name** | webdriver-manager |
| **Version** | 4.0.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Sergey Pirogov |
| **License text** | [See License](./LICENSES.md#webdriver-manager-4-0-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/SergeyPirogov/webdriver_manager |
| **Source of supply** | https://pypi.org/project/webdriver-manager/4.0.2/ |
| **Reference date** | – |

---

### 168. websocket-client

| Field | Value |
|------|--------|
| **FOSS Component Name** | websocket-client |
| **Version** | 1.8.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © liris |
| **License text** | [See License](./LICENSES.md#websocket-client-1-8-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/websocket-client/websocket-client/ |
| **Source of supply** | https://pypi.org/project/websocket-client/1.8.0/ |
| **Reference date** | – |

---

### 169. websockets

| Field | Value |
|------|--------|
| **FOSS Component Name** | websockets |
| **Version** | 15.0.1 |
| **FOSS License (exact name)** | BSD-3-Clause |
| **Copyright information** | © websockets contributors |
| **License text** | [See License](./LICENSES.md#websockets-15-0-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-websockets/websockets |
| **Source of supply** | https://pypi.org/project/websockets/15.0.1/ |
| **Reference date** | – |

---

### 170. wsproto

| Field | Value |
|------|--------|
| **FOSS Component Name** | wsproto |
| **Version** | 1.2.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Benno Rice |
| **License text** | [See License](./LICENSES.md#wsproto-1-2-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/python-hyper/wsproto/ |
| **Source of supply** | https://pypi.org/project/wsproto/1.2.0/ |
| **Reference date** | – |

---

### 171. xmltodict

| Field | Value |
|------|--------|
| **FOSS Component Name** | xmltodict |
| **Version** | 0.14.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Martin Blech |
| **License text** | [See License](./LICENSES.md#xmltodict-0-14-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/martinblech/xmltodict |
| **Source of supply** | https://pypi.org/project/xmltodict/0.14.2/ |
| **Reference date** | – |

---

### 172. yarl

| Field | Value |
|------|--------|
| **FOSS Component Name** | yarl |
| **Version** | 1.20.1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Andrew Svetlov |
| **License text** | [See License](./LICENSES.md#yarl-1-20-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/aio-libs/yarl |
| **Source of supply** | https://pypi.org/project/yarl/1.20.1/ |
| **Reference date** | – |

---
