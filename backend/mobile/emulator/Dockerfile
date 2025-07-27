# Base image with Node.js, Appium, etc.
FROM cometa/appium

USER root

# Environment variables for Android SDK
ENV ANDROID_HOME=/root/android-sdk
ENV ANDROID_SDK_ROOT=/root/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin

# Android SDK Command Line Tools ZIP version
ENV CMDLINE_TOOLS_ZIP=commandlinetools-linux-8512546_latest.zip
ENV CMDLINE_TOOLS_DIR=$ANDROID_HOME/cmdline-tools

# Install dependencies
RUN apt-get update && \
    apt-get install -y wget unzip openjdk-11-jdk \
    lib32stdc++6 lib32z1 qemu-kvm \
    libvirt-daemon-system libvirt-clients bridge-utils \
    x11vnc xvfb fluxbox novnc websockify \
    git ffmpeg jq xterm && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Download and install command line tools
RUN mkdir -p ${CMDLINE_TOOLS_DIR} && \
    cd ${CMDLINE_TOOLS_DIR} && \
    wget https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP} -O tools.zip && \
    unzip tools.zip -d ./ && \
    mv cmdline-tools latest && \
    rm tools.zip

# Install emulator, platform tools, system image and build tools
ARG API_LEVEL=34
ARG ARCH=x86_64
ARG TARGET=google_apis
ARG BUILD_TOOLS=34.0.0
ARG PLATFORM_VERSION=android-${API_LEVEL}
ARG SYSTEM_IMAGE="system-images;${PLATFORM_VERSION};${TARGET};${ARCH}"
ARG PLATFORM="platforms;${PLATFORM_VERSION}"
ARG BUILD_TOOLS_PKG="build-tools;${BUILD_TOOLS}"


RUN yes | sdkmanager --licenses && \
    sdkmanager --sdk_root=${ANDROID_HOME} --no_https \
      "platform-tools" \
      "emulator" \
      "${PLATFORM}" \
      "${SYSTEM_IMAGE}" \
      "${BUILD_TOOLS_PKG}"

# Set working directory
WORKDIR /app

# Copy your project files including start.sh, supervisor, etc.
COPY . /app

# Make sure start.sh is executable
RUN chmod +x /app/start.sh
RUN chmod +x /app/scripts/video_recorder.sh

# Expose ports (VNC, noVNC)
EXPOSE 6080 5900

# Entry point is still supervisord (optional — can override with CMD)
ENTRYPOINT ["supervisord", "-c", "/app/supervisor/supervisord.conf"]
