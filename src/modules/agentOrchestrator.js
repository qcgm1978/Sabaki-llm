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
  // 函数工具：执行特定功能的工具，通常与外部系统交互
  FUNCTION: 'function',
  // 内置工具：AgentOrchestrator内部提供的基础工具
  BUILTIN: 'builtin',
  // 智能体工具：由智能体自身提供的复杂功能工具
  AGENT: 'agent'
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
      try {
        listener(newState, oldState)
      } catch (err) {
        console.error('State listener error:', err)
      }
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
      try {
        handler(errorObj)
      } catch (err) {
        console.error('Error handler error:', err)
      }
    })

    return errorObj
  }

  _checkTimeout() {
    if (!this.agentState.startTime) return false

    const elapsed = Date.now() - this.agentState.startTime
    return elapsed > this.agentState.timeout
  }

  async run(userMessage, gameContext, options = {}) {
    try {
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
    } catch (error) {
      const errorObj = this._handleError(error)
      return {error: errorObj.message}
    } finally {
      this.agentState.isRunning = false
    }
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

      try {
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
      } catch (error) {
        const errorObj = this._handleError(error)

        if (this._shouldRetry()) {
          continue
        }

        return {error: errorObj.message}
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

    try {
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
    } catch (error) {
      this._handleError(error, ERROR_TYPES.LLM_ERROR)
      return {
        error: error.message,
        action: 'respond',
        content: `思考过程中发生错误: ${error.message}`
      }
    }
  }

  async _act(thoughtResult) {
    this._emitStateChange(AGENT_STATES.ACTING)

    try {
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
    } catch (error) {
      this._handleError(error, ERROR_TYPES.TOOL_ERROR)
      return {
        shouldContinue: false,
        error: error.message
      }
    }
  }

  async _observe(actionResult) {
    this._emitStateChange(AGENT_STATES.OBSERVING)

    try {
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
    } catch (error) {
      this._handleError(error)
      return {
        shouldTerminate: true,
        result: {error: error.message}
      }
    }
  }

  async _executeTool(toolInfo) {
    try {
      this.agentState.history.push({
        type: 'tool_call',
        content: toolInfo,
        timestamp: Date.now()
      })

      const validatedToolInfo = this._validateToolParameters(toolInfo)
      
      // 根据工具类型执行不同的逻辑
      let toolResult
      
      switch (validatedToolInfo.type) {
        case TOOL_TYPES.BUILTIN:
          // 内置工具的特殊处理逻辑可以在这里添加
          // 目前默认走标准流程
          console.log(`执行内置工具: ${validatedToolInfo.name}`)
          toolResult = await this._executeBuiltinTool(validatedToolInfo)
          break
          
        case TOOL_TYPES.AGENT:
          // 智能体工具的特殊处理逻辑
          console.log(`执行智能体工具: ${validatedToolInfo.name}`)
          toolResult = await this._executeAgentTool(validatedToolInfo)
          break
          
        case TOOL_TYPES.FUNCTION:
        default:
          // 函数工具和未指定类型的工具使用标准MCP请求流程
          console.log(`执行函数工具: ${validatedToolInfo.name}`)
          toolResult = await mcpHelper.handleMCPRequest(
            {
              mcp: {
                tool: validatedToolInfo
              }
            },
            this.agentState.conversationContext.gameContext
          )
          break
      }

      return this._processToolResult(toolResult)
    } catch (error) {
      console.error('Tool execution error:', error)
      return {
        shouldContinue: false,
        error: error.message
      }
    }
  }
  
  // 执行内置工具的方法
  async _executeBuiltinTool(toolInfo) {
    // 内置工具默认也走MCP请求流程，可以在这里添加特定的内置工具处理
    return await mcpHelper.handleMCPRequest(
      {
        mcp: {
          tool: toolInfo
        }
      },
      this.agentState.conversationContext.gameContext
    )
  }
  
  // 执行智能体工具的方法
  async _executeAgentTool(toolInfo) {
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
      type: tool.type || TOOL_TYPES.FUNCTION
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
      [TOOL_TYPES.FUNCTION]: [],
      [TOOL_TYPES.BUILTIN]: [],
      [TOOL_TYPES.AGENT]: []
    }
    
    tools.forEach(tool => {
      if (grouped.hasOwnProperty(tool.type)) {
        grouped[tool.type].push(tool)
      } else {
        // 未知类型默认为函数工具
        grouped[TOOL_TYPES.FUNCTION].push(tool)
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

    try {
      const result = await mcpHelper.handleMCPRequest(
        {
          mcp: {
            tool: {
              name: 'get-board-context',
              parameters: { includeFullHistory: true }
            }
          }
        },
        gameContext
      )
      
      if (result.success && result.data && result.data.boardContext) {
        let boardContext = result.data.boardContext
        
        // 如果设置了最大长度限制，并且boardContext超过了这个限制，则截断
        if (this.toolConfig.boardContextMaxLength > 0 && 
            boardContext.length > this.toolConfig.boardContextMaxLength) {
          boardContext = boardContext.substring(0, this.toolConfig.boardContextMaxLength) + '...'
        }
        
        return boardContext
      }
      
      return ''
    } catch (error) {
      console.error('获取boardContext时出错:', error)
      return ''
    }
  }

  formatToolsList(detailed = false, includePrefix = false, grouped = true) {
    if (grouped) {
      const toolsByType = this.getToolsByType()
      let toolsList = ''
      
      // 按类型分组格式化工具列表
      const typeNames = {
        [TOOL_TYPES.FUNCTION]: '函数工具',
        [TOOL_TYPES.BUILTIN]: '内置工具',
        [TOOL_TYPES.AGENT]: '智能体工具'
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
  - 工具名称: ${tool.name}\n    类型: ${this._getToolTypeName(tool.type)}\n    描述: ${tool.description}\n    参数要求: ${
      tool.parameters ? this._formatParameters(tool.parameters) : '无'
    }`
          )
          .join('')
        return includePrefix ? `你可以使用以下MCP工具:\n${toolsList}` : toolsList
      } else {
        const toolsList = availableTools
          .map(tool => `  - ${tool.name} [${this._getToolTypeName(tool.type)}]: ${tool.description}`)
          .join('\n')
        return includePrefix ? `可用工具:\n${toolsList}` : toolsList
      }
    }
  }
  
  // 获取工具类型的中文名称
  _getToolTypeName(type) {
    const typeNames = {
      [TOOL_TYPES.FUNCTION]: '函数',
      [TOOL_TYPES.BUILTIN]: '内置',
      [TOOL_TYPES.AGENT]: '智能体'
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
        if (param.description) {
          propDesc += `: ${param.description}`
        }
        if (param.enum) {
          propDesc += ` [可选值: ${param.enum.join(', ')}]`
        }
        if (param.minimum !== undefined) {
          propDesc += ` [最小: ${param.minimum}]`
        }
        propsInfo.push(propDesc)
      }
      if (propsInfo.length > 0) {
        result.push(`参数详情: ${propsInfo.join('; ')}`)
      }
    }

    return result.length > 0 ? result.join(' | ') : '无'
  }

  _buildThoughtPrompt() {
    const {initialMessage, lastToolResult} = this.agentState.conversationContext

    // 使用分组格式的工具列表，便于模型理解不同类型的工具
    const toolsList = this.formatToolsList(false, true, true)

    let prompt =
      '你是智能体的思考中心。基于用户问题和对话历史，分析当前情况并决定下一步行动。\n\n'

    prompt += toolsList
    prompt += `用户问题: ${JSON.stringify(initialMessage)}\n\n`

    if (lastToolResult) {
      prompt += `最近工具调用结果: ${JSON.stringify(lastToolResult)}\n\n`
    }

    prompt += '请分析当前情况并决定执行以下哪个行动:\n'
    prompt += '1. 使用工具: 调用适当类型的工具获取更多信息或执行操作\n'
    prompt += '2. 直接回答: 已经有足够信息回答用户问题\n'
    prompt += '3. 请求澄清: 需要用户提供更多信息\n\n'

    prompt += '请以JSON格式返回你的决定:\n'
    prompt +=
      '{"mcp": {"tool": {"name": "工具名称", "type": "工具类型", "description": "工具描述", "parameters": {...}}}, "action": "tool_call|respond|ask_clarification", "content": "思考内容"} 或 {"action": "respond|ask_clarification", "content": "回答或澄清内容"}'

    const provider = this.getCurrentProvider()
    if (provider) {
      prompt += `\n\n[Provider: ${provider}]`
    }

    return prompt
  }

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

  _summarize(observation) {
    const result = observation.result || {content: '操作已完成'}

    this.agentState.history.push({
      type: 'result',
      content: result,
      timestamp: Date.now()
    })

    return result
  }

  getState() {
    return {...this.agentState}
  }

  stop() {
    this.agentState.isRunning = false
    this.agentState.currentStep = 'idle'
  }

  reset(resetListeners = false) {
    this.agentState = {
      currentStep: AGENT_STATES.IDLE,
      history: [],
      conversationContext: null,
      lastActionResult: null,
      isRunning: false,
      error: null,
      executionCount: 0,
      maxSteps: 10,
      startTime: null,
      timeout: 300000,
      retryCount: 0,
      maxRetries: 3
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

    if (resetListeners) {
      this.stateListeners = []
      this.errorHandlers = []
    }

    this._emitStateChange(AGENT_STATES.IDLE)
  }

  setBoardMarkers(vertices, markerInfo, displayId = null) {
    this._updateDisplayId(displayId)

    vertices.forEach(vertex => {
      const key = vertex.join(',')
      this.boardDisplayState.markers[key] = {...markerInfo}
    })

    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  clearBoardMarkers(vertices = null, displayId = null) {
    this._updateDisplayId(displayId)

    if (vertices) {
      vertices.forEach(vertex => {
        const key = vertex.join(',')
        delete this.boardDisplayState.markers[key]
      })
    } else {
      this.boardDisplayState.markers = {}
    }

    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  setBoardHighlights(vertices, displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.highlights = [...vertices]
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  clearBoardHighlights(displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.highlights = []
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  setBoardHeatMap(heatMapData, displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.heatMap = {...heatMapData}
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  clearBoardHeatMap(displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.heatMap = {}
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  addBoardLines(lines, displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.lines.push(...lines)
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  clearBoardLines(displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.lines = []
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  setVariationMoves(moves, sign = 1, sibling = false, displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.variationMoves = moves
    this.boardDisplayState.variationSign = sign
    this.boardDisplayState.variationSibling = sibling
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  clearVariationMoves(displayId = null) {
    this._updateDisplayId(displayId)
    this.boardDisplayState.variationMoves = null
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  saveDisplayState(label) {
    const stateSnapshot = this._getDisplayState()
    this.boardDisplayState.displayHistory.push({
      id: Date.now().toString(),
      label,
      timestamp: Date.now(),
      state: stateSnapshot
    })
    return stateSnapshot
  }

  restoreDisplayState(historyId) {
    const historyItem = this.boardDisplayState.displayHistory.find(
      item => item.id === historyId
    )

    if (historyItem) {
      Object.assign(this.boardDisplayState, historyItem.state)
      this._emitBoardDisplayChange()
      return true
    }
    return false
  }

  clearAllBoardDisplay() {
    this.boardDisplayState.markers = {}
    this.boardDisplayState.highlights = []
    this.boardDisplayState.heatMap = {}
    this.boardDisplayState.lines = []
    this.boardDisplayState.variationMoves = null
    this._emitBoardDisplayChange()
    return this._getDisplayState()
  }

  _getDisplayState() {
    return {
      markers: {...this.boardDisplayState.markers},
      highlights: [...this.boardDisplayState.highlights],
      heatMap: {...this.boardDisplayState.heatMap},
      lines: [...this.boardDisplayState.lines],
      variationMoves: this.boardDisplayState.variationMoves,
      variationSign: this.boardDisplayState.variationSign,
      variationSibling: this.boardDisplayState.variationSibling,
      activeDisplayId: this.boardDisplayState.activeDisplayId
    }
  }

  _updateDisplayId(displayId) {
    if (displayId) {
      this.boardDisplayState.activeDisplayId = displayId
    }
  }

  _emitBoardDisplayChange() {
    this.stateListeners.forEach(listener => {
      try {
        if (
          listener.constructor.name === 'Function' ||
          typeof listener === 'function'
        ) {
          const isBoardDisplayListener = listener
            .toString()
            .includes('boardDisplayChange')
          if (isBoardDisplayListener) {
            listener('boardDisplayChange', this._getDisplayState())
          }
        } else if (listener.onBoardDisplayChange) {
          listener.onBoardDisplayChange(this._getDisplayState())
        }
      } catch (err) {
        console.error('Board display listener error:', err)
      }
    })
  }

  pause() {
    this.agentState.isRunning = false
    this._emitStateChange(AGENT_STATES.PAUSED)
  }

  resume() {
    if (this.agentState.currentStep === AGENT_STATES.PAUSED) {
      this.agentState.isRunning = true

      this._emitStateChange(AGENT_STATES.THINKING)
      return this._loop()
    }
    return Promise.resolve({error: 'Agent is not paused'})
  }

  getStats() {
    const elapsed = this.agentState.startTime
      ? Date.now() - this.agentState.startTime
      : 0
    return {
      executionCount: this.agentState.executionCount,
      maxSteps: this.agentState.maxSteps,
      elapsedTime: elapsed,
      retryCount: this.agentState.retryCount,
      historyLength: this.agentState.history.length
    }
  }

  _analyzeThought(context) {
    return `分析当前情况: ${context}`
  }

  _planThought(analysis) {
    return `制定计划: ${analysis}`
  }

  _decideThought(plan) {
    return `做出决定: ${plan}`
  }
}

export default new AgentOrchestrator()
