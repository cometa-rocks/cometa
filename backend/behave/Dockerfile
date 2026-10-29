# Use Python 3.11 base image from the Docker Hub
# Slim base. python:3.11 carries the compiler toolchain and is the main
# reason a behave image lands near 5 GB. Runtime packages are installed below.
FROM python:3.11-slim AS builder

LABEL AUTHOR="COMETA ROCKS S.L."

# SHELL ["/bin/bash", "-c"]
USER root

# Install necessary packages
RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update && apt-get install --no-install-recommends -y \
    rsyslog \
    vim \
    jq \
    nano \
    telnet \
    supervisor \
    psmisc \
    libgl1 \
    libglib2.0-0 \
    curl \
    ca-certificates \
    gnupg \
    && apt-get purge -y --auto-remove exim* \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get purge -y exim*
# Update pip
RUN python -m pip install --upgrade pip

# Install MSSQL related library
# 1. Clean up any broken repo files
RUN rm -f /etc/apt/sources.list.d/mssql-release.list

# 2. Import Microsoft’s GPG key (new method, no apt-key warnings)
RUN curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
  | gpg --dearmor \
  | tee /usr/share/keyrings/microsoft-prod.gpg > /dev/null

# 3. Add Microsoft SQL Server ODBC repo (use Debian 11, works on Debian 12 too)
# TODO: Check if this is the correct version of Debian
RUN echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/11/prod bullseye main" \
  > /etc/apt/sources.list.d/mssql-release.list
# 4. Update apt and install ODBC driver
RUN apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev




RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update && apt-get install -y \
    unixodbc \
    unixodbc-dev \
    odbcinst \
    curl \
    gnupg2 \
    && rm -rf /var/lib/apt/lists/*
# Create a non-root user 'cometa' with UID 472 and GID 472
RUN groupadd -g 1472 cometa \
&& useradd -u 1472 -g cometa -d /home/cometa -s /bin/bash cometa

RUN usermod -aG sudo cometa
    

# Create necessary directories with appropriate ownership and permissions
RUN mkdir -p /etc/supervisor/conf.d
RUN mkdir -p /opt/code 
RUN mkdir -p /code
RUN mkdir -p /share
RUN mkdir -p /dev/log
RUN mkdir -p /code/behave/screenshots
RUN mkdir -p /code/behave/videos
RUN mkdir -p /code/behave/pdf
RUN mkdir -p /data/test/downloads
RUN mkdir -p /code/behave/department_data
RUN mkdir -p /opt/code/behave_logs
RUN mkdir -p /home/cometa

RUN chown -R cometa:cometa /code
RUN chown -R cometa:cometa /opt/code/behave_logs
RUN chown -R cometa:cometa /share
RUN chown -R cometa:cometa /opt/code
RUN chown -R cometa:cometa /home/cometa
RUN chown -R cometa:cometa /usr/local/
RUN chown -R cometa:cometa /var/log/
# RUN chown -R cometa:cometa /dev/log
RUN chown -R cometa:cometa /var/run
RUN chown -R cometa:cometa /etc/rsyslog.d
# RUN chown -R cometa:cometa /proc/kmsg
RUN chown -R cometa:cometa /etc/supervisor
RUN chown -R cometa:cometa /var/log/supervisor/


RUN chmod -R 755 /code 
RUN chmod -R 755 /opt/code/behave_logs
RUN chmod -R 755 /share
RUN chmod -R 755 /opt/code 
# RUN chmod -R 755 /proc/kmsg 
RUN chmod -R 755 /var/run 
RUN chmod -R 755 /var/log/supervisor/ 
RUN chmod -R 755 /usr/local/lib/python3.11/ || true
# RUN chmod -R 755 /usr/local/bin/chardetect/

# RUN rsyslogd -n

# Set the working directory
WORKDIR /code/behave

COPY --chown=cometa:cometa ./supervisord.conf /etc/supervisor/supervisord.conf
COPY --chown=cometa:cometa . /opt/code

WORKDIR /opt/code
# Switch to non-root user
USER cometa

# Update file permissions
RUN chmod -R 755 /opt/code

# Build Python dependencies, then drop the compilers, Poetry, and pip cache.
# cx-oracle 8.3.0 imports pkg_resources during its build. setuptools>=82
# removed that module, so pin setuptools 78 and install without build isolation.
USER root
ENV PATH="/root/.local/bin:$PATH"
RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update -y \
    && apt-get install -y --no-install-recommends \
        gcc g++ make python3-dev libssl-dev openssl \
        pkg-config default-libmysqlclient-dev libmariadb3 \
        libpq-dev libpq5 \
    && python3 -m pip install --no-cache-dir --upgrade pip "setuptools==78.1.0" wheel \
    && curl -sSL https://install.python-poetry.org | python3 - \
    && poetry config virtualenvs.create false \
    && (poetry export --without-hashes -f requirements.txt -o /tmp/requirements.txt \
        || (poetry self add poetry-plugin-export \
            && poetry export --without-hashes -f requirements.txt -o /tmp/requirements.txt)) \
    && python3 -m pip install --no-cache-dir --no-build-isolation -r /tmp/requirements.txt \
    && python3 -m pip install --no-cache-dir behave \
    && rm -rf /tmp/requirements.txt /root/.cache /root/.local /home/cometa/.cache \
    && apt-get purge -y gcc g++ make python3-dev pkg-config default-libmysqlclient-dev libpq-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Playwright 1.51.0 bundles Node.js 22.14.0. No Playwright release through
# 1.64.1 (14 Oct 2026) ships a driver on the patched lines
# (22.23.4 / 24.22.1 / 26.12.1). Keep only the node binary, not the SDK.
ARG PLAYWRIGHT_NODE_VERSION=22.23.4
ENV PLAYWRIGHT_NODEJS_PATH=/opt/node/bin/node
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends xz-utils; \
    rm -rf /var/lib/apt/lists/*; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) node_arch=x64 ;; \
      arm64) node_arch=arm64 ;; \
      *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://nodejs.org/dist/v${PLAYWRIGHT_NODE_VERSION}/node-v${PLAYWRIGHT_NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
    mkdir -p /tmp/node-extract /opt/node/bin; \
    tar -xJf /tmp/node.tar.xz -C /tmp/node-extract --strip-components=1; \
    cp -a /tmp/node-extract/bin/node /opt/node/bin/node; \
    rm -rf /tmp/node-extract /tmp/node.tar.xz; \
    /opt/node/bin/node -e "const v=process.versions; if(v.node!=='${PLAYWRIGHT_NODE_VERSION}') { console.error(v); process.exit(1); } console.log(JSON.stringify({node:v.node,openssl:v.openssl,ares:v.ares,undici:v.undici}))"; \
    driver_node="$(find /usr /opt /home -path '*/playwright/driver/node' -type f -print -quit)"; \
    test -n "$driver_node"; \
    cp -a /opt/node/bin/node "$driver_node"; \
    chmod 755 "$driver_node" /opt/node/bin/node; \
    "$driver_node" -e "if(process.versions.node!=='${PLAYWRIGHT_NODE_VERSION}') process.exit(1)"; \
    python3 -c "import os; from playwright._impl._driver import compute_driver_executable; node, cli = compute_driver_executable(); assert node==os.environ['PLAYWRIGHT_NODEJS_PATH'], node; print(node)"; \
    chown -R cometa:cometa /opt/node; \
    apt-get purge -y xz-utils; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

USER root
# Playwright ships its own Node 22.14.0 binary (~120 MB). The image already
# runs the patched binary via PLAYWRIGHT_NODEJS_PATH, so the bundled copy
# is removed before the filesystem is flattened into one layer.
RUN find /usr/local -path '*/playwright/driver/node' -type f -delete
RUN chmod +x /opt/code/behave_django/start_pod.sh /opt/code/run_remote_from_django.sh

FROM scratch
COPY --from=builder / /
ENV PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin \
    LANG=C.UTF-8 \
    PYTHON_VERSION=3.11.18 \
    PLAYWRIGHT_NODEJS_PATH=/opt/node/bin/node
USER cometa
WORKDIR /opt/code/behave_django
ENTRYPOINT ["/bin/sh", "-c", "/opt/code/behave_django/start_pod.sh"]


# build image for arm and amd processors 
# docker buildx build  --platform linux/amd64,linux/arm64 -t cometa/behave:latest --push .
# version used for kubernetes development 
# docker build -t cometa/behave:0.1 --push .

# version used for kubernetes deployment 
# docker build -t cometa/behave:1.1 --push .