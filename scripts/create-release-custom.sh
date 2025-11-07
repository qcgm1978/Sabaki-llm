#!/bin/bash

# 创建自定义版本标签、自动commit并推送到远程仓库

# 检查是否需要自动commit（参数2为auto-commit时自动提交）
AUTO_COMMIT=false
if [ "$2" = "auto-commit" ]; then
  AUTO_COMMIT=true
fi

if [ "$1" ]; then
  VERSION=$1
  
  # 如果需要自动commit
  if [ "$AUTO_COMMIT" = true ]; then
    echo "执行自动commit..."
    git add .
    git commit -m "Release v$VERSION" || echo "没有更改需要提交"
  fi
  
  echo "创建标签 v$VERSION"
  git tag -d v$VERSION 2>/dev/null || true
  git tag v$VERSION
  
  echo "推送到远程仓库..."
  if [ "$AUTO_COMMIT" = true ]; then
    git push origin HEAD
  fi
  git push origin v$VERSION -f
  
  echo "完成：已创建标签v$VERSION并推送到远程仓库"
else
  echo "请提供版本号，例如：npm run create-release:custom -- 0.52.3"
  exit 1
fi