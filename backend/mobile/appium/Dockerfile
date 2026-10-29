# Use the official Ubuntu image as the base image
FROM ubuntu:24.10

# Set the environment variables to prevent interaction during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update the package list and install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    software-properties-common \
    build-essential \
    curl procps supervisor \
    && apt-get clean

# Node.js 22.23.4 (21 Oct 2026 security release). Node 20 from NodeSource is EOL.
ARG NODE_VERSION=22.23.4
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
         amd64) node_arch=x64 ;; \
         arm64) node_arch=arm64 ;; \
         *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm -f /tmp/node.tar.xz \
    && node -e "if(process.versions.node!=='${NODE_VERSION}') process.exit(1)" \
    && npm -v

# Install OpenJDK (Java)
RUN apt-get install -y openjdk-11-jre \
    && apt-get clean

# Set environment variables for Java
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

# Verify installations
RUN node -v && npm -v 

# Install Appium
RUN npm i --location=global appium

# Install UIautomator2 driver to automation GUI application of Android
RUN appium driver install uiautomator2

# Set the default working directory
WORKDIR /app

# Make a logs directory
RUN mkdir -p /logs

# Copy the current directory contents into the container at /app
COPY . /app

# Expose the necessary Appium port
EXPOSE 4723

# Run ollama when the container launches
CMD ["supervisord", "-c", "/app/supervisor/supervisord.conf"]
