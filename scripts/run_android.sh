#!/usr/bin/env bash
# Android Studio を開かずに, アプリをビルドして USB で繋いだ端末に入れ, 起動する.
# Android Studio の「Run」と同じことをする.
#
# 使い方: scripts/run_android.sh
#   端末が複数繋がっているときは, ANDROID_SERIAL に `adb devices` の番号を入れて 1 台を選ぶ.
#   (ANDROID_SERIAL は adb と Gradle の installDebug の両方が見る)
#   JAVA_HOME が空なら, Android Studio に入っている JDK を使う.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
# android/app/build.gradle.kts の applicationId と, AndroidManifest.xml の起動する Activity.
APP_ID="com.pokerchip.app"
MAIN_ACTIVITY=".MainActivity"
DEFAULT_JAVA_HOME="/usr/local/android-studio/jbr"

# adb は PATH から探し, なければ android/local.properties の sdk.dir の下を使う.
# PATH を通していなくても, Android Studio が作った SDK の場所から見つけられるようにするため.
find_adb() {
  if command -v adb > /dev/null; then
    command -v adb
    return
  fi
  local sdk_dir
  sdk_dir="$(sed -n 's/^sdk\.dir=//p' "$ANDROID_DIR/local.properties" 2> /dev/null || true)"
  if [ -n "$sdk_dir" ] && [ -x "$sdk_dir/platform-tools/adb" ]; then
    echo "$sdk_dir/platform-tools/adb"
    return
  fi
  echo "adb が見つからない. docs/environment/setup.md の 8 の 5 で PATH を通す." >&2
  exit 1
}

# 入れる先の端末が 1 台に決まるかを確かめる. 決まらなければ理由を出して止める.
check_device() {
  local adb="$1"
  if [ -n "${ANDROID_SERIAL:-}" ]; then
    if [ "$("$adb" -s "$ANDROID_SERIAL" get-state 2> /dev/null || true)" != "device" ]; then
      echo "ANDROID_SERIAL=$ANDROID_SERIAL の端末が使えない. \`adb devices\` で確かめる." >&2
      exit 1
    fi
    return
  fi
  local devices
  devices="$("$adb" devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
  if [ -z "$devices" ]; then
    echo "使える端末がない. USB で繋ぎ, USB デバッグを許可したか \`adb devices\` で確かめる." >&2
    echo "(unauthorized と出るなら, 端末の画面で USB デバッグを許可する)" >&2
    exit 1
  fi
  if [ "$(echo "$devices" | wc -l)" -gt 1 ]; then
    echo "端末が複数繋がっている. ANDROID_SERIAL で 1 台を選ぶ:" >&2
    echo "$devices" >&2
    exit 1
  fi
}

ADB="$(find_adb)"
check_device "$ADB"
export JAVA_HOME="${JAVA_HOME:-$DEFAULT_JAVA_HOME}"

(cd "$ANDROID_DIR" && ./gradlew installDebug)
"$ADB" shell am start -n "$APP_ID/$MAIN_ACTIVITY"
