#!/bin/bash
# For better uses refer to https://github.com/cometa-rocks/cometa_documentation/blob/main/docs/admin/Custom_Mobile_Emulator_Start.md
# Author: Anand Kushwaha
# Date: 2025-07-16

# Example:
# ./start.sh --emulator_name="Cometa_Test_Emulator_1" --device=Nexus 6 --api_level=34 \
# --arch=x86_64 --screen_size=1080x1920 --theme=light --gpu=swiftshader_indirect

set -e

# Helper: read CLI arg or fallback to env or default
get_arg() {
  local name="$1"
  local default="$2"
  shift
  for arg in "$@"; do
    if [[ "$arg" == --$name=* ]]; then
      echo "${arg#*=}"
      return
    fi
  done
  eval echo "\${$name:-$default}"
}

# Read config by priority: CLI > ENV > Default
EMULATOR_NAME=$(get_arg "emulator_name" "Cometa_Test_Emulator_1" "$@")
DEVICE=$(get_arg "device" "pixel_3" "$@")
API_LEVEL=$(get_arg "api_level" "34" "$@")
TARGET=$(get_arg "target" "google_apis" "$@")
ARCH=$(get_arg "arch" "x86_64" "$@")
SCREEN_SIZE=$(get_arg "screen_size" "	1080x1920" "$@")
THEME=$(get_arg "theme" "light" "$@")
GPU_MODE=$(get_arg "gpu" "swiftshader_indirect" "$@")  # one of: host, swiftshader, swiftshader_indirect, off

PACKAGE="system-images;android-${API_LEVEL};${TARGET};${ARCH}"

echo "Creating AVD:"
echo "  Name        : $EMULATOR_NAME"
echo "  Device      : $DEVICE"
echo "  API Level   : $API_LEVEL"
echo "  Target      : $TARGET"
echo "  Arch        : $ARCH"
echo "  Screen Size : $SCREEN_SIZE"
echo "  Theme       : $THEME"
echo "  GPU Mode    : $GPU_MODE"

# Accept all licenses
yes | sdkmanager --licenses

# Install required SDK packages
sdkmanager "${PACKAGE}" "platforms;android-${API_LEVEL}" "emulator" --sdk_root=${ANDROID_HOME}

# Create AVD if not exists
if ! avdmanager list avd | grep -q "${EMULATOR_NAME}"; then
  echo "no" | avdmanager create avd -n "${EMULATOR_NAME}" -k "${PACKAGE}" -d "${DEVICE}" --force
fi

# Path to config.ini
AVD_CONFIG="$HOME/.android/avd/${EMULATOR_NAME}.avd/config.ini"

# Set screen size and theme
if [ -f "$AVD_CONFIG" ]; then
  sed -i "/^hw\.lcd\.width/d" "$AVD_CONFIG"
  sed -i "/^hw\.lcd\.height/d" "$AVD_CONFIG"
  sed -i "/^skin\.name/d" "$AVD_CONFIG"
  sed -i "/^hw\.ui\.mode/d" "$AVD_CONFIG"
  sed -i "/^hw\.mainKeys/d" "$AVD_CONFIG"
  sed -i "/^hw\.theme/d" "$AVD_CONFIG"

  WIDTH=$(echo "$SCREEN_SIZE" | cut -d'x' -f1)
  HEIGHT=$(echo "$SCREEN_SIZE" | cut -d'x' -f2)

  echo "hw.lcd.width=${WIDTH}" >> "$AVD_CONFIG"
  echo "hw.lcd.height=${HEIGHT}" >> "$AVD_CONFIG"
  echo "skin.name=${WIDTH}x${HEIGHT}" >> "$AVD_CONFIG"
  echo "hw.theme=${THEME}" >> "$AVD_CONFIG"
fi


LOGFILE=/tmp/emulator.log
# Start emulator with selected GPU mode
echo "Starting emulator with -gpu ${GPU_MODE} ..."

# Start emulator in background
emulator -avd "${EMULATOR_NAME}" -no-snapshot -no-audio -gpu "${GPU_MODE}" > "$LOGFILE" 2>&1 &

# Tail logs to STDOUT to keep container active and emit logs
tail -F "$LOGFILE"