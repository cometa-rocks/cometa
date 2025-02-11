# Base image
# Thanks to https://github.com/amrsa1/Android-Emulator-image

FROM cometa/appium

# Create a non-root user `cometa`
RUN useradd -ms /bin/bash cometa

# set directory for sdk 
WORKDIR /home/cometa/android-sdk

# Environment variables for Android SDK
ENV ANDROID_HOME /home/cometa/android-sdk
ENV ANDROID_SDK_ROOT /home/cometa/android-sdk
ENV COMMAND_LINE_TOOLS $ANDROID_SDK_ROOT/cmdline-tools/tools
ENV ANDROID_COMMAND_LINE_TOOLS="commandlinetools-linux-8512546_latest.zip"

# Install necessary dependencies
RUN apt-get update && \
    apt-get install -y wget unzip lib32stdc++6 lib32z1 libvirt-daemon-system libvirt-clients bridge-utils lib32stdc++6 lib32z1 \
    qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils \
    x11vnc xvfb fluxbox websockify git ffmpeg jq && \
    apt-get clean

ENV COMMAND_LINE_TOOLS $ANDROID_SDK_ROOT/cmdline-tools
# Install Android SDK
RUN mkdir -p $COMMAND_LINE_TOOLS && \
    cd $COMMAND_LINE_TOOLS && \
    echo $COMMAND_LINE_TOOLS && \
    wget https://dl.google.com/android/repository/${ANDROID_COMMAND_LINE_TOOLS} -O tools.zip && \
    unzip tools.zip -d $COMMAND_LINE_TOOLS && \
    mv $COMMAND_LINE_TOOLS/cmdline-tools/ $COMMAND_LINE_TOOLS/tools && \
    ls -al $COMMAND_LINE_TOOLS && \
    rm tools.zip && \
    ls -al $COMMAND_LINE_TOOLS && \
    cd -

ENV PATH $PATH:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/tools:$ANDROID_SDK_ROOT/tools/bin:$ANDROID_SDK_ROOT/platform-tools:$COMMAND_LINE_TOOLS/tools/bin

RUN echo ${ARCH}
RUN echo ${TARGET}
RUN echo ${API_LEVEL}
RUN echo ${BUILD_TOOLS}
RUN echo ${ANDROID_API_LEVEL}

ARG ARCH="x86_64" 
ARG TARGET="google_apis"  
ARG API_LEVEL="31" 
ARG BUILD_TOOLS="34.0.0"
ARG ANDROID_API_LEVEL="android-${API_LEVEL}"
ARG ANDROID_APIS="${TARGET};${ARCH}"
ARG EMULATOR_PACKAGE="system-images;${ANDROID_API_LEVEL};${ANDROID_APIS}"
ARG PLATFORM_VERSION="platforms;${ANDROID_API_LEVEL}"
ARG BUILD_TOOL="build-tools;${BUILD_TOOLS}"
ARG ANDROID_SDK_PACKAGES="${EMULATOR_PACKAGE} ${PLATFORM_VERSION} ${BUILD_TOOL} platform-tools emulator"

RUN echo ${ARCH}
RUN echo ${TARGET}
RUN echo ${API_LEVEL}
RUN echo ${BUILD_TOOLS}
RUN echo ${ANDROID_API_LEVEL}

# Set up Android SDK
RUN yes | sdkmanager --sdk_root=${ANDROID_HOME} --licenses
# Download the required tools SDK
RUN yes Y | sdkmanager --sdk_root=${ANDROID_HOME} --verbose --no_https ${ANDROID_SDK_PACKAGES} 

# RUN sdkmanager --sdk_root=${ANDROID_HOME} "platform-tools" "$PLATFORM_VERSION" "system-images;$ANDROID_API_LEVEL;google_apis;x86_64" "emulator"

ARG EMULATOR_NAME="nexus"
ARG EMULATOR_DEVICE="Nexus 6"
ENV EMULATOR_NAME=${EMULATOR_NAME}
ENV DEVICE_NAME=${EMULATOR_DEVICE}
ENV ANDROID_API_LEVEL=${ANDROID_API_LEVEL}
ENV TARGET=${TARGET}
ENV ARCH=${ARCH}
# Create AVD
RUN echo "no" | avdmanager create avd --force --name "${EMULATOR_NAME}" --device "${EMULATOR_DEVICE}" --package "${EMULATOR_PACKAGE}" 

WORKDIR /root/.android/avd/${EMULATOR_NAME}.avd

RUN ls -al

# RUN sed -i '/hw.ramSize/d;s/^$/hw.ramSize=4096/g' /root/.android/avd/${EMULATOR_NAME}.avd/config.ini
# Remove any line containing hw.ramSize
RUN sed -i '/^hw\.ramSize/d' "/root/.android/avd/${EMULATOR_NAME}.avd/config.ini"

# Add the new hw.ramSize line
RUN echo "hw.ramSize = 2048" >> "/root/.android/avd/${EMULATOR_NAME}.avd/config.ini"

# Copy the current directory contents into the container at /app
COPY . /app
RUN ls /app

# Expose ports needed by the emulator
EXPOSE 5900 

RUN chmod +x /app/scripts/video_recorder.sh

# Run supervisord when the container launches
ENTRYPOINT ["supervisord", "-c", "/app/supervisor/supervisord.conf"]

