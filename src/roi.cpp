#include "roi.hpp"

#include <cstdio>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <vector>

#include "env.hpp"

// 画像を画面に収まるサイズに縮小して表示し, ユーザに矩形を選ばせる.
// 返す矩形は元画像の座標系. 選択されなかった場合は空の矩形.
cv::Rect selectRoiWithUser(const cv::Mat &img, const std::string &win,
                           int maxSide = 900) {
  double s = std::min(
      1.0, static_cast<double>(maxSide) / std::max(img.cols, img.rows));

  cv::Mat disp;
  cv::resize(img, disp, cv::Size(), s, s, cv::INTER_AREA);

  cv::Rect r = cv::selectROI(win, disp, false, false);
  cv::destroyWindow(win);
  if (r.width <= 0 || r.height <= 0) return cv::Rect();

  cv::Rect roi(cvRound(r.x / s), cvRound(r.y / s), cvRound(r.width / s),
               cvRound(r.height / s));
  return roi & cv::Rect(0, 0, img.cols, img.rows);
}

std::string constructCmd(const std::string &imagePath) {
  if (!std::filesystem::exists(imagePath)) {
    throw std::invalid_argument("File not found: " + imagePath);
  }

  return PYTHON_BIN_PATH + " " + PYTHON_SCRIPT_PATH + " " + imagePath;
}

std::vector<cv::Rect> parseCmdOutput(FILE *pipe) {
  // TODO:
  // 4つの値が出てこず中途半端に読み取った場合などの入力のチェックも必要だが後回し.
  // 理由は, linux環境での実行はただのテストであり,
  // 実際はスマホ環境で動かすから.

  // pythonスクリプトは'x y x y'を複数行(0または1行もあり得る) 出力する.
  // それらを読み取る目的.
  std::vector<cv::Rect> rois;
  double x1, y1, x2, y2;
  while (fscanf(pipe, "%lf %lf %lf %lf", &x1, &y1, &x2, &y2) == 4) {
    // 検出領域が狭いよりは広い方がいいので, 検出領域を削らないよう外側に丸める.
    int left = cvFloor(x1);
    int top = cvFloor(y1);
    int right = cvCeil(x2);
    int bottom = cvCeil(y2);
    rois.push_back(cv::Rect(left, top, right - left, bottom - top));
  }
  return rois;
}

cv::Rect selectRoiWithYOLO(const std::string &imagePath) {
  if (!std::filesystem::exists(imagePath)) {
    throw std::invalid_argument("File not found: " + imagePath);
  }

  std::string cmd = constructCmd(imagePath);

  FILE *pipe = popen(cmd.c_str(), "r");
  if (pipe == nullptr) {
    throw std::runtime_error("Failed to run command: " + cmd);
  }

  // pythonスクリプトの実行がエラーを返す可能性があるので, statusを確認する.
  std::vector<cv::Rect> rois = parseCmdOutput(pipe);
  int status = pclose(pipe);
  if (status != 0) {
    throw std::runtime_error("Cmd: '" + cmd + "' finished with status " +
                             std::to_string(status));
  }

  // TODO: 今はスタックが一つだけの時に対応
  if (rois.size() == 0) {
    return cv::Rect();
  }
  return rois[0];
}

std::optional<cv::Mat> cropSelectedRegion(const cv::Mat &img,
                                          const std::string &imagePath,
                                          cv::Rect *outRect) {
  cv::Rect region;
  if (USER_OR_YOLO == "yolo") {
    region = selectRoiWithYOLO(imagePath);
  } else if (USER_OR_YOLO == "user") {
    region = selectRoiWithUser(img, "Select ROI");
  } else {
    throw std::invalid_argument("Invalid value for USER_OR_YOLO: " +
                                USER_OR_YOLO);
  }

  if (region.empty()) return std::nullopt;

  // regionが画像の範囲外に出てしまうときにクランプする.
  cv::Rect imageBounds(0, 0, img.cols, img.rows);
  region = region & imageBounds;

  if (outRect != nullptr) *outRect = region;

  return img(region);
}
