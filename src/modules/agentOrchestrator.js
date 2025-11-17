import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import ai from './ai.js'
import mcpHelper from './mcpHelper.js'
import sabaki from './sabaki.js'
import {getSelectedServiceProvider} from 'llm-service-provider'

export const AGENT_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  ACTING: 'acting',
  OBSERVING: 'observing',
  ERROR: 'error',
  PAUSED: 'paused'
}

export const ERROR_TYPES = {
  LLM_ERROR: 'llm_error',
  TOOL_ERROR: 'tool_error',
  VALIDATION_ERROR: 'validation_error',
  TIMEOUT_ERROR: 'timeout_error',
  UNKNOWN_ERROR: 'unknown_error'
}

// 工具类型常量
export const TOOL_TYPES = {
  // 信息检索类：用于获取和查询系统或外部信息的工具
  INFO_RETRIEVAL: 'info_retrieval',
  // 执行/动作类：执行具体操作或控制的工具
  EXECUTION: 'execution',
  // 系统/API集成类：与其他系统或API进行交互的工具
  SYSTEM_INTEGRATION: 'system_integration',
  // 人机协作类：促进人机交互和协作的工具
  HUMAN_COLLABORATION: 'human_collaboration'
}

export class AgentOrchestrator {
  constructor() {
    this.agentState = {
      currentStep: AGENT_STATES.IDLE,
      history: [],
      conversationContext: null,
      lastActionResult: null,
      isRunning: false,
      error: null,
      executionCount: 0,
      maxSteps: 20,
      startTime: null,
      timeout: 300000,
      retryCount: 0,
      maxRetries: 3
    }

    // 工具控制配置
    this.toolConfig = {
      includeBoardContext: true, // 控制是否包含boardContext数据
      boardContextMaxLength: 1000 // boardContext最大长度限制
    }

    this.boardDisplayState = {
      markers: {},
      highlights: [],
      heatMap: {},
      lines: [],
      variationMoves: null,
      variationSign: 1,
      variationSibling: false,
      activeDisplayId: null,
      displayHistory: []
    }

    this.thoughtProcessHandlers = {
      analyze: this._analyzeThought.bind(this),
      plan: this._planThought.bind(this),
      decide: this._decideThought.bind(this)
    }

    this.stateListeners = []

    this.errorHandlers = []
  }

  addStateListener(listener) {
    if (typeof listener === 'function') {
      this.stateListeners.push(listener)
    }
  }

  removeStateListener(listener) {
    this.stateListeners = this.stateListeners.filter(l => l !== listener)
  }

  addErrorHandler(handler) {
    if (typeof handler === 'function') {
      this.errorHandlers.push(handler)
    }
  }

  removeErrorHandler(handler) {
    this.errorHandlers = this.errorHandlers.filter(h => h !== handler)
  }

  _emitStateChange(newState) {
    const oldState = this.agentState.currentStep
    this.agentState.currentStep = newState

    this.stateListeners.forEach(listener => {
      listener(newState, oldState)
    })
  }

  _handleError(error, errorType = ERROR_TYPES.UNKNOWN_ERROR) {
    const errorObj = {
      type: errorType,
      message: error.message || String(error),
      stack: error.stack,
      timestamp: Date.now(),
      context: {
        currentStep: this.agentState.currentStep,
        executionCount: this.agentState.executionCount
      }
    }

    console.error('Agent error:', errorObj)
    this.agentState.error = errorObj

    this._emitStateChange(AGENT_STATES.ERROR)

    this.errorHandlers.forEach(handler => {
      handler(errorObj)
    })

    return errorObj
  }

  _checkTimeout() {
    if (!this.agentState.startTime) return false

    const elapsed = Date.now() - this.agentState.startTime
    return elapsed > this.agentState.timeout
  }

  async run(userMessage, gameContext, options = {}) {
    this.reset()

    if (options.maxSteps) this.agentState.maxSteps = options.maxSteps
    if (options.timeout) this.agentState.timeout = options.timeout
    if (options.maxRetries) this.agentState.maxRetries = options.maxRetries

    this.agentState.isRunning = true
    this.agentState.startTime = Date.now()
    this.agentState.conversationContext = {
      initialMessage: userMessage,
      gameContext: gameContext
    }

    this.agentState.history.push({
      type: 'user',
      content: userMessage,
      timestamp: Date.now()
    })

    this._emitStateChange(AGENT_STATES.THINKING)

    const result = await this._loop()
    return result
  }

  async _loop() {
    while (this.agentState.isRunning) {
      if (this.agentState.executionCount >= this.agentState.maxSteps) {
        const error = new Error(
          `Maximum execution steps (${this.agentState.maxSteps}) reached`
        )
        this._handleError(error, ERROR_TYPES.TIMEOUT_ERROR)
        return {error: error.message}
      }

      if (this._checkTimeout()) {
        const error = new Error(
          `Execution timed out after ${this.agentState.timeout}ms`
        )
        this._handleError(error, ERROR_TYPES.TIMEOUT_ERROR)
        return {error: error.message}
      }

      this.agentState.executionCount++
      let thoughtResult, actionResult, observation

      thoughtResult = await this._executeWithTimeout(
        this._think.bind(this),
        60000
      )

      if (thoughtResult.error) {
        if (this._shouldRetry()) {
          continue
        }
        return {error: thoughtResult.error}
      }

      actionResult = await this._executeWithTimeout(
        () => this._act(thoughtResult),
        120000
      )

      if (actionResult.error) {
        if (this._shouldRetry()) {
          continue
        }
        return {error: actionResult.error}
      }

      observation = await this._executeWithTimeout(
        () => this._observe(actionResult),
        30000
      )

      if (observation.shouldTerminate || !actionResult.shouldContinue) {
        return this._summarize(observation)
      }
    }

    return {error: 'Agent execution stopped'}
  }

  async _executeWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      fn().then(
        result => {
          clearTimeout(timeoutId)
          resolve(result)
        },
        error => {
          clearTimeout(timeoutId)
          reject(error)
        }
      )
    })
  }

  _shouldRetry() {
    if (this.agentState.retryCount < this.agentState.maxRetries) {
      this.agentState.retryCount++
      console.warn(
        `Retrying operation... Attempt ${this.agentState.retryCount}/${this.agentState.maxRetries}`
      )
      return true
    }
    return false
  }

  async _think() {
    this._emitStateChange(AGENT_STATES.THINKING)

    const thoughtPrompt = this._buildThoughtPrompt()

    const thoughtResponse = await ai.sendLLMMessage(
      thoughtPrompt,
      this.agentState.conversationContext.gameContext
    )

    if (!thoughtResponse || thoughtResponse.error) {
      throw new Error(thoughtResponse?.error || 'Failed to get LLM response')
    }

    const thoughtResult = this._parseThoughtResponse(thoughtResponse)

    this.agentState.history.push({
      type: 'thought',
      content: thoughtResult,
      timestamp: Date.now(),
      executionStep: this.agentState.executionCount
    })

    return thoughtResult
  }

  async _act(thoughtResult) {
    this._emitStateChange(AGENT_STATES.ACTING)

    if (!thoughtResult || typeof thoughtResult !== 'object') {
      throw new Error('Invalid thought result format')
    }

    let actionResult = {shouldContinue: true}

    switch (thoughtResult.action) {
      case 'tool_call':
        if (!thoughtResult.tool || !thoughtResult.tool.name) {
          throw new Error('Invalid tool information')
        }
        actionResult = await this._executeTool(thoughtResult.tool)
        break

      case 'respond':
        actionResult = {
          shouldContinue: false,
          result: {content: thoughtResult.content || 'No response content'}
        }
        break

      case 'ask_clarification':
        actionResult = {
          shouldContinue: false,
          result: {
            content: thoughtResult.content || '需要更多信息',
            needsClarification: true
          }
        }
        break

      default:
        actionResult = {
          shouldContinue: false,
          result: {
            content: thoughtResult.content || '抱歉，我无法理解您的问题'
          }
        }
    }

    this.agentState.lastActionResult = actionResult
    return actionResult
  }

  async _observe(actionResult) {
    this._emitStateChange(AGENT_STATES.OBSERVING)

    if (!actionResult || typeof actionResult !== 'object') {
      throw new Error('Invalid action result format')
    }

    if (actionResult.error) {
      return {
        shouldTerminate: true,
        result: {error: actionResult.error}
      }
    }

    if (!actionResult.shouldContinue) {
      return {
        shouldTerminate: true,
        result: actionResult.result || {content: 'Operation completed'}
      }
    }

    if (actionResult.toolResult) {
      this.agentState.history.push({
        type: 'tool_result',
        content: actionResult.toolResult,
        timestamp: Date.now(),
        executionStep: this.agentState.executionCount
      })

      this.agentState.conversationContext.lastToolResult =
        actionResult.toolResult

      this.agentState.retryCount = 0

      return {
        shouldTerminate: false,
        context: actionResult.toolResult
      }
    }

    return {
      shouldTerminate: true,
      result: {error: 'Unknown observation state'}
    }
  }

  async _executeTool(toolInfo) {
    this.agentState.history.push({
      type: 'tool_call',
      content: toolInfo,
      timestamp: Date.now()
    })

    const validatedToolInfo = this._validateToolParameters(toolInfo)

    // 获取gameContext，添加空值检查
    const gameContext = this.agentState.conversationContext?.gameContext || null

    // 根据工具类型执行不同的逻辑
    let toolResult

    switch (validatedToolInfo.type) {
      case TOOL_TYPES.INFO_RETRIEVAL:
      case TOOL_TYPES.EXECUTION:
        // 信息检索和执行工具的特殊处理逻辑
        console.log(`执行信息检索/执行工具: ${validatedToolInfo.name}`)
        toolResult = await this._executeBuiltinTool(validatedToolInfo)
        break

      case TOOL_TYPES.SYSTEM_INTEGRATION:
        // 系统/API集成工具的特殊处理逻辑
        console.log(`执行系统/API集成工具: ${validatedToolInfo.name}`)
        toolResult = await mcpHelper.handleMCPRequest(
          {
            mcp: {
              tool: validatedToolInfo
            }
          },
          gameContext
        )
        break

      case TOOL_TYPES.HUMAN_COLLABORATION:
        // 人机协作工具的特殊处理逻辑
        console.log(`执行人机协作工具: ${validatedToolInfo.name}`)
        toolResult = await this._executeAgentTool(validatedToolInfo)
        break

      default:
        // 未指定类型的工具默认使用系统/API集成工具处理流程
        console.log(`执行默认工具: ${validatedToolInfo.name}`)
        toolResult = await mcpHelper.handleMCPRequest(
          {
            mcp: {
              tool: validatedToolInfo
            }
          },
          gameContext
        )
        break
    }

    return this._processToolResult(toolResult)
  }

  // 执行内置工具的方法
  async _executeBuiltinTool(toolInfo) {
    // 获取gameContext，添加空值检查
    const gameContext = this.agentState.conversationContext?.gameContext || null
    // 内置工具默认也走MCP请求流程，可以在这里添加特定的内置工具处理
    return await mcpHelper.handleMCPRequest(
      {
        mcp: {
          tool: toolInfo
        }
      },
      gameContext
    )
  }

  // 执行智能体工具的方法
  async _executeAgentTool(toolInfo) {
    // 获取gameContext，添加空值检查
    const gameContext = this.agentState.conversationContext?.gameContext || null
    // 智能体工具默认也走MCP请求流程，可以在这里添加特定的智能体工具处理
    return await mcpHelper.handleMCPRequest(
      {
        mcp: {
          tool: toolInfo
        }
      },
      this.agentState.conversationContext.gameContext
    )
  }

  _validateToolParameters(toolInfo) {
    const validatedParams = {...toolInfo}
    const availableTools = this.getAvailableTools()
    const tool = availableTools.find(e => e.name === toolInfo.name)

    if (tool) {
      // 保留工具类型信息
      validatedParams.type = tool.type

      if (tool.parameters) {
        if (!validatedParams.parameters) {
          validatedParams.parameters = {}
        }

        if (tool.parameters.properties) {
          Object.keys(tool.parameters.properties).forEach(key => {
            const prop = tool.parameters.properties[key]
            if (
              prop.default !== undefined &&
              validatedParams.parameters[key] === undefined
            ) {
              validatedParams.parameters[key] = prop.default
            }
          })
        }
      }
    }

    return validatedParams
  }

  _processToolResult(toolResult) {
    if (toolResult.error) {
      return {
        shouldContinue: false,
        error: toolResult.error
      }
    }

    return {
      shouldContinue: true,
      toolResult: toolResult
    }
  }

  // 根据工具类型获取可用工具
  getAvailableTools(toolType = null) {
    const endpoints = mcpHelper.getAvailableEndpoints()

    // 确保每个工具都有类型标识，如果没有则默认为函数工具
    const toolsWithType = endpoints.map(tool => ({
      ...tool,
      type: tool.type || TOOL_TYPES.EXECUTION
    }))

    // 如果指定了工具类型，则过滤返回对应类型的工具
    if (toolType && Object.values(TOOL_TYPES).includes(toolType)) {
      return toolsWithType.filter(tool => tool.type === toolType)
    }

    return toolsWithType
  }

  // 获取按类型分组的工具
  getToolsByType() {
    const tools = this.getAvailableTools()
    const grouped = {
      [TOOL_TYPES.INFO_RETRIEVAL]: [],
      [TOOL_TYPES.EXECUTION]: [],
      [TOOL_TYPES.SYSTEM_INTEGRATION]: [],
      [TOOL_TYPES.HUMAN_COLLABORATION]: []
    }

    tools.forEach(tool => {
      if (grouped.hasOwnProperty(tool.type)) {
        grouped[tool.type].push(tool)
      } else {
        // 未知类型默认为函数工具
        grouped[tool.type].push(tool)
      }
    })

    return grouped
  }

  getCurrentProvider() {
    return getSelectedServiceProvider()
  }

  /**
   * 设置工具配置
   */
  setToolConfig(config) {
    if (config && typeof config === 'object') {
      this.toolConfig = {
        ...this.toolConfig,
        ...config
      }
    }
  }

  /**
   * 获取工具配置
   */
  getToolConfig() {
    return {...this.toolConfig}
  }

  /**
   * 获取boardContext数据
   * 根据配置决定是否返回boardContext
   */
  async getBoardContext(gameContext) {
    if (!this.toolConfig.includeBoardContext) {
      return ''
    }

    const result = await mcpHelper.handleMCPRequest(
      {
        mcp: {
          tool: {
            name: '获取棋盘上下文',
            parameters: {includeFullHistory: true}
          }
        }
      },
      gameContext
    )

    if (result.success && result.data && result.data.boardContext) {
      let boardContext = result.data.boardContext

      // 如果设置了最大长度限制，并且boardContext超过了这个限制，则截断
      if (
        this.toolConfig.boardContextMaxLength > 0 &&
        boardContext.length > this.toolConfig.boardContextMaxLength
      ) {
        boardContext =
          boardContext.substring(0, this.toolConfig.boardContextMaxLength) +
          '...'
      }

      return boardContext
    }

    return ''
  }

  formatToolsList(detailed = false, includePrefix = false, grouped = true) {
    if (grouped) {
      const toolsByType = this.getToolsByType()
      let toolsList = ''

      // 按类型分组格式化工具列表
      const typeNames = {
        [TOOL_TYPES.INFO_RETRIEVAL]: '信息检索工具',
        [TOOL_TYPES.EXECUTION]: '执行/动作工具',
        [TOOL_TYPES.SYSTEM_INTEGRATION]: '系统/API集成工具',
        [TOOL_TYPES.HUMAN_COLLABORATION]: '人机协作工具'
      }

      Object.entries(toolsByType).forEach(([type, tools]) => {
        if (tools.length > 0) {
          toolsList += `\n${typeNames[type]} (${tools.length}个):\n`

          if (detailed) {
            toolsList += tools
              .map(
                tool => `  - 工具名称: ${tool.name}
    描述: ${tool.description}
    参数要求: ${
      tool.parameters ? this._formatParameters(tool.parameters) : '无'
    }`
              )
              .join('\n')
          } else {
            toolsList += tools
              .map(tool => `  - ${tool.name}: ${tool.description}`)
              .join('\n')
          }

          toolsList += '\n'
        }
      })

      return includePrefix ? `你可以使用以下工具:\n${toolsList}` : toolsList
    } else {
      // 兼容原有格式，不分组显示
      const availableTools = this.getAvailableTools()

      if (detailed) {
        const toolsList = availableTools
          .map(
            tool => `
  - 工具名称: ${tool.name}\n    类型: ${this._getToolTypeName(
              tool.type
            )}\n    描述: ${tool.description}\n    参数要求: ${
              tool.parameters ? this._formatParameters(tool.parameters) : '无'
            }`
          )
          .join('')
        return includePrefix
          ? `你可以使用以下MCP工具:\n${toolsList}`
          : toolsList
      } else {
        const toolsList = availableTools
          .map(
            tool =>
              `  - ${tool.name} [${this._getToolTypeName(tool.type)}]: ${
                tool.description
              }`
          )
          .join('\n')
        return includePrefix ? `可用工具:\n${toolsList}` : toolsList
      }
    }
  }

  // 获取工具类型的中文名称
  _getToolTypeName(type) {
    const typeNames = {
      [TOOL_TYPES.INFO_RETRIEVAL]: '信息检索',
      [TOOL_TYPES.EXECUTION]: '执行',
      [TOOL_TYPES.SYSTEM_INTEGRATION]: '集成',
      [TOOL_TYPES.HUMAN_COLLABORATION]: '协作'
    }
    return typeNames[type] || '函数'
  }

  // 获取单个工具的详细信息
  getToolDetails(toolName) {
    const availableTools = this.getAvailableTools()
    const tool = availableTools.find(t => t.name === toolName)

    if (!tool) {
      return null
    }

    return `
  - 工具名称: ${tool.name}
    类型: ${this._getToolTypeName(tool.type)}
    描述: ${tool.description}
    参数要求: ${
      tool.parameters ? this._formatParameters(tool.parameters) : '无'
    }`
  }

  _formatParameters(parameters) {
    let result = []

    if (parameters.required && parameters.required.length > 0) {
      result.push(`必填参数: ${parameters.required.join(', ')}`)
    }

    if (parameters.properties) {
      let propsInfo = []
      for (const [name, param] of Object.entries(parameters.properties)) {
        let propDesc = `${name}`
        if (param.type) propDesc += ` (${param.type})`
        if (param.description) propDesc += ` - ${param.description}`
        if (param.default !== undefined) {
          propDesc += ` [默认: ${JSON.stringify(param.default)}]`
        }
        propsInfo.push(propDesc)
      }
      if (propsInfo.length > 0) {
        result.push(`可选参数: ${propsInfo.join(', ')}`)
      }
    }

    return result.join('; ')
  }

  async _analyzeThought(boardContext) {
    return this.thoughtProcessHandlers.analyze(boardContext)
  }

  async _planThought(analysis) {
    return this.thoughtProcessHandlers.plan(analysis)
  }

  async _decideThought(plan) {
    return this.thoughtProcessHandlers.decide(plan)
  }

  _buildThoughtPrompt() {
    const toolsList = this.formatToolsList(false, true, true)
    const {lastToolResult} = this.agentState.conversationContext || {}

    let prompt = `你是一个围棋助手，需要分析最新的用户请求和工具执行结果，然后决定下一步操作。\n\n`

    prompt += `用户历史消息:\n`
    this.agentState.history.forEach(item => {
      if (item.type === 'user') {
        prompt += `- ${item.content}\n`
      }
    })

    if (lastToolResult) {
      prompt += `\n最近的工具执行结果:\n${JSON.stringify(
        lastToolResult,
        null,
        2
      )}\n`
    }

    prompt += `\n${toolsList}\n\n`

    prompt += `请你根据以上信息，决定是调用工具、直接回答用户还是追问用户。\n\n`

    prompt += `输出格式要求:\n`
    prompt += `1. 如果决定调用工具，包含以下字段:\n`
    prompt += `   {"action":"tool_call","tool":{"name":"工具名称","parameters":{参数对象}}}\n`
    prompt += `2. 如果决定直接回答用户，\n`
    prompt += `   {"action":"respond","content":"回答内容"}\n`
    prompt += `3. 如果需要追问用户，\n`
    prompt += `   {"action":"ask_clarification","content":"追问内容"}\n`

    return prompt
  }

  _parseThoughtResponse(response) {
    let parsedResponse

    if (typeof response === 'object') {
      parsedResponse = response
    } else {
      try {
        parsedResponse = JSON.parse(response)
      } catch (parseError) {
        throw new Error(`无法解析LLM响应: ${parseError.message}`)
      }
    }

    if (!parsedResponse.action) {
      throw new Error('LLM响应缺少action字段')
    }

    return parsedResponse
  }

  _summarize(observation) {
    if (!observation.result) {
      observation.result = {content: '操作已完成'}
    }

    return observation.result
  }

  reset() {
    this.agentState = {
      currentStep: AGENT_STATES.IDLE,
      history: [],
      conversationContext: null,
      lastActionResult: null,
      isRunning: false,
      error: null,
      executionCount: 0,
      maxSteps: this.agentState.maxSteps,
      startTime: null,
      timeout: this.agentState.timeout,
      retryCount: 0,
      maxRetries: this.agentState.maxRetries
    }

    this._emitStateChange(AGENT_STATES.IDLE)
  }

  stop() {
    this.agentState.isRunning = false
    this._emitStateChange(AGENT_STATES.PAUSED)
  }

  pause() {
    this.agentState.isRunning = false
    this._emitStateChange(AGENT_STATES.PAUSED)
  }

  resume() {
    if (!this.agentState.isRunning) {
      this.agentState.isRunning = true
      this._loop()
    }
  }

  /**
   * 获取执行统计信息
   */
  getStats() {
    const currentTime = Date.now()
    const elapsedTime = this.agentState.startTime
      ? currentTime - this.agentState.startTime
      : 0
    const remainingSteps =
      this.agentState.maxSteps - this.agentState.executionCount

    return {
      currentStep: this.agentState.currentStep,
      executionCount: this.agentState.executionCount,
      maxSteps: this.agentState.maxSteps,
      remainingSteps: remainingSteps > 0 ? remainingSteps : 0,
      elapsedTime: Math.floor(elapsedTime / 1000), // 转换为秒
      timeout: this.agentState.timeout,
      retryCount: this.agentState.retryCount,
      maxRetries: this.agentState.maxRetries,
      hasError: !!this.agentState.error,
      error: this.agentState.error
    }
  }
}

export default new AgentOrchestrator()
