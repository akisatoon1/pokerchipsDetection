// YOLOのONNXモデルをOpenCV DNNで推論し, チップのスタックを検出する.
// LinuxとAndroidで同じ結果になるよう, 推論はOpenCVのCPU実装に固定する.

#pragma once

#include <opencv2/core.hpp>
#include <opencv2/dnn.hpp>
#include <string>
#include <vector>

/**
 * @brief 検出したスタック1つ.
 */
struct Detection {
  //! スタックの矩形. 元画像の座標系. 小数のまま返す.
  cv::Rect2f box;

  //! 検出スコア.
  float score;

  //! クラス番号. 今はスタックのみなので常に 0.
  int classId;
};

/**
 * @brief 検出器の設定.
 */
struct DetectorConfig {
  //! モデルの入力サイズ (正方形).
  int inputSize = 640;

  /**
   * @brief これ未満のスコアの検出は捨てる.
   *
   * pyscript/make_yolo_reference.py の CONF と合わせる.
   */
  float scoreThreshold = 0.5F;

  /**
   * @brief NMS の IoU のしきい値.
   *
   * ultralytics の iou の既定値と合わせる.
   */
  float nmsThreshold = 0.7F;
};

/**
 * @brief YOLO の ONNX モデルでチップのスタックを検出する.
 */
class YoloDetector {
 public:
  /**
   * @brief ONNXファイルのパスから読み込む. Linux用.
   * @param modelPath ONNX ファイルのパス.
   * @param config 検出器の設定.
   * @throws cv::Exception ファイルを読めない場合や, モデルを解釈できない場合.
   * @throws std::runtime_error モデルが空の場合.
   */
  explicit YoloDetector(const std::string &modelPath,
                        const DetectorConfig &config = {});

  /**
   * @brief メモリ上のONNXから読み込む.
   *
   * Androidのassetsはファイルパスを持たないため.
   * @param modelData ONNX ファイルの中身.
   * @param config 検出器の設定.
   * @throws cv::Exception モデルを解釈できない場合.
   * @throws std::runtime_error モデルが空の場合.
   */
  explicit YoloDetector(const std::vector<uchar> &modelData,
                        const DetectorConfig &config = {});

  /**
   * @brief BGR画像からスタックを検出する.
   *
   * cv::dnn::Net はスレッドセーフでないので,
   * 同時に複数スレッドから呼ばないこと.
   * @param bgr 元画像 (CV_8UC3, BGR).
   * @return 検出結果. スコアの高い順に並ぶ.
   * @throws std::invalid_argument 画像が空, または CV_8UC3 でない場合.
   * @throws std::runtime_error 推論の出力の形が想定と違う場合.
   */
  std::vector<Detection> detect(const cv::Mat &bgr);

 private:
  void setupNet();

  //! 推論に使うネットワーク.
  cv::dnn::Net net_;

  //! 検出器の設定.
  DetectorConfig config_;
};
