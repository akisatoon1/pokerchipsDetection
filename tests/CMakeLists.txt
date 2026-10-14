include(FetchContent)
FetchContent_Declare(googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.15.2.tar.gz
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(googletest)

find_package(OpenCV REQUIRED COMPONENTS imgcodecs)

add_executable(pokerchip_tests
  test_pipeline.cpp
  test_detector.cpp
)
target_link_libraries(pokerchip_tests PRIVATE pokerchip_core opencv_imgcodecs GTest::gtest_main)

# テスト画像とモデルはリポジトリのルートからの相対パスで探す.
target_compile_definitions(pokerchip_tests PRIVATE
  POKERCHIP_SOURCE_DIR="${CMAKE_SOURCE_DIR}"
)

include(GoogleTest)
gtest_discover_tests(pokerchip_tests WORKING_DIRECTORY ${CMAKE_SOURCE_DIR})
