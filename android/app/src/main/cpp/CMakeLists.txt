# Android 用のネイティブライブラリ. Gradle (app/build.gradle.kts) から呼ばれる.
# Linux と同じ core のソースをそのままビルドし, JNI の薄い殻だけを足す.
cmake_minimum_required(VERSION 3.22)
project(pokerchip_android CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(POKERCHIP_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../../..")

# scripts/fetch_android_deps.sh で取得した OpenCV Android SDK を使う.
# モジュールは静的リンクされるので, APK に libopencv_java4.so を入れる必要はない.
set(OpenCV_DIR "${POKERCHIP_ROOT}/third_party/opencv-4.14.0-android-sdk/sdk/native/jni"
  CACHE PATH "OpenCV Android SDK の OpenCVConfig.cmake のあるディレクトリ")

add_subdirectory("${POKERCHIP_ROOT}/core" pokerchip_core)

add_library(pokerchip_jni SHARED jni_bridge.cpp)
target_link_libraries(pokerchip_jni PRIVATE pokerchip_core jnigraphics log)
