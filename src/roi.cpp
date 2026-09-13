#include "roi.hpp"

#include <cstdio>
#include <stdexcept>
#include <string>
#include <vector>

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

cv::Rect selectRoiWithYOLO(const std::string &imagePath) {
  // imagePathの内容は大丈夫か?
  // pythonスクリプトのパスはべた書きにしない.
  // 仮想環境の実行は?
  std::string cmd = "python pyscript/getroi.py " + imagePath;

  // TODO: エラーを返さないと.
  // TODO: python側のエラーはどうする?
  FILE *pipe = popen(cmd.c_str(), "r");
  if (pipe == nullptr) {
    return cv::Rect();
  }

  std::vector<cv::Rect> rois;

  // "ROI x1 y1 x2 y2" の行を探す.
  // それ以外の行はログなので読み飛ばす.
  // TODO: 入力のチェックも必要.
  // TODO: 4つの値が出てこず中途半端に読み取った場合は?
  double x1, y1, x2, y2;
  while (fscanf(pipe, "%lf %lf %lf %lf", &x1, &y1, &x2, &y2) == 4) {
    // 検出領域が狭いよりは広い方がいいので, 検出領域を削らないよう外側に丸める.
    int left = cvFloor(x1);
    int top = cvFloor(y1);
    int right = cvCeil(x2);
    int bottom = cvCeil(y2);
    rois.push_back(cv::Rect(left, top, right - left, bottom - top));
  }

  // pythonスクリプトの実行がエラーを返す可能性があるので, statusを確認する.
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
                                          cv::Rect *outRect) {
  cv::Rect region = selectRoiWithUser(img, "Select ROI");
  if (region.empty()) return std::nullopt;

  if (outRect != nullptr) *outRect = region;

  // TODO: クランプしたほうがいいかも?
  return img(region);
}
