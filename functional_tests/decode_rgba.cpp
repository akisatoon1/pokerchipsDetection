// 画像を CLI と同じ cv::imread で読み, RGBA の生の画素にしてファイルに書く.
// compare_wasm_cli.mjs が WASM に渡す画素を作るのに使う.
// CLI と同じ読み方にするのは, WASM と CLI の差を, 解析の差だけに絞るため.
//
// 出力の形: 幅と高さ (どちらも uint32, リトルエンディアン) のあとに,
// 隙間のない RGBA の画素.
//
// 使い方: decode_rgba <画像のパス> <出力のパス>

#include <cstdint>
#include <fstream>
#include <iostream>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>

namespace {

/**
 * @brief 32 ビットの符号なし整数をリトルエンディアンで書く.
 * @param out 書き込み先.
 * @param value 書く値.
 */
void writeUint32(std::ofstream &out, std::uint32_t value) {
  for (int i = 0; i < 4; ++i) {
    out.put(static_cast<char>((value >> (8 * i)) & 0xFFU));
  }
}

}  // namespace

/**
 * @brief 画像を RGBA の生の画素にして書く.
 * @param argc 引数の数.
 * @param argv 画像のパスと出力のパス.
 * @return 成功なら 0. 読めない・書けないなら 1.
 */
int main(int argc, char **argv) {
  if (argc != 3) {
    std::cerr << "Usage: decode_rgba <image> <output>" << std::endl;
    return 1;
  }
  cv::Mat bgr = cv::imread(argv[1]);
  if (bgr.empty()) {
    std::cerr << "Failed to read image: " << argv[1] << std::endl;
    return 1;
  }
  cv::Mat rgba;
  cv::cvtColor(bgr, rgba, cv::COLOR_BGR2RGBA);

  std::ofstream out(argv[2], std::ios::binary);
  writeUint32(out, static_cast<std::uint32_t>(rgba.cols));
  writeUint32(out, static_cast<std::uint32_t>(rgba.rows));
  out.write(reinterpret_cast<const char *>(rgba.data),  // NOLINT
            static_cast<std::streamsize>(rgba.total() * rgba.elemSize()));
  if (!out) {
    std::cerr << "Failed to write: " << argv[2] << std::endl;
    return 1;
  }
  return 0;
}
