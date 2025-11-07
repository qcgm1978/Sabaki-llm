#!/bin/bash

# macOS构建脚本（使用国内镜像并跳过签名）

echo "开始构建macOS版本，使用国内镜像加速..."

# 设置环境变量
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
export CSC_IDENTITY_AUTO_DISCOVERY=false

# 先运行bundle
echo "运行webpack打包..."
cnpm run bundle

# 然后使用--dir参数只构建目录版本（不创建安装包，避免签名问题）
echo "构建应用目录版本..."
./node_modules/.bin/electron-builder --dir -m --x64

echo "构建完成！请检查dist/mac目录"