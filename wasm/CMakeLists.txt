# Web 用の WebAssembly. scripts/build_wasm.sh から emcmake で呼ばれる.
# Linux と同じ core のソースをそのままビルドし, JS から呼ぶ薄い殻だけを足す (Android の JNI と同じ形).
cmake_minimum_required(VERSION 3.22)
project(pokerchip_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

set(POKERCHIP_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/..")

# scripts/build_opencv_wasm.sh でビルドした OpenCV を使う.
set(OpenCV_DIR "${POKERCHIP_ROOT}/third_party/opencv-4.14.0-wasm/lib/cmake/opencv4"
  CACHE PATH "WASM 用の OpenCVConfig.cmake のあるディレクトリ")

# OpenCV と同じ設定でビルドする. 例外の方式が違うとリンクできず, SIMD がないと推論が遅いため.
add_compile_options(-msimd128 -fwasm-exceptions)
add_link_options(-msimd128 -fwasm-exceptions)

add_subdirectory("${POKERCHIP_ROOT}/core" pokerchip_core)

add_executable(pokerchip_wasm bindings.cpp)
target_link_libraries(pokerchip_wasm PRIVATE pokerchip_core)
set_target_properties(pokerchip_wasm PROPERTIES OUTPUT_NAME "pokerchip-core")

# - MODULARIZE, EXPORT_ES6: import して使う. 読み込みを呼ぶ側が決められるようにするため.
# - ENVIRONMENT=web,node: ブラウザに加え, Linux と結果を比べる Node でも動かすため.
# - ALLOW_MEMORY_GROWTH: 写真の大きさで要るメモリが変わるため. 上限は既定の 2GB.
target_link_options(pokerchip_wasm PRIVATE
  -lembind
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sEXPORT_NAME=createPokerChipModule
  -sENVIRONMENT=web,node
  -sALLOW_MEMORY_GROWTH=1
)
