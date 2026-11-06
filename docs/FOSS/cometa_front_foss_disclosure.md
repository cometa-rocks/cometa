# Open Source Software (FOSS) Components

# Cometa Front – FOSS Disclosure

This document lists the Free and Open Source Software (FOSS) components that are part of the
**Cometa Front** service (`cometa/front`), the Apache-hosted Angular user interface for Cometa.

It covers Apache HTTP Server and related Debian libraries, together with the Angular / npm packages
used to build the static frontend that the container serves.

Highcharts and highcharts-angular are proprietary components. They are listed for completeness of
the frontend dependency set, with their own license references.

Full license texts: [LICENSES.md](./LICENSES.md)

### 1. Apache HTTP Server

| Field | Value |
|------|--------|
| **FOSS Component Name** | Apache HTTP Server |
| **Version** | 2.4.64 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © The Apache Software Foundation |
| **License text** | [See License](./LICENSES.md#apache-http-server-2-4-64) |
| **Author's notes** | Internal Amvara Angular toolbox package; no license declared on the public npm registry. |
| **Source code location** | https://github.com/apache/httpd |
| **Source of supply** | https://hub.docker.com/_/httpd |
| **Reference date** | – |

---

### 2. Debian GNU/Linux

| Field | Value |
|------|--------|
| **FOSS Component Name** | Debian GNU/Linux |
| **Version** | 12 (bookworm) |
| **FOSS License (exact name)** | Multiple (Debian copyright) |
| **Copyright information** | © Software in the Public Interest, Inc. and package authors |
| **License text** | [See License](./LICENSES.md#debian-gnu-linux-12-bookworm) |
| **Author's notes** | None |
| **Source code location** | https://www.debian.org/ |
| **Source of supply** | https://hub.docker.com/_/httpd |
| **Reference date** | – |

---

### 3. mod_auth_openidc

| Field | Value |
|------|--------|
| **FOSS Component Name** | mod_auth_openidc |
| **Version** | 2.4.12.3-2+deb12u4 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © ZmartZone IAM and Hans Zandbelt |
| **License text** | [See License](./LICENSES.md#mod-auth-openidc-2-4-12-3-2-deb12u4) |
| **Author's notes** | None |
| **Source code location** | https://github.com/OpenIDC/mod_auth_openidc |
| **Source of supply** | https://packages.debian.org/bookworm/libapache2-mod-auth-openidc |
| **Reference date** | – |

---

### 4. ModSecurity

| Field | Value |
|------|--------|
| **FOSS Component Name** | ModSecurity |
| **Version** | 2.9.7-1+deb12u1 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Trustwave Holdings, Inc. |
| **License text** | [See License](./LICENSES.md#modsecurity-2-9-7-1-deb12u1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/owasp-modsecurity/ModSecurity |
| **Source of supply** | https://packages.debian.org/bookworm/libapache2-mod-security2 |
| **Reference date** | – |

---

### 5. cjose

| Field | Value |
|------|--------|
| **FOSS Component Name** | cjose |
| **Version** | 0.6.2.1-1+deb12u1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Cisco Systems, Inc. |
| **License text** | [See License](./LICENSES.md#cjose-0-6-2-1-1-deb12u1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/OpenIDC/cjose |
| **Source of supply** | https://packages.debian.org/bookworm/libcjose0 |
| **Reference date** | – |

---

### 6. Jansson

| Field | Value |
|------|--------|
| **FOSS Component Name** | Jansson |
| **Version** | 2.14-2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Petri Lehtinen |
| **License text** | [See License](./LICENSES.md#jansson-2-14-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/akheron/jansson |
| **Source of supply** | https://packages.debian.org/bookworm/libjansson4 |
| **Reference date** | – |

---

### 7. curl

| Field | Value |
|------|--------|
| **FOSS Component Name** | curl |
| **Version** | 7.88.1-10+deb12u14 |
| **FOSS License (exact name)** | curl |
| **Copyright information** | © Daniel Stenberg |
| **License text** | [See License](./LICENSES.md#curl-7-88-1-10-deb12u14) |
| **Author's notes** | None |
| **Source code location** | https://github.com/curl/curl |
| **Source of supply** | https://packages.debian.org/bookworm/libcurl4 |
| **Reference date** | – |

---

### 8. OpenSSL

| Field | Value |
|------|--------|
| **FOSS Component Name** | OpenSSL |
| **Version** | 1.1.1w-0+deb11u1 |
| **FOSS License (exact name)** | OpenSSL |
| **Copyright information** | © The OpenSSL Project Authors |
| **License text** | [See License](./LICENSES.md#openssl-1-1-1w-0-deb11u1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/openssl/openssl |
| **Source of supply** | http://deb.debian.org/debian/pool/main/o/openssl/ |
| **Reference date** | – |

---

### 9. zlib

| Field | Value |
|------|--------|
| **FOSS Component Name** | zlib |
| **Version** | 1.2.13.dfsg-1 |
| **FOSS License (exact name)** | Zlib |
| **Copyright information** | © Jean-loup Gailly and Mark Adler |
| **License text** | [See License](./LICENSES.md#zlib-1-2-13-dfsg-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/madler/zlib |
| **Source of supply** | https://packages.debian.org/bookworm/zlib1g |
| **Reference date** | – |

---

### 10. @angular/animations

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/animations |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-animations-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/animations/v/15.2.9 |
| **Reference date** | – |

---

### 11. @angular/cdk

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/cdk |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @angular/cdk contributors |
| **License text** | [See License](./LICENSES.md#angular-cdk-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/components |
| **Source of supply** | https://www.npmjs.com/package/@angular/cdk/v/15.2.9 |
| **Reference date** | – |

---

### 12. @angular/compiler

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/compiler |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-compiler-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/compiler/v/15.2.9 |
| **Reference date** | – |

---

### 13. @angular/forms

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/forms |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-forms-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/forms/v/15.2.9 |
| **Reference date** | – |

---

### 14. @angular/material

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/material |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @angular/material contributors |
| **License text** | [See License](./LICENSES.md#angular-material-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/components |
| **Source of supply** | https://www.npmjs.com/package/@angular/material/v/15.2.9 |
| **Reference date** | – |

---

### 15. @angular/platform-browser

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/platform-browser |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-platform-browser-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/platform-browser/v/15.2.9 |
| **Reference date** | – |

---

### 16. @angular/platform-browser-dynamic

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/platform-browser-dynamic |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-platform-browser-dynamic-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/platform-browser-dynamic/v/15.2.9 |
| **Reference date** | – |

---

### 17. @angular/router

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/router |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-router-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/router/v/15.2.9 |
| **Reference date** | – |

---

### 18. @angular/service-worker

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/service-worker |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-service-worker-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/service-worker/v/15.2.9 |
| **Reference date** | – |

---

### 19. @ng-matero/extensions

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ng-matero/extensions |
| **Version** | 15.5.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © nzbin |
| **License text** | [See License](./LICENSES.md#ng-matero-extensions-15-5-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ng-matero/extensions |
| **Source of supply** | https://www.npmjs.com/package/@ng-matero/extensions/v/15.5.0 |
| **Reference date** | – |

---

### 20. @ng-select/ng-select

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ng-select/ng-select |
| **Version** | 10.0.3 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @ng-select/ng-select |
| **License text** | [See License](./LICENSES.md#ng-select-ng-select-10-0-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ng-select/ng-select |
| **Source of supply** | https://www.npmjs.com/package/@ng-select/ng-select/v/10.0.3 |
| **Reference date** | – |

---

### 21. @ngneat/until-destroy

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngneat/until-destroy |
| **Version** | 8.0.4 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @ngneat/until-destroy contributors |
| **License text** | [See License](./LICENSES.md#ngneat-until-destroy-8-0-4) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngneat/until-destroy |
| **Source of supply** | https://www.npmjs.com/package/@ngneat/until-destroy/v/8.0.4 |
| **Reference date** | – |

---

### 22. @ngtools/webpack

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngtools/webpack |
| **Version** | 15.2.8 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Angular Authors |
| **License text** | [See License](./LICENSES.md#ngtools-webpack-15-2-8) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular-cli |
| **Source of supply** | https://www.npmjs.com/package/@ngtools/webpack/v/15.2.8 |
| **Reference date** | – |

---

### 23. @ngx-translate/core

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngx-translate/core |
| **Version** | 14.0.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Olivier Combe |
| **License text** | [See License](./LICENSES.md#ngx-translate-core-14-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngx-translate/core |
| **Source of supply** | https://www.npmjs.com/package/@ngx-translate/core/v/14.0.0 |
| **Reference date** | – |

---

### 24. @ngx-translate/http-loader

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngx-translate/http-loader |
| **Version** | 6.0.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Olivier Combe |
| **License text** | [See License](./LICENSES.md#ngx-translate-http-loader-6-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngx-translate/http-loader |
| **Source of supply** | https://www.npmjs.com/package/@ngx-translate/http-loader/v/6.0.0 |
| **Reference date** | – |

---

### 25. @ngxs-labs/immer-adapter

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngxs-labs/immer-adapter |
| **Version** | 3.0.5 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @ngxs-labs/immer-adapter contributors |
| **License text** | [See License](./LICENSES.md#ngxs-labs-immer-adapter-3-0-5) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngxs-labs/immer-adapter |
| **Source of supply** | https://www.npmjs.com/package/@ngxs-labs/immer-adapter/v/3.0.5 |
| **Reference date** | – |

---

### 26. @ngxs-labs/select-snapshot

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngxs-labs/select-snapshot |
| **Version** | 4.0.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @ngxs-labs/select-snapshot contributors |
| **License text** | [See License](./LICENSES.md#ngxs-labs-select-snapshot-4-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngxs-labs/select-snapshot |
| **Source of supply** | https://www.npmjs.com/package/@ngxs-labs/select-snapshot/v/4.0.0 |
| **Reference date** | – |

---

### 27. @ngxs/devtools-plugin

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngxs/devtools-plugin |
| **Version** | 3.7.6 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Austin McDaniel |
| **License text** | [See License](./LICENSES.md#ngxs-devtools-plugin-3-7-6) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngxs/store |
| **Source of supply** | https://www.npmjs.com/package/@ngxs/devtools-plugin/v/3.7.6 |
| **Reference date** | – |

---

### 28. @ngxs/form-plugin

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngxs/form-plugin |
| **Version** | 3.7.6 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Austin McDaniel |
| **License text** | [See License](./LICENSES.md#ngxs-form-plugin-3-7-6) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngxs/store |
| **Source of supply** | https://www.npmjs.com/package/@ngxs/form-plugin/v/3.7.6 |
| **Reference date** | – |

---

### 29. @ngxs/storage-plugin

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngxs/storage-plugin |
| **Version** | 3.7.6 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Austin McDaniel |
| **License text** | [See License](./LICENSES.md#ngxs-storage-plugin-3-7-6) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngxs/store |
| **Source of supply** | https://www.npmjs.com/package/@ngxs/storage-plugin/v/3.7.6 |
| **Reference date** | – |

---

### 30. @ngxs/store

| Field | Value |
|------|--------|
| **FOSS Component Name** | @ngxs/store |
| **Version** | 3.8.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Austin McDaniel |
| **License text** | [See License](./LICENSES.md#ngxs-store-3-8-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ngxs/store |
| **Source of supply** | https://www.npmjs.com/package/@ngxs/store/v/3.8.0 |
| **Reference date** | – |

---

### 31. @perfectmemory/ngx-contextmenu

| Field | Value |
|------|--------|
| **FOSS Component Name** | @perfectmemory/ngx-contextmenu |
| **Version** | 15.1.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @perfectmemory/ngx-contextmenu contributors |
| **License text** | [See License](./LICENSES.md#perfectmemory-ngx-contextmenu-15-1-1) |
| **Author's notes** | None |
| **Source code location** | ssh://git@github.com:PerfectMemory/ngx-contextmenu |
| **Source of supply** | https://www.npmjs.com/package/@perfectmemory/ngx-contextmenu/v/15.1.1 |
| **Reference date** | – |

---

### 32. @types/body-parser

| Field | Value |
|------|--------|
| **FOSS Component Name** | @types/body-parser |
| **Version** | 1.19.5 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @types/body-parser contributors |
| **License text** | [See License](./LICENSES.md#types-body-parser-1-19-5) |
| **Author's notes** | None |
| **Source code location** | https://github.com/DefinitelyTyped/DefinitelyTyped |
| **Source of supply** | https://www.npmjs.com/package/@types/body-parser/v/1.19.5 |
| **Reference date** | – |

---

### 33. @types/c3

| Field | Value |
|------|--------|
| **FOSS Component Name** | @types/c3 |
| **Version** | 0.7.8 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @types/c3 contributors |
| **License text** | [See License](./LICENSES.md#types-c3-0-7-8) |
| **Author's notes** | None |
| **Source code location** | https://github.com/DefinitelyTyped/DefinitelyTyped |
| **Source of supply** | https://www.npmjs.com/package/@types/c3/v/0.7.8 |
| **Reference date** | – |

---

### 34. ajv-keywords

| Field | Value |
|------|--------|
| **FOSS Component Name** | ajv-keywords |
| **Version** | 3.5.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Evgeny Poberezkin |
| **License text** | [See License](./LICENSES.md#ajv-keywords-3-5-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/epoberezkin/ajv-keywords |
| **Source of supply** | https://www.npmjs.com/package/ajv-keywords/v/3.5.2 |
| **Reference date** | – |

---

### 35. angular-svg-round-progressbar

| Field | Value |
|------|--------|
| **FOSS Component Name** | angular-svg-round-progressbar |
| **Version** | 10.0.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © crisbeto |
| **License text** | [See License](./LICENSES.md#angular-svg-round-progressbar-10-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/crisbeto/angular-svg-round-progressbar |
| **Source of supply** | https://www.npmjs.com/package/angular-svg-round-progressbar/v/10.0.0 |
| **Reference date** | – |

---

### 36. compare-versions

| Field | Value |
|------|--------|
| **FOSS Component Name** | compare-versions |
| **Version** | 3.6.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Ole Michelsen |
| **License text** | [See License](./LICENSES.md#compare-versions-3-6-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/omichelsen/compare-versions |
| **Source of supply** | https://www.npmjs.com/package/compare-versions/v/3.6.0 |
| **Reference date** | – |

---

### 37. core-js

| Field | Value |
|------|--------|
| **FOSS Component Name** | core-js |
| **Version** | 3.21.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © core-js contributors |
| **License text** | [See License](./LICENSES.md#core-js-3-21-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/zloirock/core-js |
| **Source of supply** | https://www.npmjs.com/package/core-js/v/3.21.1 |
| **Reference date** | – |

---

### 38. cron-parser

| Field | Value |
|------|--------|
| **FOSS Component Name** | cron-parser |
| **Version** | 4.3.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Harri Siirak |
| **License text** | [See License](./LICENSES.md#cron-parser-4-3-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/harrisiirak/cron-parser |
| **Source of supply** | https://www.npmjs.com/package/cron-parser/v/4.3.0 |
| **Reference date** | – |

---

### 39. d3

| Field | Value |
|------|--------|
| **FOSS Component Name** | d3 |
| **Version** | 7.8.3 |
| **FOSS License (exact name)** | ISC |
| **Copyright information** | © Mike Bostock |
| **License text** | [See License](./LICENSES.md#d3-7-8-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/d3/d3 |
| **Source of supply** | https://www.npmjs.com/package/d3/v/7.8.3 |
| **Reference date** | – |

---

### 40. date-fns

| Field | Value |
|------|--------|
| **FOSS Component Name** | date-fns |
| **Version** | 2.22.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © date-fns contributors |
| **License text** | [See License](./LICENSES.md#date-fns-2-22-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/date-fns/date-fns |
| **Source of supply** | https://www.npmjs.com/package/date-fns/v/2.22.1 |
| **Reference date** | – |

---

### 41. eslint

| Field | Value |
|------|--------|
| **FOSS Component Name** | eslint |
| **Version** | 8.20.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Nicholas C. Zakas |
| **License text** | [See License](./LICENSES.md#eslint-8-20-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/eslint/eslint |
| **Source of supply** | https://www.npmjs.com/package/eslint/v/8.20.0 |
| **Reference date** | – |

---

### 42. highcharts

| Field | Value |
|------|--------|
| **FOSS Component Name** | highcharts |
| **Version** | 11.0.1 |
| **FOSS License (exact name)** | Highsoft proprietary (see highcharts.com/license) |
| **Copyright information** | © Highsoft AS |
| **License text** | [See License](./LICENSES.md#highcharts-11-0-1) |
| **Author's notes** | Proprietary Highsoft charting library. |
| **Source code location** | https://github.com/highcharts/highcharts-dist |
| **Source of supply** | https://www.npmjs.com/package/highcharts/v/11.0.1 |
| **Reference date** | – |

---

### 43. highcharts-angular

| Field | Value |
|------|--------|
| **FOSS Component Name** | highcharts-angular |
| **Version** | 2.10.0 |
| **FOSS License (exact name)** | SEE LICENSE IN LICENSE |
| **Copyright information** | © Black Label |
| **License text** | [See License](./LICENSES.md#highcharts-angular-2-10-0) |
| **Author's notes** | Angular wrapper for Highcharts; see the Highcharts license. |
| **Source code location** | https://github.com/highcharts/highcharts-angular |
| **Source of supply** | https://www.npmjs.com/package/highcharts-angular/v/2.10.0 |
| **Reference date** | – |

---

### 44. immer

| Field | Value |
|------|--------|
| **FOSS Component Name** | immer |
| **Version** | 9.0.12 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Michel Weststrate |
| **License text** | [See License](./LICENSES.md#immer-9-0-12) |
| **Author's notes** | None |
| **Source code location** | https://github.com/immerjs/immer |
| **Source of supply** | https://www.npmjs.com/package/immer/v/9.0.12 |
| **Reference date** | – |

---

### 45. install

| Field | Value |
|------|--------|
| **FOSS Component Name** | install |
| **Version** | 0.13.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Ben Newman |
| **License text** | [See License](./LICENSES.md#install-0-13-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/benjamn/install |
| **Source of supply** | https://www.npmjs.com/package/install/v/0.13.0 |
| **Reference date** | – |

---

### 46. lodash.keyby

| Field | Value |
|------|--------|
| **FOSS Component Name** | lodash.keyby |
| **Version** | 4.6.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © John-David Dalton |
| **License text** | [See License](./LICENSES.md#lodash-keyby-4-6-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/lodash/lodash |
| **Source of supply** | https://www.npmjs.com/package/lodash.keyby/v/4.6.0 |
| **Reference date** | – |

---

### 47. memo-decorator

| Field | Value |
|------|--------|
| **FOSS Component Name** | memo-decorator |
| **Version** | 2.0.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Minko Gechev |
| **License text** | [See License](./LICENSES.md#memo-decorator-2-0-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/mgechev/memo-decorator |
| **Source of supply** | https://www.npmjs.com/package/memo-decorator/v/2.0.1 |
| **Reference date** | – |

---

### 48. nested-property

| Field | Value |
|------|--------|
| **FOSS Component Name** | nested-property |
| **Version** | 4.0.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Olivier Scherrer |
| **License text** | [See License](./LICENSES.md#nested-property-4-0-0) |
| **Author's notes** | None |
| **Source code location** | ssh://git@github.com/cosmosio/nested-property |
| **Source of supply** | https://www.npmjs.com/package/nested-property/v/4.0.0 |
| **Reference date** | – |

---

### 49. ngx-amvara-toolbox

| Field | Value |
|------|--------|
| **FOSS Component Name** | ngx-amvara-toolbox |
| **Version** | 0.0.17 |
| **FOSS License (exact name)** | UNKNOWN |
| **Copyright information** | © ngx-amvara-toolbox contributors |
| **License text** | [See License](./LICENSES.md#ngx-amvara-toolbox-0-0-17) |
| **Author's notes** | Internal Amvara Angular toolbox package; no license declared on the public npm registry. |
| **Source code location** | https://www.npmjs.com/package/ngx-amvara-toolbox |
| **Source of supply** | https://www.npmjs.com/package/ngx-amvara-toolbox/v/0.0.17 |
| **Reference date** | – |

---

### 50. ngx-clipboard

| Field | Value |
|------|--------|
| **FOSS Component Name** | ngx-clipboard |
| **Version** | 15.1.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Sam Lin |
| **License text** | [See License](./LICENSES.md#ngx-clipboard-15-1-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/maxisam/ngx-clipboard |
| **Source of supply** | https://www.npmjs.com/package/ngx-clipboard/v/15.1.0 |
| **Reference date** | – |

---

### 51. ngx-json-viewer

| Field | Value |
|------|--------|
| **FOSS Component Name** | ngx-json-viewer |
| **Version** | 3.2.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Vivo Xu |
| **License text** | [See License](./LICENSES.md#ngx-json-viewer-3-2-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/hivivo/ngx-json-viewer |
| **Source of supply** | https://www.npmjs.com/package/ngx-json-viewer/v/3.2.1 |
| **Reference date** | – |

---

### 52. ngx-network-error

| Field | Value |
|------|--------|
| **FOSS Component Name** | ngx-network-error |
| **Version** | 0.6.35-c |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © AMVARA CONSULTING S.L. |
| **License text** | [See License](./LICENSES.md#ngx-network-error-0-6-35-c) |
| **Author's notes** | None |
| **Source code location** | http://git.amvara.de/plugins/ngx-network-error |
| **Source of supply** | https://www.npmjs.com/package/ngx-network-error/v/0.6.35-c |
| **Reference date** | – |

---

### 53. npm

| Field | Value |
|------|--------|
| **FOSS Component Name** | npm |
| **Version** | 9.6.7 |
| **FOSS License (exact name)** | Artistic-2.0 |
| **Copyright information** | © GitHub Inc. |
| **License text** | [See License](./LICENSES.md#npm-9-6-7) |
| **Author's notes** | None |
| **Source code location** | https://github.com/npm/cli |
| **Source of supply** | https://www.npmjs.com/package/npm/v/9.6.7 |
| **Reference date** | – |

---

### 54. prettier

| Field | Value |
|------|--------|
| **FOSS Component Name** | prettier |
| **Version** | 3.2.5 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © James Long |
| **License text** | [See License](./LICENSES.md#prettier-3-2-5) |
| **Author's notes** | None |
| **Source code location** | https://github.com/prettier/prettier |
| **Source of supply** | https://www.npmjs.com/package/prettier/v/3.2.5 |
| **Reference date** | – |

---

### 55. socket.io

| Field | Value |
|------|--------|
| **FOSS Component Name** | socket.io |
| **Version** | 4.6.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © socket.io contributors |
| **License text** | [See License](./LICENSES.md#socket-io-4-6-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/socketio/socket.io |
| **Source of supply** | https://www.npmjs.com/package/socket.io/v/4.6.1 |
| **Reference date** | – |

---

### 56. socket.io-client

| Field | Value |
|------|--------|
| **FOSS Component Name** | socket.io-client |
| **Version** | 4.5.3 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © socket.io-client contributors |
| **License text** | [See License](./LICENSES.md#socket-io-client-4-5-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/socketio/socket.io-client |
| **Source of supply** | https://www.npmjs.com/package/socket.io-client/v/4.5.3 |
| **Reference date** | – |

---

### 57. tslib

| Field | Value |
|------|--------|
| **FOSS Component Name** | tslib |
| **Version** | 2.3.0 |
| **FOSS License (exact name)** | 0BSD |
| **Copyright information** | © Microsoft Corp. |
| **License text** | [See License](./LICENSES.md#tslib-2-3-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Microsoft/tslib |
| **Source of supply** | https://www.npmjs.com/package/tslib/v/2.3.0 |
| **Reference date** | – |

---

### 58. zone.js

| Field | Value |
|------|--------|
| **FOSS Component Name** | zone.js |
| **Version** | 0.11.5 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Brian Ford |
| **License text** | [See License](./LICENSES.md#zone-js-0-11-5) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/zone.js/v/0.11.5 |
| **Reference date** | – |

---

### 59. @angular-devkit/build-angular

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular-devkit/build-angular |
| **Version** | 15.2.8 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Angular Authors |
| **License text** | [See License](./LICENSES.md#angular-devkit-build-angular-15-2-8) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular-cli |
| **Source of supply** | https://www.npmjs.com/package/@angular-devkit/build-angular/v/15.2.8 |
| **Reference date** | – |

---

### 60. @angular/cli

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/cli |
| **Version** | 15.2.8 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Angular Authors |
| **License text** | [See License](./LICENSES.md#angular-cli-15-2-8) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular-cli |
| **Source of supply** | https://www.npmjs.com/package/@angular/cli/v/15.2.8 |
| **Reference date** | – |

---

### 61. @angular/common

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/common |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-common-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/common/v/15.2.9 |
| **Reference date** | – |

---

### 62. @angular/compiler-cli

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/compiler-cli |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @angular/compiler-cli contributors |
| **License text** | [See License](./LICENSES.md#angular-compiler-cli-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/compiler-cli/v/15.2.9 |
| **Reference date** | – |

---

### 63. @angular/core

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/core |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-core-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/core/v/15.2.9 |
| **Reference date** | – |

---

### 64. @angular/language-service

| Field | Value |
|------|--------|
| **FOSS Component Name** | @angular/language-service |
| **Version** | 15.2.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © angular |
| **License text** | [See License](./LICENSES.md#angular-language-service-15-2-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/angular/angular |
| **Source of supply** | https://www.npmjs.com/package/@angular/language-service/v/15.2.9 |
| **Reference date** | – |

---

### 65. @types/jasmine

| Field | Value |
|------|--------|
| **FOSS Component Name** | @types/jasmine |
| **Version** | 3.10.5 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @types/jasmine contributors |
| **License text** | [See License](./LICENSES.md#types-jasmine-3-10-5) |
| **Author's notes** | None |
| **Source code location** | https://github.com/DefinitelyTyped/DefinitelyTyped |
| **Source of supply** | https://www.npmjs.com/package/@types/jasmine/v/3.10.5 |
| **Reference date** | – |

---

### 66. @types/jasminewd2

| Field | Value |
|------|--------|
| **FOSS Component Name** | @types/jasminewd2 |
| **Version** | 2.0.9 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @types/jasminewd2 contributors |
| **License text** | [See License](./LICENSES.md#types-jasminewd2-2-0-9) |
| **Author's notes** | None |
| **Source code location** | https://github.com/DefinitelyTyped/DefinitelyTyped |
| **Source of supply** | https://www.npmjs.com/package/@types/jasminewd2/v/2.0.9 |
| **Reference date** | – |

---

### 67. @types/jquery

| Field | Value |
|------|--------|
| **FOSS Component Name** | @types/jquery |
| **Version** | 3.5.14 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @types/jquery contributors |
| **License text** | [See License](./LICENSES.md#types-jquery-3-5-14) |
| **Author's notes** | None |
| **Source code location** | https://github.com/DefinitelyTyped/DefinitelyTyped |
| **Source of supply** | https://www.npmjs.com/package/@types/jquery/v/3.5.14 |
| **Reference date** | – |

---

### 68. @types/node

| Field | Value |
|------|--------|
| **FOSS Component Name** | @types/node |
| **Version** | 15.14.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © @types/node contributors |
| **License text** | [See License](./LICENSES.md#types-node-15-14-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/DefinitelyTyped/DefinitelyTyped |
| **Source of supply** | https://www.npmjs.com/package/@types/node/v/15.14.0 |
| **Reference date** | – |

---

### 69. ajv

| Field | Value |
|------|--------|
| **FOSS Component Name** | ajv |
| **Version** | 6.12.6 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Evgeny Poberezkin |
| **License text** | [See License](./LICENSES.md#ajv-6-12-6) |
| **Author's notes** | None |
| **Source code location** | https://github.com/ajv-validator/ajv |
| **Source of supply** | https://www.npmjs.com/package/ajv/v/6.12.6 |
| **Reference date** | – |

---

### 70. jasmine-core

| Field | Value |
|------|--------|
| **FOSS Component Name** | jasmine-core |
| **Version** | 3.8.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © jasmine-core contributors |
| **License text** | [See License](./LICENSES.md#jasmine-core-3-8-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/jasmine/jasmine |
| **Source of supply** | https://www.npmjs.com/package/jasmine-core/v/3.8.0 |
| **Reference date** | – |

---

### 71. jasmine-spec-reporter

| Field | Value |
|------|--------|
| **FOSS Component Name** | jasmine-spec-reporter |
| **Version** | 7.0.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Bastien Caudan |
| **License text** | [See License](./LICENSES.md#jasmine-spec-reporter-7-0-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/bcaudan/jasmine-spec-reporter |
| **Source of supply** | https://www.npmjs.com/package/jasmine-spec-reporter/v/7.0.0 |
| **Reference date** | – |

---

### 72. karma

| Field | Value |
|------|--------|
| **FOSS Component Name** | karma |
| **Version** | 6.3.17 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Vojta Jína |
| **License text** | [See License](./LICENSES.md#karma-6-3-17) |
| **Author's notes** | None |
| **Source code location** | https://github.com/karma-runner/karma |
| **Source of supply** | https://www.npmjs.com/package/karma/v/6.3.17 |
| **Reference date** | – |

---

### 73. karma-chrome-launcher

| Field | Value |
|------|--------|
| **FOSS Component Name** | karma-chrome-launcher |
| **Version** | 3.1.1 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Vojta Jina |
| **License text** | [See License](./LICENSES.md#karma-chrome-launcher-3-1-1) |
| **Author's notes** | None |
| **Source code location** | https://github.com/karma-runner/karma-chrome-launcher |
| **Source of supply** | https://www.npmjs.com/package/karma-chrome-launcher/v/3.1.1 |
| **Reference date** | – |

---

### 74. karma-coverage-istanbul-reporter

| Field | Value |
|------|--------|
| **FOSS Component Name** | karma-coverage-istanbul-reporter |
| **Version** | 3.0.3 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Matt Lewis |
| **License text** | [See License](./LICENSES.md#karma-coverage-istanbul-reporter-3-0-3) |
| **Author's notes** | None |
| **Source code location** | https://github.com/mattlewis92/karma-coverage-istanbul-reporter |
| **Source of supply** | https://www.npmjs.com/package/karma-coverage-istanbul-reporter/v/3.0.3 |
| **Reference date** | – |

---

### 75. karma-jasmine

| Field | Value |
|------|--------|
| **FOSS Component Name** | karma-jasmine |
| **Version** | 4.0.2 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Vojta Jina |
| **License text** | [See License](./LICENSES.md#karma-jasmine-4-0-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/karma-runner/karma-jasmine |
| **Source of supply** | https://www.npmjs.com/package/karma-jasmine/v/4.0.2 |
| **Reference date** | – |

---

### 76. karma-jasmine-html-reporter

| Field | Value |
|------|--------|
| **FOSS Component Name** | karma-jasmine-html-reporter |
| **Version** | 1.6.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © karma-jasmine-html-reporter contributors |
| **License text** | [See License](./LICENSES.md#karma-jasmine-html-reporter-1-6-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/dfederm/karma-jasmine-html-reporter |
| **Source of supply** | https://www.npmjs.com/package/karma-jasmine-html-reporter/v/1.6.0 |
| **Reference date** | – |

---

### 77. rxjs

| Field | Value |
|------|--------|
| **FOSS Component Name** | rxjs |
| **Version** | 7.5.5 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Ben Lesh |
| **License text** | [See License](./LICENSES.md#rxjs-7-5-5) |
| **Author's notes** | None |
| **Source code location** | https://github.com/reactivex/rxjs |
| **Source of supply** | https://www.npmjs.com/package/rxjs/v/7.5.5 |
| **Reference date** | – |

---

### 78. snyk

| Field | Value |
|------|--------|
| **FOSS Component Name** | snyk |
| **Version** | 1.1087.0 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © snyk.io |
| **License text** | [See License](./LICENSES.md#snyk-1-1087-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/snyk/snyk |
| **Source of supply** | https://www.npmjs.com/package/snyk/v/1.1087.0 |
| **Reference date** | – |

---

### 79. ts-node

| Field | Value |
|------|--------|
| **FOSS Component Name** | ts-node |
| **Version** | 10.7.0 |
| **FOSS License (exact name)** | MIT |
| **Copyright information** | © Blake Embrey |
| **License text** | [See License](./LICENSES.md#ts-node-10-7-0) |
| **Author's notes** | None |
| **Source code location** | https://github.com/TypeStrong/ts-node |
| **Source of supply** | https://www.npmjs.com/package/ts-node/v/10.7.0 |
| **Reference date** | – |

---

### 80. tslint

| Field | Value |
|------|--------|
| **FOSS Component Name** | tslint |
| **Version** | 6.1.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © tslint contributors |
| **License text** | [See License](./LICENSES.md#tslint-6-1-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/palantir/tslint |
| **Source of supply** | https://www.npmjs.com/package/tslint/v/6.1.2 |
| **Reference date** | – |

---

### 81. typescript

| Field | Value |
|------|--------|
| **FOSS Component Name** | typescript |
| **Version** | 4.8.2 |
| **FOSS License (exact name)** | Apache-2.0 |
| **Copyright information** | © Microsoft Corp. |
| **License text** | [See License](./LICENSES.md#typescript-4-8-2) |
| **Author's notes** | None |
| **Source code location** | https://github.com/Microsoft/TypeScript |
| **Source of supply** | https://www.npmjs.com/package/typescript/v/4.8.2 |
| **Reference date** | – |

---
