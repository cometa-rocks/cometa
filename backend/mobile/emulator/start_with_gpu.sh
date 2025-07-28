#!/bin/bash

set -e

# Default values
EMULATOR_NAME=${1:-test-nexus}
DEVICE=${2:-"Nexus 6"}
API_LEVEL=${3:-34}
TARGET=${4:-google_apis}
ARCH=${5:-x86_64}

PACKAGE="system-images;android-${API_LEVEL};${TARGET};${ARCH}"

echo "Creating AVD: $EMULATOR_NAME"
echo "Device: $DEVICE"
echo "API Level: $API_LEVEL"
echo "Target: $TARGET"
echo "Arch: $ARCH"

# Accept all licenses
yes | sdkmanager --licenses

# Install system image if not present
sdkmanager "${PACKAGE}" "platforms;android-${API_LEVEL}" "emulator" --sdk_root=${ANDROID_HOME}

# Create AVD if it doesn't exist
if ! avdmanager list avd | grep -q "${EMULATOR_NAME}"; then
  echo "no" | avdmanager create avd -n "${EMULATOR_NAME}" -k "${PACKAGE}" -d "${DEVICE}" --force
fi

# Start emulator
# emulator -avd "${EMULATOR_NAME}" -no-snapshot -no-audio -no-boot-anim -gpu swiftshader_indirect

emulator -avd "${EMULATOR_NAME}" -no-snapshot -no-audio -no-boot-anim -gpu swiftshader_indirect