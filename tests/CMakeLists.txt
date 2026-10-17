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

# CMake 4 の gtest_discover_tests は, テストの一覧を作るときに
# cmake_test_discovery_*.json を作業ディレクトリに書き出す.
# リポジトリのルートを汚さないよう, 作業ディレクトリを log/ (git 管理外) にする.
# テストはファイルを POKERCHIP_SOURCE_DIR からの絶対パスで探すので, 作業ディレクトリに依存しない.
set(POKERCHIP_TEST_WORKING_DIR "${CMAKE_SOURCE_DIR}/log")
file(MAKE_DIRECTORY "${POKERCHIP_TEST_WORKING_DIR}")

include(GoogleTest)
gtest_discover_tests(pokerchip_tests WORKING_DIRECTORY "${POKERCHIP_TEST_WORKING_DIR}")
