import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import ai from './ai.js'
import mcpHelper from './mcpHelper.js'
import sabaki from './sabaki.js'
import {getSelectedServiceProvider} from 'llm-service-provider'
import {getLiveReports} from '../components/golaxy.js'

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
    this.humanCollaborationEnabled = false

    // 五步问题解决流程相关状态
    this.fiveStepProcess = {
      currentProcessStep: null,
      processSteps: [],
      isProcessRunning: false,
      currentStepResult: null,
      processContext: null
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

    // 注册Golaxy直播报告工具
    this._registerGolaxyLiveReportsTool()
  }

  // 注册Golaxy直播报告工具的方法
  _registerGolaxyLiveReportsTool() {
    const tool = {
      id: 'get-golaxy-live-reports',
      name: '获取Golaxy直播报告',
      description: '获取Golaxy平台的实时和历史围棋比赛直播数据',
      type: TOOL_TYPES.SYSTEM_INTEGRATION,
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description:
              '要获取的报告类型，可以是"live"（直播）或"history"（历史）',
            enum: ['live', 'history'],
            default: 'live'
          },
          limit: {
            type: 'number',
            description: '返回的比赛数量限制',
            default: 10
          }
        }
      },
      async handler(params = {}) {
        try {
          const {type = 'live', limit = 10} = params
          const reports = await getLiveReports(
            type === 'live' ? 'live' : 'history',
            limit
          )
          return {
            success: true,
            data: reports,
            content: `成功获取${type === 'live' ? '直播' : '历史'}比赛数据，共${
              reports.length
            }场比赛`
          }
        } catch (error) {
          console.error('获取Golaxy直播报告失败:', error)
          return {
            success: false,
            error: error.message || '获取Golaxy直播报告失败'
          }
        }
      }
    }

    // 注册到MCP助手
    if (mcpHelper.default && mcpHelper.default.registerEndpoint) {
      mcpHelper.default.registerEndpoint(tool)
    }
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
    // 设置isRunning为false，确保状态完全重置
    this.agentState.isRunning = false

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

    // 如果启用了人机协作，使用五步问题解决流程
    if (
      this.humanCollaborationEnabled &&
      options.enableFiveStepProcess !== false
    ) {
      this._emitStateChange(AGENT_STATES.THINKING)
      return await this.runWithFiveStepProcess(
        userMessage,
        gameContext,
        options
      )
    }

    // 否则使用常规流程
    this._emitStateChange(AGENT_STATES.THINKING)
    const result = await this._loop()
    return result
  }

  /**
   * 五步问题解决流程
   * 1. 明确任务 - 理解和澄清用户请求
   * 2. 感知环境 - 收集相关信息和上下文
   * 3. 思考规划 - 制定解决方案和执行计划
   * 4. 执行行动 - 按照计划执行具体操作
   * 5. 观察迭代 - 评估结果并根据需要调整
   */
  async runWithFiveStepProcess(userMessage, gameContext, options = {}) {
    // 初始化五步流程状态
    this.fiveStepProcess = {
      currentProcessStep: null,
      processSteps: [
        {
          id: 'task_clarification',
          name: '明确任务',
          description: '理解和澄清用户请求'
        },
        {
          id: 'environment_perception',
          name: '感知环境',
          description: '收集相关信息和上下文'
        },
        {
          id: 'planning',
          name: '思考规划',
          description: '制定解决方案和执行计划'
        },
        {
          id: 'execution',
          name: '执行行动',
          description: '按照计划执行具体操作'
        },
        {
          id: 'observation',
          name: '观察迭代',
          description: '评估结果并根据需要调整'
        }
      ],
      isProcessRunning: true,
      currentStepResult: null,
      processContext: {
        userMessage: userMessage,
        gameContext: gameContext,
        options: options,
        stepResults: {},
        processStartTime: Date.now()
      }
    }

    try {
      // 第一步：生成五步问题解决流程的详细步骤
      const processPlan = await this._generateFiveStepPlan(
        userMessage,
        gameContext
      )
      if (processPlan.error) {
        return {error: processPlan.error}
      }

      // 将生成的步骤计划保存到流程上下文
      this.fiveStepProcess.processContext.stepPlan = processPlan.steps || []

      // 返回五步流程计划，等待用户确认
      const formattedPlan = this._formatProcessPlan(processPlan.steps)
      return {
        content: formattedPlan.text || formattedPlan,
        button: formattedPlan.button,
        processPlan: processPlan.steps,
        requiresHumanConfirmation: true
      }
    } catch (error) {
      return this._handleError(error, ERROR_TYPES.LLM_ERROR)
    }
  }

  /**
   * 执行五步流程中的特定步骤
   */
  async executeProcessStep(stepIndex, processContext) {
    if (
      !processContext ||
      !processContext.stepPlan ||
      stepIndex < 0 ||
      stepIndex >= processContext.stepPlan.length
    ) {
      return {error: '无效的流程步骤索引'}
    }

    const step = processContext.stepPlan[stepIndex]
    this.fiveStepProcess.currentProcessStep = step.id
    this._emitStateChange(AGENT_STATES.THINKING)

    try {
      // 根据步骤类型执行不同的逻辑
      let stepResult
      switch (step.id) {
        case 'task_clarification':
          stepResult = await this._executeTaskClarification(
            step,
            processContext
          )
          break
        case 'environment_perception':
          stepResult = await this._executeEnvironmentPerception(
            step,
            processContext
          )
          break
        case 'planning':
          stepResult = await this._executePlanning(step, processContext)
          break
        case 'execution':
          stepResult = await this._executeActions(step, processContext)
          break
        case 'observation':
          stepResult = await this._executeObservation(step, processContext)
          break
        default:
          stepResult = {error: `未知的流程步骤: ${step.id}`}
      }

      if (stepResult.error) {
        return stepResult
      }

      // 保存步骤结果
      processContext.stepResults[step.id] = stepResult
      this.fiveStepProcess.currentStepResult = stepResult

      return {
        content: stepResult.summary || '步骤执行完成',
        details: stepResult,
        isLastStep: stepIndex === processContext.stepPlan.length - 1,
        currentStepIndex: stepIndex
      }
    } catch (error) {
      return this._handleError(error, ERROR_TYPES.LLM_ERROR)
    }
  }

  /**
   * 生成五步问题解决流程的详细计划
   */
  async _generateFiveStepPlan(userMessage, gameContext) {
    const prompt = `
你需要将用户的问题分解为五步问题解决流程：
1. 明确任务 - 理解和澄清用户请求
2. 感知环境 - 收集相关信息和上下文
3. 思考规划 - 制定解决方案和执行计划
4. 执行行动 - 按照计划执行具体操作
5. 观察迭代 - 评估结果并根据需要调整

用户问题: ${userMessage}

请为这个问题生成详细的五步解决计划，每个步骤需要包含：
- id: 步骤标识符（task_clarification, environment_perception, planning, execution, observation）
- name: 步骤名称
- description: 步骤的详细描述
- objectives: 该步骤需要完成的具体目标（数组）
- expectedOutput: 预期输出结果

请用JSON格式输出，确保格式正确，不要包含任何其他文本。
格式要求：
{"steps": [步骤1对象, 步骤2对象, 步骤3对象, 步骤4对象, 步骤5对象]}
`

    const response = await ai.sendLLMMessage(prompt, gameContext)
    if (response.error) {
      return {error: response.error}
    }

    try {
      const parsedResponse =
        typeof response === 'object' ? response : JSON.parse(response)
      return parsedResponse
    } catch (error) {
      return {error: `解析流程计划失败: ${error.message}`}
    }
  }

  /**
   * 格式化流程计划为可读文本
   */
  _formatProcessPlan(steps) {
    if (!steps || !Array.isArray(steps)) {
      return {text: '无法生成五步流程计划'}
    }

    let formatted = '我将按以下五步来解决您的问题：\n\n'

    steps.forEach((step, index) => {
      formatted += `${index + 1}. ${step.name} - ${step.description}\n`
      formatted += `   目标：\n`
      step.objectives?.forEach(obj => {
        formatted += `   - ${obj}\n`
      })
      formatted += `   预期输出：${step.expectedOutput}\n\n`
    })

    formatted += '请确认是否按照这个计划开始执行'
    return {
      text: formatted,
      button: {
        text: '开始执行',
        action: 'continueFiveStepProcess',
        nextStepIndex: 0
      }
    }
  }

  /**
   * 执行任务澄清步骤
   */
  async _executeTaskClarification(step, processContext) {
    const prompt = `
任务：${processContext.userMessage}

请按照以下步骤明确任务：
1. 分析用户的核心需求
2. 识别问题的边界和范围
3. 澄清任何可能的歧义或假设
4. 定义成功标准

输出要求：
- summary: 对任务的清晰理解（1-2句话）
- details: 详细的任务分析
- ambiguities: 需要澄清的地方（如果有）
- successCriteria: 成功完成任务的标准
`

    const response = await ai.sendLLMMessage(prompt, processContext.gameContext)
    if (response.error) {
      return {error: response.error}
    }

    return this._parseStepResponse(response)
  }

  /**
   * 执行环境感知步骤
   */
  async _executeEnvironmentPerception(step, processContext) {
    // 获取棋盘上下文
    const boardContext = await this.getBoardContext(processContext.gameContext)

    const prompt = `
任务：${processContext.userMessage}

棋盘上下文：${boardContext || '无可用棋盘信息'}

请按照以下步骤感知环境：
1. 分析当前棋盘状态（如果有）
2. 识别相关的上下文信息
3. 收集解决问题所需的信息
4. 评估信息的完整性

输出要求：
- summary: 环境分析摘要（1-2句话）
- details: 详细的环境分析
- relevantInformation: 相关信息列表
- informationGaps: 信息缺口（如果有）
`

    const response = await ai.sendLLMMessage(prompt, processContext.gameContext)
    if (response.error) {
      return {error: response.error}
    }

    return this._parseStepResponse(response)
  }

  /**
   * 执行思考规划步骤
   */
  async _executePlanning(step, processContext) {
    const prompt = `
任务：${processContext.userMessage}

任务澄清结果：${JSON.stringify(
      processContext.stepResults.task_clarification || {}
    )}

环境感知结果：${JSON.stringify(
      processContext.stepResults.environment_perception || {}
    )}

请按照以下步骤制定解决方案：
1. 基于任务和环境分析提出解决思路
2. 设计具体的执行步骤和方法
3. 评估可能的风险和替代方案
4. 制定详细的行动计划

输出要求：
- summary: 解决方案摘要（1-2句话）
- details: 详细的解决方案
- executionSteps: 具体执行步骤列表
- potentialRisks: 潜在风险及应对措施
`

    const response = await ai.sendLLMMessage(prompt, processContext.gameContext)
    if (response.error) {
      return {error: response.error}
    }

    return this._parseStepResponse(response)
  }

  /**
   * 执行执行行动步骤
   */
  async _executeActions(step, processContext) {
    const planningResult = processContext.stepResults.planning
    if (!planningResult || !planningResult.executionSteps) {
      return {error: '缺少执行步骤计划'}
    }

    // 执行步骤中可能涉及的工具调用
    const executedActions = []
    const toolResults = []
    let allResults = ''

    // 遍历执行步骤，检查是否需要调用工具
    for (const actionStep of planningResult.executionSteps) {
      executedActions.push(actionStep)

      // 检查步骤是否包含工具调用信息
      if (actionStep.toolCall) {
        try {
          // 执行工具调用
          const toolResult = await this._executeTool(actionStep.toolCall)

          // 保存工具调用结果
          toolResults.push({
            toolName: actionStep.toolCall.name,
            parameters: actionStep.toolCall.parameters,
            result: toolResult
          })

          // 添加到结果汇总
          if (toolResult.data || toolResult.content) {
            const resultContent = JSON.stringify(
              toolResult.data || toolResult.content,
              null,
              2
            )
            allResults += `工具 ${actionStep.toolCall.name} 的结果:\n${resultContent}\n\n`
          }
        } catch (error) {
          // 记录错误但继续执行其他步骤
          toolResults.push({
            toolName: actionStep.toolCall.name,
            parameters: actionStep.toolCall.parameters,
            error: error.message
          })
          allResults += `工具 ${actionStep.toolCall.name} 执行失败: ${error.message}\n\n`
        }
      } else if (actionStep.description) {
        // 对于没有工具调用的步骤，直接使用描述
        allResults += `${actionStep.description}\n\n`
      }
    }

    // 也检查是否有其他步骤中产生的工具结果
    const previousSteps = ['task_clarification', 'environment_perception']
    const allToolResultsFromHistory = []

    previousSteps.forEach(stepId => {
      if (
        processContext.stepResults[stepId] &&
        processContext.stepResults[stepId].toolResults
      ) {
        allToolResultsFromHistory.push(
          ...processContext.stepResults[stepId].toolResults
        )
      }
    })

    // 构建最终返回结果，确保包含所有工具调用结果
    return {
      summary: '已按照计划执行操作并获得结果',
      details: '执行了计划中的步骤并获取了工具调用结果',
      executedActions: executedActions,
      toolResults: [...toolResults, ...allToolResultsFromHistory],
      results: allResults || '操作执行成功，获得了预期结果',
      // 添加所有可能的工具调用结果，确保前端能够显示
      allToolResults: [...toolResults, ...allToolResultsFromHistory]
    }
  }

  /**
   * 执行观察迭代步骤
   */
  async _executeObservation(step, processContext) {
    const prompt = `
任务：${processContext.userMessage}

执行结果：${JSON.stringify(processContext.stepResults.execution || {})}

请按照以下步骤评估结果：
1. 分析执行结果与预期目标的符合度
2. 识别成功和不足之处
3. 提供改进建议
4. 总结整个问题解决过程

输出要求：
- summary: 结果评估摘要（1-2句话）
- details: 详细的结果评估
- achievements: 完成的成就
- improvements: 改进建议
- finalConclusion: 最终结论
`

    const response = await ai.sendLLMMessage(prompt, processContext.gameContext)
    if (response.error) {
      return {error: response.error}
    }

    return this._parseStepResponse(response)
  }

  /**
   * 解析步骤响应
   */
  _parseStepResponse(response) {
    try {
      if (typeof response === 'object') {
        return response
      }
      return JSON.parse(response)
    } catch (error) {
      // 如果无法解析JSON，返回原始响应作为摘要
      return {summary: response, details: response}
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
    let thoughtResponse
    try {
      thoughtResponse = await ai.sendLLMMessage(
        thoughtPrompt,
        this.agentState.conversationContext.gameContext
      )
    } catch (error) {
      sabaki.aiManager.openApiKeyManager()
      this.agentState.isRunning = false
      this._emitStateChange(AGENT_STATES.IDLE)
      // 不再抛出错误，而是返回错误信息对象
      return {error: error.message || String(error)}
    }
    if (!thoughtResponse || thoughtResponse.error) {
      this.agentState.isRunning = false
      this._emitStateChange(AGENT_STATES.IDLE)
      // 不再抛出错误，而是返回错误信息对象
      return {error: thoughtResponse?.error || 'Failed to get LLM response'}
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

    try {
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
    } catch (error) {
      // 捕获所有未处理的异常，转换为工具操作错误格式
      console.error(`工具执行异常 - ${validatedToolInfo.name}:`, error)
      toolResult = {
        isError: true,
        error: `工具执行失败: ${error.message}`,
        message: `执行工具"${validatedToolInfo.name}"时发生内部错误`
      }
    }

    return this._processToolResult(toolResult, validatedToolInfo.name)
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

    // 如果启用了人机协作，将配置传递给工具参数
    if (this.humanCollaborationEnabled) {
      if (!toolInfo.parameters) {
        toolInfo.parameters = {}
      }
      toolInfo.parameters.humanCollaborationRequired = true
    }

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

  // 设置人机协作开关
  setHumanCollaborationEnabled(enabled) {
    this.humanCollaborationEnabled = enabled
    // 确保AIHelper也使用相同的设置
    if (typeof ai.setHumanCollaborationEnabled === 'function') {
      ai.setHumanCollaborationEnabled(enabled)
    }
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

  _processToolResult(toolResult, toolName) {
    // 处理JSON-RPC格式的错误
    if (toolResult.jsonrpc === '2.0' && toolResult.error) {
      return {
        shouldContinue: false,
        error: toolResult.error.data || toolResult.error.message
      }
    }

    // 处理传统的error字段
    if (toolResult.error) {
      return {
        shouldContinue: false,
        error: toolResult.error
      }
    }

    // 处理工具操作中产生的错误（isError字段）
    if (toolResult.isError === true) {
      return {
        shouldContinue: false,
        error: toolResult.error || toolResult.message || '工具操作失败'
      }
    }

    // 如果指定了工具名称，尝试验证结果是否符合outputSchema
    if (toolName) {
      const availableTools = this.getAvailableTools()
      const tool = availableTools.find(t => t.name === toolName)

      if (tool && tool.outputSchema) {
        // 基本验证：检查是否包含必要的字段
        if (
          tool.outputSchema.required &&
          Array.isArray(tool.outputSchema.required)
        ) {
          const missingFields = tool.outputSchema.required.filter(
            field => !toolResult.hasOwnProperty(field)
          )
          if (missingFields.length > 0) {
            console.warn(
              `工具${toolName}的结果缺少必要字段: ${missingFields.join(', ')}`
            )
            // 这里只警告，不阻止返回结果，保持向后兼容性
          }
        }
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

  // MCP协议要求始终使用JSON格式的工具列表，包含outputSchema
  formatToolsList(detailed = false, includePrefix = false, grouped = true) {
    const availableTools = this.getAvailableTools()

    // 按类型分组返回JSON格式
    if (grouped) {
      const toolsByType = {}
      availableTools.forEach(tool => {
        if (!toolsByType[tool.type]) {
          toolsByType[tool.type] = []
        }
        toolsByType[tool.type].push({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters || {},
          outputSchema: tool.outputSchema || {}
        })
      })
      return toolsByType
    }

    // 不分组返回JSON格式
    return availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || {},
      outputSchema: tool.outputSchema || {}
    }))
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
    // MCP协议要求使用JSON格式的工具列表
    const toolsListJson = this.formatToolsList(true, false, true)
    const {lastToolResult} = this.agentState.conversationContext || {}

    // 构建符合MCP协议的提示
    let prompt = `你是一个围棋助手，需要分析最新的用户请求和工具执行结果，然后决定下一步操作。\n\n`

    // MCP工具列表（JSON格式）
    prompt += `MCP工具列表:\n${JSON.stringify(toolsListJson, null, 2)}\n\n`

    prompt += `用户历史消息:\n`
    // 只添加除了最后一条以外的用户消息，避免重复包含当前问题
    const userMessages = this.agentState.history.filter(
      item => item.type === 'user'
    )
    for (let i = 0; i < userMessages.length - 1; i++) {
      prompt += `- ${userMessages[i].content}\n`
    }
    // 单独添加当前问题，并标记为最新
    if (userMessages.length > 0) {
      prompt += `- [最新] ${userMessages[userMessages.length - 1].content}\n`
    }

    if (lastToolResult) {
      prompt += `\n最近的工具执行结果:\n${JSON.stringify(
        lastToolResult,
        null,
        2
      )}\n\n`
    }

    prompt += `请你根据以上信息，决定是调用工具、直接回答用户还是追问用户。\n\n`

    prompt += `输出格式要求:\n`
    prompt += `1. 如果决定调用工具，包含以下字段:\n`
    prompt += `   {"action":"tool_call","tool":{"name":"工具名称","parameters":{参数对象}}}\n`
    prompt += `   请注意: 每个工具都提供了outputSchema，描述了工具返回结果的预期结构。请根据outputSchema解释工具结果。\n`
    prompt += `   此外，请注意工具可能返回两种类型的错误:\n`
    prompt += `   1. 标准JSON-RPC错误: 包含jsonrpc、error.code、error.message和error.data字段，用于协议层面的错误\n`
    prompt += `   2. 工具操作错误: 包含isError:true字段，以及error或message字段，用于工具执行过程中的错误\n`
    prompt += `   请识别并准确解释这些错误信息，帮助用户理解失败原因。\n`
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
      error: this.agentState.error,
      // 五步流程相关统计
      isFiveStepProcess: !!this.fiveStepProcess.isProcessRunning,
      fiveStepCurrentStep: this.fiveStepProcess.currentProcessStep,
      fiveStepTotalSteps: this.fiveStepProcess.processSteps.length
    }
  }

  /**
   * 获取五步流程的当前状态
   */
  getFiveStepProcessState() {
    return {
      isRunning: this.fiveStepProcess.isProcessRunning,
      currentStep: this.fiveStepProcess.currentProcessStep,
      steps: this.fiveStepProcess.processSteps,
      processContext: this.fiveStepProcess.processContext
    }
  }

  /**
   * 重置五步流程
   */
  resetFiveStepProcess() {
    this.fiveStepProcess = {
      currentProcessStep: null,
      processSteps: [],
      isProcessRunning: false,
      currentStepResult: null,
      processContext: null
    }
  }
}

export default new AgentOrchestrator()
