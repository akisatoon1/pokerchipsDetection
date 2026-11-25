# Android の SDK, JDK, ビルドの版の場所を決める関数. scripts/ の Android のスクリプトが source して使う.
# 決め方を 1 か所にまとめ, スクリプトごとに違う SDK や版を使わないようにするため.
#
# source する前に ROOT (リポジトリのルート) を決めておく.

ANDROID_DIR="$ROOT/android"
ANDROID_LOCAL_PROPERTIES="$ANDROID_DIR/local.properties"
ANDROID_APP_GRADLE="$ANDROID_DIR/app/build.gradle.kts"
# Android Studio を /usr/local/android-studio に入れたときの JDK と, SDK の既定の場所.
DEFAULT_ANDROID_JAVA_HOME="/usr/local/android-studio/jbr"
DEFAULT_ANDROID_SDK_DIR="$HOME/Android/Sdk"

# 使う SDK の場所を出す. Gradle と同じく, local.properties の sdk.dir, ANDROID_HOME の順に見て,
# どちらもなければ Android Studio の既定の場所にする. ディレクトリがあるかは確かめない.
android_sdk_dir() {
  local sdk_dir=""
  if [ -f "$ANDROID_LOCAL_PROPERTIES" ]; then
    sdk_dir="$(sed -n 's/^sdk\.dir=//p' "$ANDROID_LOCAL_PROPERTIES")"
  fi
  if [ -z "$sdk_dir" ]; then
    sdk_dir="${ANDROID_HOME:-$DEFAULT_ANDROID_SDK_DIR}"
  fi
  echo "$sdk_dir"
}

# Gradle に使わせる JDK の場所を出す. JAVA_HOME が空なら Android Studio に入っている JDK にする.
android_java_home() {
  echo "${JAVA_HOME:-$DEFAULT_ANDROID_JAVA_HOME}"
}

# android/app/build.gradle.kts に書いた版を出す. 引数は compileSdk, minSdk, ndkVersion, version (CMake) のどれか.
# 版は build.gradle.kts にだけ書き, スクリプトに同じ数字を書かないため.
android_gradle_value() {
  local key="$1"
  local value
  value="$(sed -n -E "s/^ *$key = \"?([0-9.]+)\"?.*/\1/p" "$ANDROID_APP_GRADLE" | head -n 1)"
  if [ -z "$value" ]; then
    echo "$ANDROID_APP_GRADLE に $key がない" >&2
    return 1
  fi
  echo "$value"
}
