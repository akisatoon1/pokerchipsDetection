// 指定した画像のチップの数を検出する. Linuxでの実験用のCLI.
// 解析そのものは core (Androidと共通) が行い, ここでは入出力だけを扱う.

#include <iomanip>
#include <iostream>
#include <opencv2/highgui.hpp>
#include <opencv2/imgcodecs.hpp>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

#include "pokerchip/detector.hpp"
#include "pokerchip/pipeline.hpp"
#include "pokerchip/visualize.hpp"
#include "roi.hpp"

namespace {

/**
 * @brief コマンドライン引数の解析結果.
 */
struct Options {
  //! 解析する画像のパス.
  std::string imagePath;

  //! ROIの選び方. "yolo" or "user"
  std::string roiMode = "yolo";

  //! 数値で指定されたROI. 指定されたら検出も手動選択もしない.
  std::optional<cv::Rect> rect;

  //! ONNX モデルのパス.
  std::string modelPath = "models/chip_detector.onnx";

  //! デバッグ画像を保存するパス. 空なら画面に表示する.
  std::string outPath;

  //! 結果を JSON でも出力するか.
  bool json = false;

  //! チップごとの代表色 (Lab) も出力するか. 色判定の基準色を作り直すときに使う.
  bool lab = false;
};

/**
 * @brief 使い方を標準エラー出力に書く.
 * @param prog プログラム名 (argv[0]).
 */
void printUsage(const char *prog) {
  std::cerr
      << "Usage: " << prog
      << " [--roi yolo|user] [--rect X,Y,W,H] [--model PATH] [--out PATH] "
         "[--json] [--lab] <image_file_path>\n"
      << "  --roi    ROIの選び方. yolo: YOLOで検出 (既定), user: 手動\n"
      << "  --rect   ROIを数値で指定する. 同じROIで実験を繰り返すとき用\n"
      << "  --model  ONNXモデルのパス (既定: models/chip_detector.onnx)\n"
      << "  --out    デバッグ画像を保存するパス. 省略時は画面に表示\n"
      << "  --json   結果をJSONでも出力する\n"
      << "  --lab    チップごとの代表色 (補正後の Lab) も出力する" << std::endl;
}

/**
 * @brief "x,y,w,h" を矩形にする.
 * @param s "x,y,w,h" 形式の文字列.
 * @return 矩形. 形式が違う場合や, 矩形が空の場合は nullopt.
 */
std::optional<cv::Rect> parseRect(const std::string &s) {
  cv::Rect r;
  char c1 = 0, c2 = 0, c3 = 0;
  std::istringstream is(s);
  if (!(is >> r.x >> c1 >> r.y >> c2 >> r.width >> c3 >> r.height)) {
    return std::nullopt;
  }
  if (c1 != ',' || c2 != ',' || c3 != ',' || r.empty()) return std::nullopt;
  return r;
}

/**
 * @brief コマンドライン引数を解析する.
 * @param argc 引数の数.
 * @param argv 引数.
 * @return 解析結果. 不明なオプションがある場合や,
 *         画像のパスがない場合は nullopt.
 */
std::optional<Options> parseArgs(int argc, char *argv[]) {
  Options opt;
  for (int i = 1; i < argc; ++i) {
    std::string a = argv[i];
    bool hasValue = i + 1 < argc;
    if (a == "--roi" && hasValue) {
      opt.roiMode = argv[++i];
    } else if (a == "--rect" && hasValue) {
      opt.rect = parseRect(argv[++i]);
      if (!opt.rect.has_value()) return std::nullopt;
    } else if (a == "--model" && hasValue) {
      opt.modelPath = argv[++i];
    } else if (a == "--out" && hasValue) {
      opt.outPath = argv[++i];
    } else if (a == "--json") {
      opt.json = true;
    } else if (a == "--lab") {
      opt.lab = true;
    } else if (!a.empty() && a[0] != '-' && opt.imagePath.empty()) {
      opt.imagePath = a;
    } else {
      return std::nullopt;
    }
  }

  if (opt.imagePath.empty()) return std::nullopt;
  if (opt.roiMode != "yolo" && opt.roiMode != "user") return std::nullopt;
  return opt;
}

/**
 * @brief 1つのスタックの解析結果を標準出力に書く.
 * @param index スタックの番号.
 * @param s スタックの解析結果.
 * @param labs チップごとの代表色 (Lab). 空なら書かない.
 */
void printStack(size_t index, const StackResult &s,
                const std::vector<cv::Vec3f> &labs) {
  std::cout << "[stack " << index << "] ROI: " << s.box
            << ", score = " << s.score << std::endl;
  if (!s.count.has_value()) {
    std::cout << "  Failed to count chips. "
              << "ROI may be too small or lack visible seams." << std::endl;
    return;
  }

  std::cout << "  autocorrelation: period = " << s.count->period << " px"
            << std::endl;
  std::cout << "  profile length = " << s.count->signal.size() << " px"
            << std::endl;
  std::cout << "  detected seams = " << s.count->peaks.size() << std::endl;
  std::cout << "  chip count by peaks  = " << s.count->count << std::endl;
  std::cout << "  chip colors (top -> bottom) =";
  for (size_t i = 0; i < s.colors.size(); ++i) {
    std::cout << (i == 0 ? " " : ", ") << chipColorName(s.colors[i]);
  }
  std::cout << std::endl;

  if (labs.empty()) return;
  std::cout << "  chip lab (top -> bottom) =" << std::fixed
            << std::setprecision(1);
  for (size_t i = 0; i < labs.size(); ++i) {
    std::cout << (i == 0 ? " " : ", ") << "(" << labs[i][0] << ", "
              << labs[i][1] << ", " << labs[i][2] << ")";
  }
  std::cout << std::defaultfloat << std::endl;
}

/**
 * @brief デバッグ画像を保存するか画面に出す.
 *
 * スタックが複数あるときは保存するファイル名に番号を付ける.
 * カウントに失敗したスタックは描かない.
 * @param img 元画像 (BGR).
 * @param result 解析結果.
 * @param outPath 保存するパス. 空なら画面に表示する.
 * @throws cv::Exception GUIなしでビルドしたOpenCVで画面に表示しようとした場合.
 */
void showDebugViews(const cv::Mat &img, const AnalysisResult &result,
                    const std::string &outPath) {
  std::vector<cv::Mat> views;
  for (const StackResult &s : result.stacks) {
    if (!s.count.has_value()) continue;
    views.push_back(
        renderDebugView(img(s.box), s.count->signal, s.count->peaks, s.colors));
  }
  if (views.empty()) return;

  if (!outPath.empty()) {
    for (size_t i = 0; i < views.size(); ++i) {
      std::string path = outPath;
      if (views.size() > 1) {
        size_t dot = path.find_last_of('.');
        path.insert(dot == std::string::npos ? path.size() : dot,
                    "_" + std::to_string(i));
      }
      cv::imwrite(path, views[i]);
      std::cout << "Saved debug view: " << path << std::endl;
    }
    return;
  }

  for (size_t i = 0; i < views.size(); ++i) {
    cv::imshow("Profile " + std::to_string(i), views[i]);
  }
  std::cout << "Press any key on the window to exit." << std::endl;
  cv::waitKey(0);
  cv::destroyAllWindows();
}

}  // namespace

/**
 * @brief 画像を解析し, スタックごとの枚数と色を出力する.
 * @param argc 引数の数.
 * @param argv 引数. 使い方は printUsage を参照.
 * @return 成功なら 0, 失敗なら 1.
 */
int main(int argc, char *argv[]) {
  std::optional<Options> opt = parseArgs(argc, argv);
  if (!opt.has_value()) {
    printUsage(argv[0]);
    return 1;
  }

  cv::Mat img = cv::imread(opt->imagePath);
  if (img.empty()) {
    std::cerr << "Error: Could not open or find the image." << std::endl;
    return 1;
  }

  try {
    AnalysisResult result;
    if (opt->rect.has_value()) {
      result.stacks.push_back(analyzeRegion(img, opt->rect.value()));
    } else if (opt->roiMode == "yolo") {
      YoloDetector detector(opt->modelPath);
      result = analyzeImage(detector, img);
    } else {
      cv::Rect region = selectRoiWithUser(img, "Select ROI");
      if (!region.empty()) result.stacks.push_back(analyzeRegion(img, region));
    }

    if (result.stacks.empty()) {
      std::cerr << "Error: ROI was not selected." << std::endl;
      return 1;
    }

    for (size_t i = 0; i < result.stacks.size(); ++i) {
      const StackResult &s = result.stacks[i];
      std::vector<cv::Vec3f> labs;
      if (opt->lab && s.count.has_value()) {
        labs = measureChipLab(img(s.box), s.count.value());
      }
      printStack(i, s, labs);
    }
    if (opt->json) std::cout << toJson(result) << std::endl;

    showDebugViews(img, result, opt->outPath);
  } catch (const cv::Exception &e) {
    // GUIなしでビルドしたOpenCVでは imshow / selectROI が例外になる.
    std::cerr << "OpenCV error: " << e.what() << std::endl;
    std::cerr << "GUIが使えない場合は --out でデバッグ画像を保存してください."
              << std::endl;
    return 1;
  } catch (const std::exception &e) {
    std::cerr << "Error: " << e.what() << std::endl;
    return 1;
  }

  return 0;
}
