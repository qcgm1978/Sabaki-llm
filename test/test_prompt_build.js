const fs = require('fs')
const path = require('path')

// 读取agentOrchestrator.js和ai.js文件
const agentOrchestratorPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'agentOrchestrator.js'
)
const aiPath = path.join(__dirname, '..', 'src', 'modules', 'ai.js')

const agentOrchestratorContent = fs.readFileSync(agentOrchestratorPath, 'utf8')
const aiContent = fs.readFileSync(aiPath, 'utf8')

console.log('=== 分析代码中的工具列表处理 ===')

// 检查agentOrchestrator.js中的formatToolsList方法
console.log('\n1. agentOrchestrator.js中的formatToolsList方法:')
const formatToolsListMatch = agentOrchestratorContent.match(
  /formatToolsList\([^\)]*\)\s*\{[\s\S]*?\n\s*\}/
)
if (formatToolsListMatch) {
  console.log(formatToolsListMatch[0])
}

// 检查ai.js中的prompt构建
console.log('\n2. ai.js中的prompt构建:')
const promptBuildMatch = aiContent.match(/let prompt =[\s\S]*?;/)
if (promptBuildMatch) {
  console.log(promptBuildMatch[0])
}

// 检查是否有streamDefinition的导入和使用
console.log('\n3. streamDefinition导入和使用:')
const streamImportMatch = aiContent.match(/import.*streamDefinition/)
const streamUseMatch = aiContent.match(
  /const generator = streamDefinition\([^\)]*\)/
)
if (streamImportMatch) console.log('导入:', streamImportMatch[0])
if (streamUseMatch) console.log('使用:', streamUseMatch[0])

// 分析潜在的工具列表重复问题
console.log('\n=== 潜在的工具列表重复原因分析 ===')
console.log(
  '1. 在ai.js中，toolInfo变量通过formatToolsList(false, true)获取工具列表'
)
console.log('2. 然后toolInfo被添加到prompt中')
console.log('3. streamDefinition函数可能在处理prompt时再次添加工具列表')
console.log('\n建议解决方案:')
console.log(
  '1. 修改ai.js，移除第113行的toolInfo添加，因为streamDefinition可能已经处理了'
)
console.log('2. 或者修改ai.js，在调用streamDefinition时不包含toolInfo')

// 模拟构建一个简单的prompt，查看是否包含重复内容
console.log('\n=== 模拟构建prompt ===')
const mockPrePrompt = '你是一个围棋助手...\n\n'
const mockToolsInfo = '可用工具:\n  - tool1: 描述1\n  - tool2: 描述2'
const mockPrompt = mockPrePrompt + mockToolsInfo + '\n游戏信息:\n...'
console.log('模拟prompt结构:', mockPrompt)
