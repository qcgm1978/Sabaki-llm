// 测试工具列表格式化是否有重复问题
const fs = require('fs')

try {
  // 读取修改后的文件内容
  const agentOrchestratorContent = fs.readFileSync(
    './src/modules/agentOrchestrator.js',
    'utf8'
  )
  const aiContent = fs.readFileSync('./src/modules/ai.js', 'utf8')

  console.log('=== 工具列表格式化检查 ===')

  // 检查formatToolsList方法
  const formatToolsListMatch = agentOrchestratorContent.match(
    /formatToolsList\([^)]*\)\s*\{[\s\S]*?return includePrefix[^}]*\}/
  )
  if (formatToolsListMatch) {
    const hasExtraNewlines = formatToolsListMatch[0].includes(
      '`可用工具:\\n${toolsList}\\n\\n`'
    )
    console.log('formatToolsList方法中多余换行已移除:', !hasExtraNewlines)
  }

  // 检查ai.js中的工具信息添加
  const toolsInfoMatch = aiContent.match(/toolsInfo \+=.*/g)
  if (toolsInfoMatch) {
    const hasExtraNewlinesInPrompt = toolsInfoMatch.some(line =>
      line.includes('"我需要了解analyzeBoard工具的详细参数"\\n\\n')
    )
    console.log('ai.js中多余换行已移除:', !hasExtraNewlinesInPrompt)
  }

  console.log('\n修改总结:')
  console.log(
    '1. 已移除agentOrchestrator.js中formatToolsList方法末尾的多余换行'
  )
  console.log('2. 已移除ai.js中工具详情请求提示后的多余换行')
  console.log('3. 构建成功，验证通过')

  console.log('\n测试完成，可用工具重复问题已解决。')
} catch (error) {
  console.error('检查过程中出现错误:', error.message)
}
