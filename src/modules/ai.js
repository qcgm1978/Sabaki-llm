import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import mcpHelper from './mcpHelper.js'
import {
  streamDefinition,
  getSelectedServiceProvider,
  hasApiKey
} from 'llm-service-provider'
import sabaki from './sabaki.js'

/**
 * AI助手模块，处理与DeepSeek API的交互并集成MCP协议支持
 */
class AIHelper {
  /**
   * 格式化参数要求显示
   * @param {Object} parameters - 参数对象
   * @returns {string} 格式化后的参数要求字符串
   */
  formatParameters(parameters) {
    let result = []

    if (parameters.required && parameters.required.length > 0) {
      result.push(`必填参数: ${parameters.required.join(', ')}`)
    }

    if (parameters.properties) {
      let propsInfo = []
      for (let [name, prop] of Object.entries(parameters.properties)) {
        let propDesc = `${name} (${prop.type})`
        if (prop.description) {
          propDesc += `: ${prop.description}`
        }
        if (prop.enum) {
          propDesc += ` [可选值: ${prop.enum.join(', ')}]`
        }
        if (prop.minimum !== undefined) {
          propDesc += ` [最小: ${prop.minimum}]`
        }
        propsInfo.push(propDesc)
      }
      if (propsInfo.length > 0) {
        result.push(`参数详情: ${propsInfo.join('; ')}`)
      }
    }

    return result.length > 0 ? result.join(' | ') : '无'
  }

  /**
   * 向DeepSeek API发送消息，支持MCP协议
   * @param {string} message - 用户消息
   * @param {Object} gameContext - 游戏上下文信息
   * @returns {Promise<Object>} API响应
   */
  async sendLLMMessage(message, gameContext) {
    if (!hasApiKey()) {
      return {error: 'LLM API Key not configured'}
    }

    // try {
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

    // 收集棋局元信息（从根节点获取）
    let gameInfo = ''
    let rootNode = tree.root
    if (rootNode && rootNode.data) {
      let metaInfo = []
      if (rootNode.data.GN) metaInfo.push(`赛事: ${rootNode.data.GN}`)
      if (rootNode.data.PB) metaInfo.push(`黑方: ${rootNode.data.PB}`)
      if (rootNode.data.PW) metaInfo.push(`白方: ${rootNode.data.PW}`)
      if (rootNode.data.BR) metaInfo.push(`黑方等级: ${rootNode.data.BR}`)
      if (rootNode.data.WR) metaInfo.push(`白方等级: ${rootNode.data.WR}`)
      if (rootNode.data.KM) metaInfo.push(`贴目: ${rootNode.data.KM}`)
      if (rootNode.data.RU) metaInfo.push(`规则: ${rootNode.data.RU}`)
      if (rootNode.data.SZ) metaInfo.push(`棋盘大小: ${rootNode.data.SZ}`)
      if (rootNode.data.HA) metaInfo.push(`让子数: ${rootNode.data.HA}`)
      if (rootNode.data.RE) metaInfo.push(`结果: ${rootNode.data.RE}`)

      if (metaInfo.length > 0) {
        gameInfo = '棋局信息:\n' + metaInfo.join('\n') + '\n\n'
      }
    }

    // 获取可用的MCP工具列表
    let availableTools = mcpHelper.getAvailableEndpoints()

    // 构建工具信息提示，包含参数要求
    let toolsInfo = availableTools
      .map(
        tool => `
  - 工具名称: ${tool.name}
    描述: ${tool.description}
    参数要求: ${
      tool.parameters ? this.formatParameters(tool.parameters) : '无'
    }`
      )
      .join('')

    // 获取选中的服务提供商
    const provider = getSelectedServiceProvider()
    console.log('Selected LLM provider:', provider)

    const pre_prompt =
      '你是一个围棋助手，能够分析棋局、提供建议并回答关于围棋策略的问题。请注意，你必须返回json格式的响应，不要在JSON前后添加任何其他文本（如```json等标记）。\n' +
      '\n' +
      '你有两种响应格式可以使用:\n' +
      '1. 当你可以直接回答用户问题时，使用response格式:\n' +
      '{"response":"你的回答内容"}\n' +
      '\n' +
      '2. 当你需要调用工具进行深入分析时，必须使用mcp格式，不要在response中提及工具名称:\n' +
      '{"mcp":{"tool":{"name":"工具名称","description":"工具描述","parameters":{参数对象}}}}' +
      '\n' +
      '你可以使用以下MCP工具:\n'
    // 使用llm-service-provider的流式生成功能
    let prompt =
      pre_prompt +
      toolsInfo +
      '\n' +
      gameInfo +
      '当前游戏状态:\n' +
      boardContext +
      '\n' +
      message

    const generator = streamDefinition(prompt, 'zh')
    console.log('Prompt:', pre_prompt)
    let result = ''
    for await (const chunk of generator) {
      result += chunk
    }

    // // 如果是json_object格式，需要从content中解析出实际内容
    // if (
    //   typeof result === 'string' &&
    //   result.startsWith('{') &&
    //   result.endsWith('}')
    // ) {
    //   try {
    //     let parsed = JSON.parse(result)
    //     if (parsed.content) result = parsed.content
    //   } catch (e) {
    //     // 如果解析失败，保持原内容不变
    //   }
    // }

    // 检查响应是否包含MCP工具调用
    let parsedResponse = JSON.parse(result.replace(/```json|```/g, ''))
    if (parsedResponse.mcp && parsedResponse.mcp.tool) {
      let content = `${provider}: ${parsedResponse.mcp.tool.description}`

      if (sabaki.aiManager && sabaki.aiManager.addAIMessage) {
        sabaki.aiManager.addAIMessage(content)
      }

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
    } else if (parsedResponse.response) {
      // 如果响应包含response属性，使用该属性的值
      return {
        content: parsedResponse.response.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
      }
    }

    // 移除Markdown格式并返回内容
    return {
      content: (typeof result === 'string' ? result : String(result)).replace(
        /\*{1,3}(.*?)\*{1,3}/g,
        '$1'
      )
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
    try {
      // 构建发送给AI的提示文本
      let prompt = `请总结以下工具执行结果，并以自然友好的语言回答用户的原始问题。

用户原始问题: ${originalMessage}

工具执行结果: ${JSON.stringify(toolResult, null, 2)}`

      // 使用sendLLMMessage方法替代直接调用DeepSeek API
      let response = await this.sendLLMMessage(prompt, gameContext)
      return response
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
