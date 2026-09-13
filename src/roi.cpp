#include "roi.hpp"

cv::Rect selectRoiScaled(const cv::Mat &img, const std::string &win,
                         int maxSide) {
  double s = std::min(1.0, double(maxSide) / std::max(img.cols, img.rows));

  cv::Mat disp;
  cv::resize(img, disp, cv::Size(), s, s, cv::INTER_AREA);

  cv::Rect r = cv::selectROI(win, disp, false, false);
  cv::destroyWindow(win);
  if (r.width <= 0 || r.height <= 0) return cv::Rect();

  cv::Rect roi(cvRound(r.x / s), cvRound(r.y / s), cvRound(r.width / s),
               cvRound(r.height / s));
  return roi & cv::Rect(0, 0, img.cols, img.rows);
}

std::optional<cv::Mat> cropSelectedRegion(const cv::Mat &img,
                                          cv::Rect *outRect) {
  cv::Rect region = selectRoiScaled(img, "Select ROI");
  if (region.empty()) return std::nullopt;

  if (outRect != nullptr) *outRect = region;

  return img(region);
}
