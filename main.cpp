// 指定した画像のチップの数を検出する.

#include <iostream>
#include <opencv2/opencv.hpp>
#include <optional>
#include <string>

std::optional<std::string> getFilepathFromArgs(int argc, char *argv[])
{
    if (argc != 2)
    {
        std::cerr << "Usage: " << argv[0] << " <image_file_path>" << std::endl;
        return std::nullopt;
    }

    return std::string(argv[1]);
}

cv::Rect selectRoiScaled(const cv::Mat &img, const std::string &win, int maxSide = 900)
{
    double s = std::min(1.0, double(maxSide) / std::max(img.cols, img.rows));

    cv::Mat disp;
    cv::resize(img, disp, cv::Size(), s, s, cv::INTER_AREA);

    cv::Rect r = cv::selectROI(win, disp, false, false);
    cv::destroyWindow(win);
    if (r.width <= 0 || r.height <= 0)
        return cv::Rect();

    cv::Rect roi(cvRound(r.x / s), cvRound(r.y / s),
                 cvRound(r.width / s), cvRound(r.height / s));
    return roi & cv::Rect(0, 0, img.cols, img.rows);
}

void jikkenCode(const std::string &filepath)
{
    cv::Mat img = cv::imread(filepath);
    if (img.empty())
    {
        std::cerr << "Error: Could not open or find the image." << std::endl;
        return;
    }

    cv::Rect regionOfChipStack = selectRoiScaled(img, "Select ROI");
    std::cout << "Selected ROI: " << regionOfChipStack << std::endl;

    // ミリメートル. 命名もそうするべきかも.
    const double chipDiameter = 40.0;
    const double chipThickness = 3.0;
    // 浮動小数点誤差大丈夫?
    double chipCount = (regionOfChipStack.height / regionOfChipStack.width) * (chipDiameter / chipThickness);

    // チップが30個のはず
    std::cout << "chip count = " << std::lround(chipCount) << std::endl;
}

int main(int argc, char *argv[])
{
    std::optional<std::string> filepath = getFilepathFromArgs(argc, argv);
    if (!filepath.has_value())
    {
        return 1;
    }
    jikkenCode(filepath.value());
    return 0;
}
