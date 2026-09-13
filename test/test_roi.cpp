// selectRoiWithYOLOをテストするコード.
// サブプロセスでpythonプログラムを正しく呼び出せているかを確認するため.

#include <iostream>

#include "roi.hpp"

int main() {
  cv::Rect roi = selectRoiWithYOLO("testimages/yoko/stack/IMG_5587.jpg");
  if (roi.empty()) {
    std::cerr << "Error: YOLO did not detect a region." << std::endl;
    return 1;
  }
  std::cout << "detected ROI = " << roi << std::endl;
  return 0;
}
