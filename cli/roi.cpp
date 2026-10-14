#include "roi.hpp"

#include <algorithm>
#include <opencv2/highgui.hpp>
#include <opencv2/imgproc.hpp>

cv::Rect selectRoiWithUser(const cv::Mat &img, const std::string &win,
                           int maxSide) {
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
