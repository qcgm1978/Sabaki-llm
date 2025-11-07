#!/bin/bash

# 本地测试GitHub Actions工作流脚本
echo "开始测试GitHub Actions工作流..."

# 设置必要的环境变量
export GITHUB_REF="refs/tags/v0.52.2"

# 运行extractInfo.js脚本提取信息
echo "运行extractInfo.js脚本..."
INFO_OUTPUT=$(node ./ci/extractInfo.js)

# 解析输出获取必要的信息
VERSION=$(echo "$INFO_OUTPUT" | grep '::set-output name=version::' | cut -d'::' -f3)
TAG=$(echo "$INFO_OUTPUT" | grep '::set-output name=tag::' | cut -d'::' -f3)
CI_PATH=$(echo "$INFO_OUTPUT" | grep '::set-output name=ci::' | cut -d'::' -f3)
DIST_COMMAND=$(echo "$INFO_OUTPUT" | grep '::set-output name=distcommand::' | cut -d'::' -f3)

echo "提取的信息:"
echo "- 版本: $VERSION"
echo "- 标签: $TAG"
echo "- CI路径: $CI_PATH"
echo "- 构建命令: $DIST_COMMAND"

# 模拟GitHub Actions步骤
echo "\n开始执行构建步骤..."

# 检查dist命令是否存在
if ! grep -q "$DIST_COMMAND" package.json; then
    echo "错误: 构建命令 $DIST_COMMAND 不存在于package.json中"
    exit 1
fi

# 执行构建步骤
echo "安装依赖..."
cnpm install

echo "\n执行构建命令: cnpm run $DIST_COMMAND"
cnpm run $DIST_COMMAND

# 检查构建是否成功
if [ $? -eq 0 ]; then
    echo "\n构建成功!"
    
    # 清理不必要的文件（模拟工作流中的清理步骤）
    # echo "清理不必要的文件..."
    # npx rimraf ./dist/*.yml ./dist/*.yaml ./dist/*.blockmap 2>/dev/null || echo "没有需要清理的文件"
    
    # # 检查dist目录
    # echo "\ndist目录内容:"
    # ls -la ./dist/
    
    echo "\nGitHub Actions工作流本地测试完成!"
    echo "注意: 由于没有GITHUB_TOKEN，ghr发布步骤被跳过"
else
    echo "\n构建失败!"
    exit 1
fi
