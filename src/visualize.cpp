#include "visualize.hpp"

cv::Mat renderDebugView(const cv::Mat &roi, const std::vector<double> &signal,
                        const std::vector<int> &peaks,
                        const std::vector<ChipColor> &colors) {
  const int graphWidth = 300;
  const int labelWidth = 140;
  int h = roi.rows;

  cv::Mat roiView;
  cv::cvtColor(roi, roiView, cv::COLOR_BGR2BGRA);
  cv::cvtColor(roiView, roiView, cv::COLOR_BGRA2BGR);

  cv::Mat graph(h, graphWidth, CV_8UC3, cv::Scalar(30, 30, 30));

  double lo = *std::min_element(signal.begin(), signal.end());
  double hi = *std::max_element(signal.begin(), signal.end());
  double range = std::max(hi - lo, 1e-9);

  // 信号を折れ線で描く. 縦がROIの高さ, 横が信号の値.
  for (int y = 1; y < h && y < static_cast<int>(signal.size()); ++y) {
    int x0 = cvRound((signal[y - 1] - lo) / range * (graphWidth - 1));
    int x1 = cvRound((signal[y] - lo) / range * (graphWidth - 1));
    cv::line(graph, cv::Point(x0, y - 1), cv::Point(x1, y),
             cv::Scalar(200, 220, 200), 1);
  }

  for (int p : peaks) {
    cv::line(graph, cv::Point(0, p), cv::Point(graphWidth - 1, p),
             cv::Scalar(0, 160, 255), 1);
    cv::line(roiView, cv::Point(0, p), cv::Point(roiView.cols - 1, p),
             cv::Scalar(0, 160, 255), 1);
  }

  // 各チップ区間の中央に, 代表色の四角と色名を描く.
  cv::Mat labels(h, labelWidth, CV_8UC3, cv::Scalar(30, 30, 30));
  for (int p : peaks) {
    cv::line(labels, cv::Point(0, p), cv::Point(labelWidth - 1, p),
             cv::Scalar(0, 160, 255), 1);
  }
  for (size_t i = 0; i < colors.size() && i + 1 < peaks.size(); ++i) {
    int cy = (peaks[i] + peaks[i + 1]) / 2;
    cv::Rect swatch(6, cy - 6, 12, 12);
    cv::rectangle(labels, swatch, chipColorBgr(colors[i]), cv::FILLED);
    cv::rectangle(labels, swatch, cv::Scalar(200, 200, 200), 1);
    cv::putText(labels, chipColorName(colors[i]), cv::Point(24, cy + 5),
                cv::FONT_HERSHEY_SIMPLEX, 0.45, cv::Scalar(230, 230, 230), 1,
                cv::LINE_AA);
  }

  cv::Mat combined;
  cv::hconcat(std::vector<cv::Mat>{roiView, graph, labels}, combined);

  // 画面に収まるよう縮小.
  double s = std::min(1.0, 900.0 / combined.rows);
  if (s < 1.0) cv::resize(combined, combined, cv::Size(), s, s, cv::INTER_AREA);

  return combined;
}
