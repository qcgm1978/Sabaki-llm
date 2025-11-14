const fs = require('fs')
const path = require('path')

// 读取修改后的文件
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

console.log('=== 验证响应字段统一修改 ===')

// 检查agentOrchestrator.js中是否使用content字段
const agentContentUsage = agentOrchestratorContent.includes('response.content')
console.log('agentOrchestrator.js使用content字段:', agentContentUsage)

// 检查ai.js中是否已将response改为content
const aiPromptContentUsage = aiContent.includes('使用content格式')
const aiParsingContentUsage = aiContent.includes('parsedResponse.content')

console.log('ai.js提示文本中使用content格式:', aiPromptContentUsage)
console.log('ai.js解析逻辑中使用content字段:', aiParsingContentUsage)

// 检查是否还残留response格式的使用
const aiResponseFormatLeft = aiContent.includes('使用response格式')
const aiResponseParsingLeft = aiContent.includes('parsedResponse.response')

console.log('\n=== 检查是否残留旧格式 ===')
console.log('是否残留"使用response格式"文本:', aiResponseFormatLeft)
console.log('是否残留"parsedResponse.response"代码:', aiResponseParsingLeft)

console.log('\n=== 修改总结 ===')
if (
  agentContentUsage &&
  aiPromptContentUsage &&
  aiParsingContentUsage &&
  !aiResponseFormatLeft &&
  !aiResponseParsingLeft
) {
  console.log('✓ 成功统一响应字段!')
  console.log('  - agentOrchestrator.js继续使用content字段')
  console.log('  - ai.js已将prompt中的response格式改为content格式')
  console.log(
    '  - ai.js已将解析逻辑中的parsedResponse.response改为parsedResponse.content'
  )
  console.log('  - 没有残留旧的response格式使用')
} else {
  console.log('✗ 统一不完整，请检查上述项目')
}

console.log('\n=== 重要说明 ===')
console.log('1. 现在所有响应处理都统一使用content字段')
console.log('2. 这将确保agentOrchestrator.js和ai.js模块之间的数据结构一致性')
console.log('3. 减少了潜在的字段不匹配导致的bug')
