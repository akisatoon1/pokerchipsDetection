#!/usr/bin/env bash
# git clone したあとのセットアップを 1 本で行う. 何回流しても同じ結果になり, もうあるものは飛ばす.
# 途中で失敗しても, 直してから流し直せば続きから進む.
#
# 作るのは, リポジトリの中に置く git の管理外のものだけ.
#   Linux:   テスト画像 (Git LFS), OpenCV (third_party/), Python の環境 (.venv/), CLI (build/)
#   モデル:  models/chip_detector.onnx (重み (.pt) があれば書き出し, なければ GitHub Release から取る)
#   Android: OpenCV Android SDK (third_party/), android/local.properties
#   Web:     web/node_modules/, Emscripten と WASM 用の OpenCV (third_party/), 検出器 (web/src/client/public/detector/)
# マシンに入れるもの (apt のパッケージ, Android Studio と SDK, Node.js, gh) は入れず, あるかを確かめるだけにする.
# sudo や人の操作 (SDK のライセンスへの同意など) が要り, ほかのプロジェクトにも効くため.
#
# 使い方: scripts/setup.sh [--skip-android] [--skip-web]
#   PT に重み (.pt) のパスを入れると, モデルをそこから書き出す (既定: best.pt).
# 手順の説明は docs/environment/setup.md にある.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=lib/android.sh
source "$ROOT/scripts/lib/android.sh"

# OpenCV の版は core/CMakeLists.txt にだけ書き, 各スクリプトにも同じ版を渡す.
OPENCV_VERSION="$(sed -n -E 's/^set\(POKERCHIP_OPENCV_VERSION ([0-9.]+)\)/\1/p' core/CMakeLists.txt)"
export OPENCV_VERSION
PT="${PT:-best.pt}"
MODEL="models/chip_detector.onnx"
DOC="docs/environment/setup.md"

IS_ANDROID_ENABLED=true
IS_WEB_ENABLED=true
MISSING=()      # マシンに足りないものと, その入れ方
APT_PACKAGES=() # 足りないもののうち, apt で入るもの

usage() {
  echo "使い方: scripts/setup.sh [--skip-android] [--skip-web]" >&2
  echo "  --skip-android  Android アプリのビルドの用意をしない" >&2
  echo "  --skip-web      Web アプリと, ブラウザでの検出 (WASM) の用意をしない" >&2
  echo "  PT=<path>       モデルを書き出す重み (既定: best.pt. なければ GitHub Release から取る)" >&2
}

parse_args() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --skip-android) IS_ANDROID_ENABLED=false ;;
      --skip-web) IS_WEB_ENABLED=false ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "知らない引数: $arg" >&2
        usage
        exit 1
        ;;
    esac
  done
}

# 足りないものを覚えておく. $1: 何が足りないか, $2: どう入れるか.
add_missing() {
  MISSING+=("$1. $2")
}

# コマンドがなければ, apt のパッケージを足りないものに足す. $1: コマンド, $2: それが入る apt のパッケージ.
require_apt_command() {
  if ! command -v "$1" > /dev/null; then
    add_missing "$1 がない" "apt の $2 に入っている"
    APT_PACKAGES+=("$2")
  fi
}

check_linux_prerequisites() {
  require_apt_command git git
  require_apt_command git-lfs git-lfs
  require_apt_command cmake cmake
  require_apt_command make build-essential
  require_apt_command c++ build-essential
  require_apt_command curl curl
  require_apt_command unzip unzip
  require_apt_command pkg-config pkg-config
  require_apt_command clang-format clang-format
  require_apt_command clang-tidy clang-tidy
  require_apt_command python3 python3
  # GTK がないと, OpenCV が画面表示 (imshow, 手で ROI を選ぶ) なしでビルドされてしまうので, ビルドの前に確かめる.
  if command -v pkg-config > /dev/null && ! pkg-config --exists gtk+-3.0; then
    add_missing "GTK 3 の開発用のファイルがない" "apt の libgtk-3-dev に入っている"
    APT_PACKAGES+=(libgtk-3-dev)
  fi
  if command -v python3 > /dev/null && ! python3 -c 'import ensurepip' 2> /dev/null; then
    add_missing "Python の venv が作れない" "apt の python3-venv に入っている"
    APT_PACKAGES+=(python3-venv)
  fi
  if ! git config --get filter.lfs.process > /dev/null; then
    add_missing "Git LFS が git に組み込まれていない" "git lfs install を 1 回流す"
  fi
}

# $1 のディレクトリ (版が付いた名前は, 版の後ろに .0 などが付いてもよい) がなければ, 足りないものに足す.
require_sdk_package() {
  if [ ! -d "$1" ] && ! compgen -G "$1.*" > /dev/null; then
    add_missing "$2 がない ($1)" "Android Studio の SDK Manager で入れる"
  fi
}

check_android_prerequisites() {
  local java_home sdk_dir
  java_home="$(android_java_home)"
  if [ ! -x "$java_home/bin/java" ]; then
    add_missing "JDK がない ($java_home)" "Android Studio を入れる. 別の場所の JDK なら JAVA_HOME に入れる"
  fi
  sdk_dir="$(android_sdk_dir)"
  if [ ! -d "$sdk_dir" ]; then
    add_missing "Android SDK がない ($sdk_dir)" "Android Studio の初回のウィザードで入れる. 別の場所なら ANDROID_HOME に入れる"
    return
  fi
  require_sdk_package "$sdk_dir/platforms/android-$(android_gradle_value compileSdk)" "SDK Platform"
  require_sdk_package "$sdk_dir/ndk/$(android_gradle_value ndkVersion)" "NDK"
  require_sdk_package "$sdk_dir/cmake/$(android_gradle_value version)" "CMake (SDK Tools)"
}

check_web_prerequisites() {
  local node_major
  # package.json の engines の版 (">=24 <25" の 24) に合わせる.
  node_major="$(sed -n -E 's/.*"node": ">=([0-9]+).*/\1/p' web/package.json)"
  if ! command -v node > /dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != "$node_major" ]; then
    add_missing "Node.js $node_major がない" "公式の tarball を入れる"
  fi
}

# モデルを Release から取るときだけ gh が要る. 重みもモデルもあるなら要らない.
check_model_prerequisites() {
  if [ -f "$MODEL" ] || [ -f "$PT" ]; then
    return
  fi
  if ! command -v gh > /dev/null || ! gh auth status > /dev/null 2>&1; then
    add_missing "モデルを GitHub Release から取るのに gh のログインが要る" \
      "gh を入れて gh auth login を流す. または重み (.pt) を $PT に置く"
  fi
}

# 足りないものがあれば, すべてと入れ方を出して止める. 1 つずつ止めると, 何度も流し直すことになるため.
stop_if_missing() {
  if [ ${#MISSING[@]} -eq 0 ]; then
    return
  fi
  echo "マシンに入っていないものがある. 入れてから, もう一度流す (入れ方は $DOC の「1. マシンに 1 回だけ入れるもの」):" >&2
  local item
  for item in "${MISSING[@]}"; do
    echo "  - $item" >&2
  done
  if [ ${#APT_PACKAGES[@]} -gt 0 ]; then
    echo "apt で入るものは, まとめて次で入る:" >&2
    echo "  sudo apt install $(printf '%s\n' "${APT_PACKAGES[@]}" | sort -u | tr '\n' ' ')" >&2
  fi
  exit 1
}

step() {
  echo
  echo "== $1"
}

# $1 があれば飛ばし, なければ残りの引数のコマンドで作る.
create_unless_exists() {
  local result="$1"
  shift
  if [ -e "$result" ]; then
    echo "もうあるので飛ばす: $result"
    return
  fi
  "$@"
}

setup_linux() {
  step "Linux: テスト画像 (Git LFS)"
  git lfs pull
  step "Linux: OpenCV $OPENCV_VERSION"
  create_unless_exists "third_party/opencv-$OPENCV_VERSION/lib/cmake/opencv4/OpenCVConfig.cmake" scripts/build_opencv.sh
  step "Linux: Python の環境 (.venv/)"
  create_unless_exists .venv python3 -m venv .venv
  # requirements.txt が変わったときにも追いつくよう, 毎回流す. 入っているものは飛ばされる.
  .venv/bin/pip install -r pyscript/requirements.txt
  step "Linux: CLI"
  make build
}

setup_model() {
  step "モデル ($MODEL)"
  if [ -f "$MODEL" ]; then
    echo "もうあるので飛ばす: $MODEL"
  elif [ -f "$PT" ]; then
    scripts/export_model.sh "$PT"
  else
    scripts/fetch_model.sh
  fi
}

write_local_properties() {
  echo "sdk.dir=$(android_sdk_dir)" > "$ANDROID_LOCAL_PROPERTIES"
  echo "SDK の場所を $ANDROID_LOCAL_PROPERTIES に書いた"
}

setup_android() {
  step "Android: OpenCV Android SDK $OPENCV_VERSION"
  scripts/fetch_android_deps.sh
  step "Android: SDK の場所 (android/local.properties)"
  # Gradle と Android Studio が SDK を探すのに使う. Android Studio で開いたときにも作られる.
  create_unless_exists "$ANDROID_LOCAL_PROPERTIES" write_local_properties
}

install_web_packages() {
  (cd web && npm ci)
}

setup_web() {
  step "Web: npm のパッケージ (web/node_modules/)"
  create_unless_exists web/node_modules install_web_packages
  step "Web: Emscripten"
  # 版の確かめと, 版を上げたときの取り直しは fetch_emsdk.sh が行うので, 毎回流す.
  scripts/fetch_emsdk.sh
  step "Web: WASM 用の OpenCV $OPENCV_VERSION"
  create_unless_exists "third_party/opencv-$OPENCV_VERSION-wasm/lib/cmake/opencv4/OpenCVConfig.cmake" \
    scripts/build_opencv_wasm.sh
  step "Web: 検出器 (core の WASM とモデル)"
  create_unless_exists web/src/client/public/detector/pokerchip-core.wasm scripts/build_wasm.sh
}

main() {
  parse_args "$@"
  check_linux_prerequisites
  check_model_prerequisites
  if $IS_ANDROID_ENABLED; then check_android_prerequisites; fi
  if $IS_WEB_ENABLED; then check_web_prerequisites; fi
  stop_if_missing

  setup_linux
  setup_model
  if $IS_ANDROID_ENABLED; then setup_android; fi
  if $IS_WEB_ENABLED; then setup_web; fi

  echo
  echo "セットアップが終わった. 動くかは $DOC の「3. 動くか確かめる」で確かめる."
}

main "$@"
