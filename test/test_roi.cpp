// selectRoiWithYOLO を単体で動かして結果を目視で確認するためのプログラム.
//
// 使い方:
//   make test-roi ARGS=testimages/yoko/stack/IMG_5582.jpg
//
// 注意: roi.cpp はpythonをべた書きしているため, ultralyticsが入っていない
// システムのpythonでは検出に失敗する. 手元で .venv/bin/python に
// 書き換えてから実行すること.

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
