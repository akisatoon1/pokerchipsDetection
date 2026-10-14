# 共通ロジック (Linux/Android で同じソース).
# ルートの CMakeLists.txt (Linux) と android/app/src/main/cpp/CMakeLists.txt (Android) の
# 両方から add_subdirectory される. 呼び出し側で OpenCV_DIR を設定しておくこと.

# 推論も OpenCV で行うため, 両環境のバージョンを揃える. 理由は docs/architecture.md.
set(POKERCHIP_OPENCV_VERSION 4.14.0)
find_package(OpenCV ${POKERCHIP_OPENCV_VERSION} EXACT REQUIRED
  COMPONENTS core imgproc dnn)

add_library(pokerchip_core STATIC
  src/color.cpp
  src/counting.cpp
  src/detector.cpp
  src/pipeline.cpp
  src/visualize.cpp
)
target_include_directories(pokerchip_core PUBLIC include)
target_compile_features(pokerchip_core PUBLIC cxx_std_17)

# highgui / imgcodecs には依存させない (Android では殻側が画像を用意する).
target_link_libraries(pokerchip_core PUBLIC opencv_core opencv_imgproc opencv_dnn)
