// YOLOのONNXモデルをOpenCV DNNで推論し, チップのスタックを検出する.
// LinuxとAndroidで同じ結果になるよう, 推論はOpenCVのCPU実装に固定する.

#pragma once

#include <opencv2/core.hpp>
#include <opencv2/dnn.hpp>
#include <string>
#include <vector>

struct Detection {
  cv::Rect2f box;  // 元画像の座標系. 小数のまま返す.
  float score;
  int classId;
};

struct DetectorConfig {
  int inputSize = 640;  // モデルの入力サイズ (正方形).
  // pyscript/make_yolo_reference.py の CONF と合わせる.
  float scoreThreshold = 0.5F;
  float nmsThreshold = 0.7F;  // ultralytics の iou の既定値と合わせる.
};

class YoloDetector {
 public:
  // ONNXファイルのパスから読み込む. Linux用.
  explicit YoloDetector(const std::string &modelPath,
                        const DetectorConfig &config = {});

  // メモリ上のONNXから読み込む. Androidのassetsはファイルパスを持たないため.
  explicit YoloDetector(const std::vector<uchar> &modelData,
                        const DetectorConfig &config = {});

  // BGR画像からスタックを検出する. スコアの高い順に並ぶ.
  // cv::dnn::Net はスレッドセーフでないので,
  // 同時に複数スレッドから呼ばないこと.
  std::vector<Detection> detect(const cv::Mat &bgr);

 private:
  void setupNet();

  cv::dnn::Net net_;
  DetectorConfig config_;
};
