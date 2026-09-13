// 指定した画像のチップの数を検出する.
// 輝度プロファイル法: ユーザが囲んだスタック領域を1次元信号に射影し,
// チップの合わせ目(影)の周期を数えて枚数を推定する.

#include <iostream>
#include <opencv2/opencv.hpp>
#include <optional>
#include <string>

#include "counting.hpp"
#include "roi.hpp"
#include "visualize.hpp"

std::optional<std::string> getFilepathFromArgs(int argc, char *argv[]) {
  if (argc != 2) {
    std::cerr << "Usage: " << argv[0] << " <image_file_path>" << std::endl;
    return std::nullopt;
  }

  return std::string(argv[1]);
}

int main(int argc, char *argv[]) {
  std::optional<std::string> filepath = getFilepathFromArgs(argc, argv);
  if (!filepath.has_value()) return 1;

  cv::Mat img = cv::imread(filepath.value());
  if (img.empty()) {
    std::cerr << "Error: Could not open or find the image." << std::endl;
    return 1;
  }

  cv::Rect regionOfChipStack;
  std::optional<cv::Mat> roi = cropSelectedRegion(img, &regionOfChipStack);
  if (!roi.has_value()) {
    std::cerr << "Error: ROI was not selected." << std::endl;
    return 1;
  }
  std::cout << "Selected ROI: " << regionOfChipStack << std::endl;

  std::optional<CountResult> result = countChips(roi.value());
  if (!result.has_value()) {
    std::cerr << "Error: Failed to count chips. "
              << "ROI may be too small or lack visible seams." << std::endl;
    return 1;
  }

  std::cout << "autocorrelation: period = " << result->period << " px"
            << std::endl;
  std::cout << "profile length = " << result->signal.size() << " px"
            << std::endl;
  std::cout << "detected seams = " << result->peaks.size() << std::endl;
  std::cout << "chip count by peaks  = " << result->count << std::endl;

  cv::Mat debug = renderDebugView(roi.value(), result->signal, result->peaks);
  cv::imshow("Profile", debug);
  std::cout << "Press any key on the window to exit." << std::endl;
  cv::waitKey(0);
  cv::destroyAllWindows();

  return 0;
}
