// 指定した画像のチップの数を検出する.

#include <iostream>
#include <opencv2/core.hpp>
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

int main(int argc, char *argv[])
{
    std::cout << CV_VERSION << std::endl;
    std::cout << cv::getBuildInformation() << std::endl;
    std::optional<std::string> filepath = getFilepathFromArgs(argc, argv);
    if (!filepath.has_value())
    {
        return 1;
    }
    return 0;
}
