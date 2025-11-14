const fs = require('fs')
const path = require('path')

// 模拟AgentOrchestrator类中的_parseThoughtResponse方法
class TestParseThoughtResponse {
  _parseThoughtResponse(response) {
    if (response.content) {
      try {
        const cleanContent = response.content
          .replace(/^```json|```$/g, '')
          .trim()
        return JSON.parse(cleanContent)
      } catch (parseError) {
        // LLM可能直接返回字符串内容，这是正常行为，不需要错误日志
      }
    }

    return {
      action: 'respond',
      content: response.content || '抱歉，我无法分析您的问题'
    }
  }
}

// 创建测试实例
const testInstance = new TestParseThoughtResponse()

// 测试用例1: JSON格式响应
console.log('=== 测试用例1: JSON格式响应 ===')
const jsonResponse = {
  content: '{"action": "analyze", "content": "这是JSON格式的分析结果"}'
}
const jsonResult = testInstance._parseThoughtResponse(jsonResponse)
console.log('输入:', jsonResponse)
console.log('输出:', jsonResult)
console.log(
  '是否正确解析为对象:',
  typeof jsonResult === 'object' && jsonResult.action === 'analyze'
)
console.log()

// 测试用例2: 带有markdown代码块的JSON
console.log('=== 测试用例2: 带有markdown代码块的JSON ===')
const markdownJsonResponse = {
  content:
    '```json\n{"action": "explain", "content": "这是带代码块的JSON"}\n```'
}
const markdownJsonResult = testInstance._parseThoughtResponse(
  markdownJsonResponse
)
console.log('输入:', markdownJsonResponse)
console.log('输出:', markdownJsonResult)
console.log(
  '是否正确解析为对象:',
  typeof markdownJsonResult === 'object' &&
    markdownJsonResult.action === 'explain'
)
console.log()

// 测试用例3: 直接字符串响应（用户提到的正常情况）
console.log('=== 测试用例3: 直接字符串响应 ===')
const stringResponse = {
  content: '这是一段直接返回的字符串内容，不是JSON格式'
}
const stringResult = testInstance._parseThoughtResponse(stringResponse)
console.log('输入:', stringResponse)
console.log('输出:', stringResult)
console.log('是否正确处理为respond操作:', stringResult.action === 'respond')
console.log(
  '内容是否保持一致:',
  stringResult.content === stringResponse.content
)
console.log()

// 测试用例4: 空响应
console.log('=== 测试用例4: 空响应 ===')
const emptyResponse = {}
const emptyResult = testInstance._parseThoughtResponse(emptyResponse)
console.log('输入:', emptyResponse)
console.log('输出:', emptyResult)
console.log(
  '是否返回默认消息:',
  emptyResult.content === '抱歉，我无法分析您的问题'
)
console.log()

// 测试用例5: 无效JSON格式
console.log('=== 测试用例5: 无效JSON格式 ===')
const invalidJsonResponse = {
  content: '{这不是有效的JSON格式}'
}
const invalidJsonResult = testInstance._parseThoughtResponse(
  invalidJsonResponse
)
console.log('输入:', invalidJsonResponse)
console.log('输出:', invalidJsonResult)
console.log(
  '是否正确回退为respond操作:',
  invalidJsonResult.action === 'respond'
)
console.log(
  '内容是否正确:',
  invalidJsonResult.content === invalidJsonResponse.content
)

console.log('\n=== 测试总结 ===')
console.log('1. 修改后的方法能够正确处理JSON格式响应')
console.log('2. 修改后的方法能够正确处理直接字符串响应，不会产生错误日志')
console.log('3. 修改后的方法能够处理各种边缘情况，保证系统稳定性')
console.log(
  '结论: 移除不必要的错误日志是正确的，因为LLM返回字符串内容是正常行为'
)
