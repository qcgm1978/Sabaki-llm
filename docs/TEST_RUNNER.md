# Sabaki 测试运行指南

本文档说明如何在 Sabaki 项目中运行测试，解决了标准 `npm test` 命令的兼容性问题。

## 问题分析

通过分析，我们发现标准的 `npm test` 命令失败的原因是：

- ESM 模块加载器与 Mocha 框架的兼容性问题
- 测试文件中的路径引用错误

## 解决方案

我们创建了一个自定义的测试运行脚本 `run_tests.js`，它可以：

- 自动查找并执行 test 目录下的所有测试文件
- 提供详细的测试运行状态和结果统计
- 避免 ESM 模块加载器的兼容性问题
- 单独执行每个测试文件，确保错误隔离

## 使用方法

### 1. 运行所有测试

```bash
node run_tests.js
```

这将执行 test 目录下的所有 JavaScript 测试文件，并输出详细的运行结果。

### 2. 运行单个测试文件

```bash
node test/test_prompt_build.js
node test/test_parse_response.js
# 或者其他任意测试文件
```

### 3. 测试结果说明

- ✅ 测试通过：文件执行成功，无错误
- ❌ 测试失败：文件执行出错，会显示错误信息
- 测试汇总：展示总测试数、通过数、失败数

## 测试文件说明

目前项目中的测试文件包括：

1. **test_ai_module.js** - AI 模块功能测试
2. **test_parse_response.js** - 响应解析功能测试
3. **test_prompt_build.js** - 提示构建功能测试
4. **test_response_field_unified.js** - 响应字段统一测试
5. **test_tools_duplicate_fixed.js** - 工具列表重复问题修复测试
6. **test_tools_format.js** - 工具列表格式化测试

## 注意事项

1. **不要使用 `npm test`** - 这个命令会因为 ESM 兼容性问题而失败
2. **测试文件路径** - 所有测试文件都应该放在 `test/` 目录下
3. **路径引用** - 在测试文件中引用源文件时，请使用
   `path.join(__dirname, '..', 'src', ...)` 的格式

## 添加新测试

1. 在 `test/` 目录下创建新的测试文件
2. 遵循现有测试文件的命名和结构规范
3. 使用正确的路径引用格式
4. 运行 `node run_tests.js` 验证新测试
