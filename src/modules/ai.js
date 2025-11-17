import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import mcpHelper from './mcpHelper.js'
import {streamDefinition, hasApiKey} from 'llm-service-provider'
import sabaki from './sabaki.js'
import agentOrchestrator from './agentOrchestrator.js'

class AIHelper {
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

  async sendLLMMessage(message, gameContext) {
    let userMessage = message
    let parameters = {}

    if (typeof message === 'object' && message.mcp && message.mcp.tool) {
      userMessage = message.mcp.tool.description
      parameters = message.mcp.tool.parameters || {}
    }

    let fullMessage = userMessage
    if (Object.keys(parameters).length > 0) {
      const paramsStr = JSON.stringify(parameters)
      fullMessage = `${userMessage}\n\n工具参数: ${paramsStr}`
    }

    let boardContext = await agentOrchestrator.getBoardContext(gameContext)

    // 使用get-game-info工具获取棋局信息
    let gameInfo = ''
    const result_tool = await agentOrchestrator._executeTool(
      {
        name: 'get-game-info',
        type: 'info_retrieval',
        parameters: {format: 'text'}
      },
      gameContext
    )
    if (result_tool && result_tool.success && result_tool.content) {
      gameInfo = result_tool.content + '\n\n'
    }

    const provider = agentOrchestrator.getCurrentProvider()
    console.log('Selected LLM provider:', provider)

    const pre_prompt =
      '你是一个围棋助手，能够分析棋局、提供建议并回答关于围棋策略的问题。\n' +
      '\n' +
      '你有两种响应格式可以使用(优先调用工具):\n' +
      '1. 当你需要调用工具分析时，必须使用mcp格式，不要在response中提及工具名称:\n' +
      '{"mcp":{"tool":{"name":"工具名称","description":"工具描述","parameters":{参数对象}}}}' +
      '\n' +
      '2. 当你可以直接回答用户问题时，使用content格式:\n' +
      '{"content":"你的回答内容"}\n' +
      '\n'

    let prompt =
      pre_prompt +
      '\n' +
      gameInfo +
      '当前游戏状态:\n' +
      boardContext +
      '\n' +
      '用户问题:' +
      fullMessage

    const lang = setting.get('app.lang') == 'zh-Hans' ? 'zh' : 'en'
    const generator = streamDefinition({
      topic: prompt,
      language: lang,
      responseFormat: 'json'
    })

    console.log('message:', fullMessage)
    let result = ''
    for await (const chunk of generator) {
      result += chunk
    }
    console.log('raw response:', result)

    const toolDetailResponse = await this.handleToolDetailRequest(
      result,
      gameContext
    )
    if (toolDetailResponse) {
      return toolDetailResponse
    }

    let parsedResponse = JSON.parse(result.replace(/```json|```/g, ''))
    if (parsedResponse.mcp && parsedResponse.mcp.tool) {
      let toolDescription = `${provider}: ${parsedResponse.mcp.tool.description}`

      let toolResult = await mcpHelper.handleMCPRequest(
        parsedResponse,
        gameContext
      )

      if (toolResult.error) {
        return {
          content: `<div style="color: lightblue;">${toolDescription}</div><div style="color: yellow;">工具调用失败: ${toolResult.error}</div>`
        }
      }

      let resultResponse = await this.sendToolResultToAI(
        message,
        toolResult.data,
        gameContext
      )

      if (resultResponse.content) {
        resultResponse.content = `<div style="color: lightblue;">${toolDescription}</div><div style="color: lightgreen;">${resultResponse.content}</div>`
      }

      return resultResponse
    } else if (parsedResponse.content) {
      return {
        ...parsedResponse,
        content: parsedResponse.content.replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
      }
    }

    return parsedResponse
  }

  async sendToolResultToAI(originalMessage, toolResult, gameContext) {
    try {
      let prompt = `请总结以下工具执行结果，并以自然友好的语言回答用户的原始问题。

用户原始问题: ${originalMessage.description || originalMessage}

工具执行结果: ${JSON.stringify(toolResult, null, 2)}`

      let response = await this.sendLLMMessage(prompt, gameContext)
      return response
    } catch (err) {
      return {error: err.message}
    }
  }

  async handleToolDetailRequest(response, gameContext) {
    const toolNameMatch = response.match(/我需要了解(.*?)工具的详细参数/i)

    if (toolNameMatch && toolNameMatch[1]) {
      const requestedToolName = toolNameMatch[1].trim()
      const toolDetails = agentOrchestrator.getToolDetails(requestedToolName)

      if (toolDetails) {
        let prompt =
          `以下是您请求的${requestedToolName}工具的详细信息：\n${toolDetails}\n\n` +
          '请基于这些信息，决定下一步操作。如果您想使用该工具，请使用工具调用格式；\n' +
          '如果您已获得足够信息，可以直接回答用户的问题。'

        return await this.sendLLMMessage(prompt, gameContext)
      }
    }

    return null
  }

  async callMCPTool(toolId, params, gameContext) {
    try {
      let mcpMessage = mcpHelper.generateMCPMessage(toolId, params)
      if (mcpMessage.error) {
        return mcpMessage
      }

      return await mcpHelper.handleMCPRequest(mcpMessage, gameContext)
    } catch (err) {
      return {error: err.message}
    }
  }
}

export default new AIHelper()
