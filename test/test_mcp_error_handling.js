const fs = require('fs')

// 模拟mcpHelper.js中的handleMCPRequest方法的行为
class MockMCPHelper {
  handleMCPRequest(req, toolName, params) {
    // 模拟无效请求错误
    if (!req || !req.jsonrpc) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: '无效请求',
          data: {details: '请求必须包含jsonrpc字段'}
        }
      }
    }

    // 模拟工具不存在错误
    if (toolName === 'non_existent_tool') {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: '工具不存在',
          data: {toolName: toolName}
        }
      }
    }

    // 模拟服务器错误
    if (toolName === 'server_error_tool') {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: '服务器错误',
          data: {error: '内部服务器错误'}
        }
      }
    }

    // 正常响应
    return {
      jsonrpc: '2.0',
      result: {success: true, message: '正常响应'}
    }
  }
}

// 模拟agentOrchestrator.js中的_processToolResult方法
class MockAgentOrchestrator {
  _processToolResult(toolResult, tool, outputSchema) {
    // 处理JSON-RPC错误格式
    if (toolResult.jsonrpc && toolResult.error) {
      return {
        shouldContinue: false,
        error: `${toolResult.error.message} (错误码: ${toolResult.error.code})`,
        details: toolResult.error.data
      }
    }

    // 处理isError字段（优先处理）
    if (toolResult.isError) {
      return {
        shouldContinue: false,
        error: toolResult.error || '工具操作失败',
        message: toolResult.message || '操作未能完成'
      }
    }

    // 处理传统error字段
    if (toolResult.error) {
      return {
        shouldContinue: false,
        error: toolResult.error
      }
    }

    // 正常结果
    return {
      shouldContinue: true,
      result: toolResult
    }
  }

  _executeTool(toolName, params) {
    const mockHelper = new MockMCPHelper()

    try {
      // 模拟工具执行
      let toolResult
      if (toolName === 'exception_tool') {
        throw new Error('模拟工具执行异常')
      }

      toolResult = mockHelper.handleMCPRequest(
        {jsonrpc: '2.0'},
        toolName,
        params
      )

      // 模拟isError情况
      if (toolName === 'is_error_tool') {
        toolResult = {
          isError: true,
          error: '工具操作错误',
          message: '执行操作时出错'
        }
      }

      return this._processToolResult(toolResult)
    } catch (error) {
      // 异常捕获和错误格式化
      const errorResult = {
        isError: true,
        error: error.message,
        message: '执行工具时发生错误'
      }
      return this._processToolResult(errorResult)
    }
  }
}

// 测试类
class MCPErrorHandlingTest {
  constructor() {
    this.mockHelper = new MockMCPHelper()
    this.mockOrchestrator = new MockAgentOrchestrator()
  }

  runTests() {
    console.log('\n=== MCP标准错误报告机制测试 ===\n')

    // 测试JSON-RPC错误响应
    this.testJsonRpcErrors()

    // 测试isError字段错误处理
    this.testIsErrorHandling()

    // 测试异常捕获和错误格式化
    this.testExceptionHandling()

    console.log('\n=== 测试完成 ===')
    console.log('所有测试用例已执行')
  }

  testJsonRpcErrors() {
    console.log('=== JSON-RPC错误响应测试 ===')

    // 测试无效请求错误
    console.log('\n1. 测试无效请求错误 (-32600):')
    const invalidReqResult = this.mockHelper.handleMCPRequest(null, 'test_tool')
    console.log('响应:', invalidReqResult)
    console.log(
      '验证结果:',
      invalidReqResult.jsonrpc === '2.0' &&
        invalidReqResult.error &&
        invalidReqResult.error.code === -32600 &&
        invalidReqResult.error.message === '无效请求'
    )

    // 测试工具不存在错误
    console.log('\n2. 测试工具不存在错误 (-32601):')
    const toolNotFoundResult = this.mockHelper.handleMCPRequest(
      {jsonrpc: '2.0'},
      'non_existent_tool'
    )
    console.log('响应:', toolNotFoundResult)
    console.log(
      '验证结果:',
      toolNotFoundResult.jsonrpc === '2.0' &&
        toolNotFoundResult.error &&
        toolNotFoundResult.error.code === -32601 &&
        toolNotFoundResult.error.message === '工具不存在'
    )

    // 测试服务器错误
    console.log('\n3. 测试服务器错误 (-32603):')
    const serverErrorResult = this.mockHelper.handleMCPRequest(
      {jsonrpc: '2.0'},
      'server_error_tool'
    )
    console.log('响应:', serverErrorResult)
    console.log(
      '验证结果:',
      serverErrorResult.jsonrpc === '2.0' &&
        serverErrorResult.error &&
        serverErrorResult.error.code === -32603 &&
        serverErrorResult.error.message === '服务器错误'
    )
  }

  testIsErrorHandling() {
    console.log('\n=== isError字段错误处理测试 ===')

    // 准备isError测试数据
    const isErrorResult = {
      isError: true,
      error: '工具操作错误',
      message: '执行操作时出错'
    }

    const processedResult = this.mockOrchestrator._processToolResult(
      isErrorResult
    )
    console.log('输入:', isErrorResult)
    console.log('处理结果:', processedResult)
    console.log(
      '验证结果:',
      processedResult.shouldContinue === false &&
        processedResult.error === '工具操作错误' &&
        processedResult.message === '执行操作时出错'
    )

    // 测试通过_executeTool方法的isError处理
    console.log('\n测试通过_executeTool方法处理isError:')
    const executeResult = this.mockOrchestrator._executeTool('is_error_tool')
    console.log('执行结果:', executeResult)
    console.log(
      '验证结果:',
      executeResult.shouldContinue === false &&
        executeResult.error === '工具操作错误'
    )
  }

  testExceptionHandling() {
    console.log('\n=== 异常捕获和错误格式化测试 ===')

    // 测试异常捕获
    console.log('测试异常捕获:')
    const exceptionResult = this.mockOrchestrator._executeTool('exception_tool')
    console.log('异常处理结果:', exceptionResult)
    console.log(
      '验证结果:',
      exceptionResult.shouldContinue === false &&
        exceptionResult.isError === undefined &&
        exceptionResult.error === '模拟工具执行异常'
    )
  }
}

// 运行测试
const test = new MCPErrorHandlingTest()
test.runTests()
