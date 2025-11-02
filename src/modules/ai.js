import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import mcpHelper from './mcpHelper.js'

/**
 * AI助手模块，处理与DeepSeek API的交互并集成MCP协议支持
 */
class AIHelper {
  /**
   * 向DeepSeek API发送消息，支持MCP协议
   * @param {string} message - 用户消息
   * @param {Object} gameContext - 游戏上下文信息
   * @returns {Promise<Object>} API响应
   */
  async sendDeepSeekMessage(message, gameContext) {
    let apiKey = setting.get('ai.deepseek_key')
    if (!apiKey) {
      return {error: 'DeepSeek API Key not configured'}
    }

    try {
      // 获取当前游戏信息作为上下文
      let {gameTrees, gameIndex, treePosition} = gameContext
      let tree = gameTrees[gameIndex]
      let currentNode = tree.get(treePosition)
      let moves = []
      let node = currentNode

      // 收集所有棋步作为上下文
      while (node) {
        if (node.data.B) moves.unshift(`B[${node.data.B.join('][')}]`)
        if (node.data.W) moves.unshift(`W[${node.data.W.join('][')}]`)
        node = tree.get(node.parentId)
      }

      let boardContext = moves.join('\n')

      // 获取可用的MCP工具列表
      let availableTools = mcpHelper.getAvailableEndpoints()

      // 构建工具信息提示
      let toolsInfo = availableTools
        .map(
          tool => `
  - 工具名称: ${tool.name}
    描述: ${tool.description}`
        )
        .join('')

      // 调用DeepSeek API，加入MCP工具信息
      let response = await fetch(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content:
                  '你是一个围棋助手，能够分析棋局、提供建议并回答关于围棋策略的问题。\n' +
                  '你可以使用以下MCP工具来增强你的分析能力:\n' +
                  toolsInfo +
                  '\n' +
                  '当用户询问需要深入分析的问题时，你可以生成MCP格式的工具调用请求。\n' +
                  'MCP调用格式示例:\n' +
                  '{\n' +
                  '  "mcp": {\n' +
                  '    "tool": {\n' +
                  '      "name": "工具名称",\n' +
                  '      "description": "工具描述",\n' +
                  '      "parameters": {参数对象}\n' +
                  '    }\n' +
                  '  }\n' +
                  '}\n' +
                  '当前游戏状态:\n' +
                  boardContext
              },
              {
                role: 'user',
                content: message
              }
            ]
          })
        }
      )

      let data = await response.json()
      if (data.error) {
        return {error: data.error.message || 'API Error'}
      }

      let aiResponse = data.choices[0].message.content

      // 检查响应是否包含MCP工具调用
      try {
        // 尝试解析响应为JSON，检查是否包含MCP调用
        let parsedResponse = JSON.parse(aiResponse)
        if (parsedResponse.mcp && parsedResponse.mcp.tool) {
          // 处理MCP工具调用
          let toolResult = await mcpHelper.handleMCPRequest(
            parsedResponse,
            gameContext
          )

          if (toolResult.error) {
            return {content: `工具调用失败: ${toolResult.error}`}
          }

          // 将工具结果传递给AI进行总结
          return await this.sendToolResultToAI(
            message,
            toolResult.data,
            gameContext
          )
        }
      } catch (e) {
        // 响应不是有效的JSON，直接返回
      }

      return {content: aiResponse.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')}
    } catch (err) {
      return {error: err.message}
    }
  }

  /**
   * 将工具执行结果传递给AI进行总结
   * @param {string} originalMessage - 用户原始消息
   * @param {Object} toolResult - 工具执行结果
   * @param {Object} gameContext - 游戏上下文信息
   * @returns {Promise<Object>} AI总结响应
   */
  async sendToolResultToAI(originalMessage, toolResult, gameContext) {
    let apiKey = setting.get('ai.deepseek_key')

    try {
      let response = await fetch(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content:
                  '你是一个围棋助手，负责将工具执行结果用自然、友好的语言总结给用户。'
              },
              {
                role: 'user',
                content: `用户问题: ${originalMessage}\n\n工具执行结果: ${JSON.stringify(
                  toolResult,
                  null,
                  2
                )}`
              }
            ]
          })
        }
      )

      let data = await response.json()
      if (data.error) {
        return {error: data.error.message || 'API Error'}
      }

      return {
        content: data.choices[0].message.content.replace(
          /\*{1,3}(.*?)\*{1,3}/g,
          '$1'
        )
      }
    } catch (err) {
      return {error: err.message}
    }
  }

  /**
   * 直接调用MCP工具
   * @param {string} toolId - 工具ID
   * @param {Object} params - 工具参数
   * @param {Object} gameContext - 游戏上下文信息
   * @returns {Promise<Object>} 工具执行结果
   */
  async callMCPTool(toolId, params, gameContext) {
    try {
      // 生成MCP消息
      let mcpMessage = mcpHelper.generateMCPMessage(toolId, params)
      if (mcpMessage.error) {
        return mcpMessage
      }

      // 处理MCP请求
      return await mcpHelper.handleMCPRequest(mcpMessage, gameContext)
    } catch (err) {
      return {error: err.message}
    }
  }
}

export default new AIHelper()
