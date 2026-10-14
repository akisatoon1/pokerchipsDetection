# Linux 用のビルド (core + CLI + テスト).
# Android は android/ の Gradle から core だけをビルドする.
cmake_minimum_required(VERSION 3.22)
project(pokerchip CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

# scripts/build_opencv.sh でビルドした OpenCV を使う.
set(OpenCV_DIR "${CMAKE_SOURCE_DIR}/third_party/opencv-4.14.0/lib/cmake/opencv4"
  CACHE PATH "OpenCVConfig.cmake のあるディレクトリ")

add_compile_options(-Wall -Wextra -pedantic)

add_subdirectory(core)

# CLI (Linux 専用. 画像の読み書きと画面表示を使う)
find_package(OpenCV REQUIRED COMPONENTS imgcodecs highgui)
add_executable(pokerchip cli/main.cpp cli/roi.cpp)
target_link_libraries(pokerchip PRIVATE pokerchip_core opencv_imgcodecs opencv_highgui)

option(POKERCHIP_BUILD_TESTS "テストをビルドする" ON)
if(POKERCHIP_BUILD_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()
