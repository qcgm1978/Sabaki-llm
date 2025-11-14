const fs = require('fs')
const path = require('path')

// 读取修改后的ai.js文件
const aiPath = path.join(__dirname, '..', 'src', 'modules', 'ai.js')
const aiContent = fs.readFileSync(aiPath, 'utf8')

console.log('=== 验证工具列表重复问题修复 ===')

// 检查是否还在prompt中添加toolsInfo
const promptBuild = aiContent.match(/let prompt =[\s\S]*?;/)[0]
console.log('当前prompt构建代码:')
console.log(promptBuild)

// 检查是否移除了toolsInfo变量
const hasToolsInfo = aiContent.includes('toolsInfo =')
console.log('\n是否还包含toolsInfo变量:', hasToolsInfo)

// 检查是否移除了formatToolsList调用
const hasFormatToolsList = aiContent.includes('formatToolsList')
console.log('是否还调用formatToolsList:', hasFormatToolsList)

// 检查是否保留了handleToolDetailRequest方法（用于处理工具详情请求）
const hasToolDetailRequest = aiContent.includes('handleToolDetailRequest')
console.log('是否保留了handleToolDetailRequest方法:', hasToolDetailRequest)

console.log('\n=== 修复总结 ===')
if (!hasToolsInfo && !hasFormatToolsList && hasToolDetailRequest) {
  console.log('✓ 成功修复工具列表重复问题!')
  console.log('  - 已移除在prompt中直接添加的toolsInfo')
  console.log('  - 已移除formatToolsList调用')
  console.log('  - 保留了handleToolDetailRequest方法用于工具详情请求')
  console.log('  - 现在工具列表将由streamDefinition函数内部处理')
} else {
  console.log('✗ 修复不完整，请检查上述项目')
}

console.log('\n=== 注意事项 ===')
console.log(
  '1. 工具列表现在由llm-service-provider包中的streamDefinition函数内部处理'
)
console.log(
  '2. handleToolDetailRequest方法仍保留，用于处理LLM对特定工具详情的请求'
)
console.log('3. 这样既避免了工具列表重复，又保留了动态请求工具详情的功能')
