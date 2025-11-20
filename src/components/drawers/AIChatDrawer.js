import {createElement as h, Component} from 'preact/compat'
import sabaki from '../../modules/sabaki.js'
import i18n from '../../i18n.js'
import TextSpinner from '../TextSpinner.js'
import mcpHelper from '../../modules/mcpHelper.js'
import Drawer from './Drawer.js'
import {
  AgentOrchestrator,
  AGENT_STATES
} from '../../modules/agentOrchestrator.js'

const t = i18n.context('AIChatDrawer')

export default class AIChatDrawer extends Drawer {
  constructor(props) {
    super(props)
    this.scrollToBottom = true

    const savedHistory = JSON.parse(
      localStorage.getItem('sabaki-llm-history') || '[]'
    )
    const savedHumanCollaboration =
      localStorage.getItem('sabaki-ai-human-collaboration') === 'true'
    this.state = {
      messages: [],
      input: '',
      sending: false,
      showMCPTools: false,
      showQuestionPrompts: false,
      activeTool: null,
      toolParams: {},
      history: savedHistory,
      currentHistoryIndex: -1,
      tempInput: '',
      questionCategories: [],
      kataGoSearchTerm: '',
      gtpSearchTerm: '',
      agentStatus: AGENT_STATES.IDLE,
      executionStats: null,
      humanCollaborationEnabled: savedHumanCollaboration,
      // 五步问题解决流程相关状态
      fiveStepProcessState: {
        isActive: false,
        currentStepIndex: -1,
        processPlan: null,
        processContext: null,
        waitingForConfirmation: false
      }
    }

    // 加载问题分类
    this.loadQuestionCategories()
    this.messagesContainer = null

    // 创建编排层实例
    this.agentOrchestrator = new AgentOrchestrator()

    // 设置人机协作配置
    this.agentOrchestrator.setHumanCollaborationEnabled(
      this.state.humanCollaborationEnabled
    )

    // 添加状态监听器
    this.agentOrchestrator.addStateListener(
      this.handleAgentStateChange.bind(this)
    )

    // 添加错误处理器
    this.agentOrchestrator.addErrorHandler(this.handleAgentError.bind(this))

    sabaki.on('ai.message.add', this.handleAIMessageAdd)
  }

  componentWillUnmount() {
    sabaki.off('ai.message.add', this.handleAIMessageAdd)

    localStorage.setItem(
      'sabaki-llm-history',
      JSON.stringify(this.state.history)
    )
    localStorage.setItem(
      'sabaki-ai-human-collaboration',
      this.state.humanCollaborationEnabled.toString()
    )

    // 清理监听器
    this.agentOrchestrator.removeStateListener(this.handleAgentStateChange)
    this.agentOrchestrator.removeErrorHandler(this.handleAgentError)

    // 终止正在运行的智能体
    this.agentOrchestrator.pause()
  }

  handleAgentStateChange(newState, oldState) {
    this.setState({agentStatus: newState})

    // 更新执行统计信息
    if (newState !== AGENT_STATES.IDLE) {
      this.setState({executionStats: this.agentOrchestrator.getStats()})
    }

    // 根据状态更新UI反馈
    switch (newState) {
      case AGENT_STATES.THINKING:
        console.log('Agent is thinking...')
        break
      case AGENT_STATES.ACTING:
        console.log('Agent is acting...')
        break
      case AGENT_STATES.OBSERVING:
        console.log('Agent is observing results...')
        break
      case AGENT_STATES.ERROR:
        console.log('Agent encountered an error')
        break
    }
  }

  handleAgentError(error) {
    console.error('Agent error:', error)
    this.setState({error: error.message})
    // 可以在这里添加错误提示UI
  }

  // 取消当前智能体执行
  cancelExecution() {
    this.agentOrchestrator.pause()
    this.setState({sending: false})
  }

  componentWillUnmount() {
    sabaki.off('ai.message.add', this.handleAIMessageAdd)

    localStorage.setItem(
      'sabaki-llm-history',
      JSON.stringify(this.state.history)
    )
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.history !== this.state.history) {
      localStorage.setItem(
        'sabaki-llm-history',
        JSON.stringify(this.state.history)
      )
    }

    if (this.messagesContainer && this.scrollToBottom) {
      setTimeout(() => {
        if (this.messagesContainer) {
          this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
        }
      }, 0)
    }
  }

  loadQuestionCategories = async () => {
    try {
      // 导入问题分类JSON文件
      const response = await import('../../../llm_prompts/go_questions.json')
      this.setState({questionCategories: response.default.categories})
    } catch (error) {
      console.error('Failed to load question categories:', error)
    }
  }

  toggleQuestionPrompts = () => {
    this.setState(prevState => ({
      showQuestionPrompts: !prevState.showQuestionPrompts,
      showMCPTools: prevState.showQuestionPrompts
        ? prevState.showMCPTools
        : false
    }))
  }

  selectQuestion = question => {
    this.setState({input: question})
    // 隐藏问题提示面板
    this.setState({showQuestionPrompts: false})
  }

  renderQuestionPrompts() {
    return h(
      'div',
      {class: 'ai-chat-question-prompts'},
      h('h4', null, i18n.t('ai', 'Go Question Examples')),
      this.state.questionCategories.map((category, idx) =>
        h(
          'div',
          {key: idx, class: 'question-category'},
          h('h5', null, category.name),
          h(
            'div',
            {class: 'question-list'},
            category.questions.map((question, qIdx) =>
              h(
                'button',
                {
                  key: qIdx,
                  class: 'question-item',
                  onClick: () => this.selectQuestion(question)
                },
                question
              )
            )
          )
        )
      )
    )
  }

  handleAIMessageAdd = message => {
    this.setState(prevState => ({
      messages: [...prevState.messages, message]
    }))
  }

  handleInputChange = evt => {
    this.setState({input: evt.target.value})
  }

  handleSendMessage = async () => {
    let message = this.state.input.trim()
    if (!message || this.state.sending) return

    // 检查是否正在五步流程中
    if (this.state.fiveStepProcessState.isActive) {
      await this.handleFiveStepProcessMessage(message)
      return
    }

    let history = [...this.state.history]
    if (!history.includes(message)) {
      history.unshift(message)
      if (history.length > 50) {
        history = history.slice(0, 50)
      }
    }

    const newMessages = [
      ...this.state.messages,
      {role: 'user', content: message},
      {role: 'waiting', id: Date.now()}
    ]
    this.setState({
      sending: true,
      messages: newMessages,
      input: '',
      history,
      currentHistoryIndex: -1
    })

    const gameContext = {
      gameTrees: sabaki.state.gameTrees,
      gameIndex: sabaki.state.gameIndex,
      treePosition: sabaki.state.treePosition
    }

    // 使用智能体编排层处理请求
    const response = await this.agentOrchestrator.run(message, gameContext, {
      maxSteps: 20,
      timeout: 180000, // 3分钟超时
      maxRetries: 2
    })

    const updatedMessages = newMessages.filter(msg => msg.role !== 'waiting')
    if (response.error) {
      this.setState({
        messages: [
          ...updatedMessages,
          {role: 'error', content: response.error}
        ],
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      })
    } else {
      // 检查是否是五步流程计划
      if (response.requiresHumanConfirmation && response.processPlan) {
        // 保存流程计划和上下文
        this.setState({
          messages: [
            ...updatedMessages,
            {
              role: 'ai',
              content: response.content,
              button: response.button,
              processPlan: response.processPlan
            }
          ],
          fiveStepProcessState: {
            isActive: true,
            currentStepIndex: -1,
            processPlan: response.processPlan,
            processContext: {
              userMessage: message,
              gameContext: gameContext,
              stepResults: {},
              stepPlan: response.processPlan
            },
            waitingForConfirmation: true
          },
          sending: false,
          agentStatus: AGENT_STATES.IDLE
        })
      } else {
        const content =
          response.content || response.result?.content || 'No response'

        // 处理棋盘显示指令
        this.processBoardDisplayInstructions(content)

        this.setState({
          messages: [
            ...updatedMessages,
            {
              role: 'ai',
              content: content
            }
          ],
          sending: false,
          agentStatus: AGENT_STATES.IDLE
        })
      }
    }
  }

  /**
   * 处理五步流程中的用户输入
   */
  handleFiveStepProcessMessage = async message => {
    const {fiveStepProcessState} = this.state

    let history = [...this.state.history]
    if (!history.includes(message)) {
      history.unshift(message)
      if (history.length > 50) {
        history = history.slice(0, 50)
      }
    }

    const newMessages = [
      ...this.state.messages,
      {role: 'user', content: message},
      {role: 'waiting', id: Date.now()}
    ]

    this.setState({
      sending: true,
      messages: newMessages,
      input: '',
      history,
      currentHistoryIndex: -1
    })

    try {
      // 移除文本命令处理，保留取消流程的逻辑
      // 当用户在五步流程中输入任何文本时，默认取消流程
      const updatedMessages = newMessages.filter(msg => msg.role !== 'waiting')
      this.setState({
        fiveStepProcessState: {
          isActive: false,
          currentStepIndex: -1,
          processPlan: null,
          processContext: null,
          waitingForConfirmation: false
        },
        messages: [
          ...updatedMessages,
          {role: 'ai', content: '流程已取消。请使用消息中的按钮来控制流程。'}
        ],
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      })
    } catch (error) {
      const updatedMessages = newMessages.filter(msg => msg.role !== 'waiting')
      this.setState({
        messages: [
          ...updatedMessages,
          {role: 'error', content: error.message || '执行步骤时发生错误'}
        ],
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      })
    }
  }

  /**
   * 处理按钮点击事件
   */
  handleButtonClick = async message => {
    if (message.button && message.button.action === 'continueFiveStepProcess') {
      // 执行下一步
      const nextStepIndex = message.button.nextStepIndex
      await this.executeProcessStep(nextStepIndex)
    }
  }

  /**
   * 执行五步流程中的特定步骤
   */
  executeProcessStep = async stepIndex => {
    const {fiveStepProcessState} = this.state
    const updatedMessages = this.state.messages.filter(
      msg => msg.role !== 'waiting'
    )

    if (
      !fiveStepProcessState.processContext ||
      !fiveStepProcessState.processPlan ||
      stepIndex < 0 ||
      stepIndex >= fiveStepProcessState.processPlan.length
    ) {
      this.setState({
        messages: [
          ...updatedMessages,
          {role: 'error', content: '无效的流程步骤。'}
        ],
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      })
      return
    }

    try {
      // 调用agentOrchestrator执行步骤
      const stepResult = await this.agentOrchestrator.executeProcessStep(
        stepIndex,
        fiveStepProcessState.processContext
      )

      if (stepResult.error) {
        this.setState({
          messages: [
            ...updatedMessages,
            {role: 'error', content: `执行步骤时出错: ${stepResult.error}`}
          ],
          sending: false,
          agentStatus: AGENT_STATES.IDLE
        })
        return
      }

      // 格式化步骤结果消息
      let resultContent = `### ${fiveStepProcessState.processPlan[stepIndex].name}\n\n`
      resultContent += stepResult.content + '\n\n'

      // 添加详细信息显示
      if (stepResult.details) {
        resultContent += '**详细信息:**\n\n'
        // 避免直接使用JSON.stringify，使用更友好的格式化方式
        if (
          stepResult.details.summary &&
          stepResult.details.summary !== stepResult.content
        ) {
          resultContent += `- 摘要: ${stepResult.details.summary}\n`
        }
        if (stepResult.details.analysis) {
          resultContent += `\n**分析:**\n${stepResult.details.analysis}\n`
        }
        if (stepResult.details.plan) {
          resultContent += `\n**计划:**\n${stepResult.details.plan}\n`
        }
        if (stepResult.details.actions) {
          resultContent += `\n**执行操作:**\n${stepResult.details.actions}\n`
        }
        if (stepResult.details.observation) {
          resultContent += `\n**观察结果:**\n${stepResult.details.observation}\n`
        }
        // 特别处理工具调用结果，确保工具结果正确显示
        if (
          stepResult.details.toolResults &&
          stepResult.details.toolResults.length > 0
        ) {
          resultContent += '\n**工具调用结果:**\n'
          stepResult.details.toolResults.forEach((toolResult, index) => {
            resultContent += `\n*工具 ${index + 1}: ${toolResult.toolName}*\n`
            if (toolResult.error) {
              resultContent += `  - 错误: ${toolResult.error}\n`
            } else if (toolResult.result) {
              // 格式化显示工具结果，避免过于冗长
              if (typeof toolResult.result === 'object') {
                // 尝试提取主要内容
                if (toolResult.result.data) {
                  const dataStr =
                    typeof toolResult.result.data === 'object'
                      ? JSON.stringify(toolResult.result.data, null, 2)
                      : toolResult.result.data.toString()
                  resultContent += `  - 数据: ${dataStr}\n`
                } else if (toolResult.result.content) {
                  resultContent += `  - 内容: ${toolResult.result.content}\n`
                } else {
                  // 如果无法提取，使用简化的JSON
                  resultContent += `  - 结果: ${JSON.stringify(
                    toolResult.result
                  ).substring(0, 200)}${
                    JSON.stringify(toolResult.result).length > 200 ? '...' : ''
                  }\n`
                }
              } else {
                resultContent += `  - 结果: ${toolResult.result}\n`
              }
            }
          })
        }
        // 对于其他可能的字段，以键值对形式展示
        const otherFields = Object.keys(stepResult.details).filter(
          key =>
            ![
              'summary',
              'analysis',
              'plan',
              'actions',
              'observation',
              'toolResults',
              'allToolResults'
            ].includes(key)
        )
        if (otherFields.length > 0) {
          resultContent += '\n**其他信息:**\n'
          otherFields.forEach(key => {
            if (stepResult.details[key]) {
              const value =
                typeof stepResult.details[key] === 'object'
                  ? JSON.stringify(stepResult.details[key])
                  : stepResult.details[key]
              resultContent += `- ${key}: ${value}\n`
            }
          })
        }
      }

      // 如果不是最后一步，提示用户继续
      if (!stepResult.isLastStep) {
        // 移除文本提示，改为按钮交互
      } else {
        resultContent += `\n✅ 所有步骤已完成！五步问题解决流程已成功结束。`
      }

      // 更新状态
      this.setState({
        messages: [
          ...updatedMessages,
          {
            role: 'ai',
            content: resultContent,
            stepIndex: stepIndex,
            stepDetails: stepResult.details,
            // 添加按钮配置
            button: !stepResult.isLastStep
              ? {
                  text: `继续：${
                    fiveStepProcessState.processPlan[stepIndex + 1].name
                  }`,
                  action: 'continueFiveStepProcess',
                  nextStepIndex: stepIndex + 1
                }
              : null
          }
        ],
        fiveStepProcessState: {
          ...fiveStepProcessState,
          currentStepIndex: stepIndex,
          waitingForConfirmation: false,
          isActive: !stepResult.isLastStep // 如果是最后一步，结束流程
        },
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      })

      // 如果是最后一步，重置流程状态
      if (stepResult.isLastStep) {
        setTimeout(() => {
          this.agentOrchestrator.resetFiveStepProcess()
        }, 1000)
      }
    } catch (error) {
      this.setState({
        messages: [
          ...updatedMessages,
          {role: 'error', content: error.message || '执行步骤时发生错误'}
        ],
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      })
    }
  }

  handleKeyDown = evt => {
    // 只有在不在输入法组合状态下按回车才发送消息
    if (evt.key === 'Enter' && !evt.shiftKey && !evt.isComposing) {
      evt.preventDefault()
      this.handleSendMessage()
    } else if (evt.key === 'ArrowUp') {
      evt.preventDefault()
      this.navigateHistory(1)
    } else if (evt.key === 'ArrowDown') {
      evt.preventDefault()
      this.navigateHistory(-1)
    }
  }

  // 处理棋盘显示指令
  processBoardDisplayInstructions = content => {
    try {
      // 尝试从JSON格式解析棋盘指令
      if (content.startsWith('{') && content.includes('boardDisplay')) {
        const parsed = JSON.parse(content)
        if (parsed.boardDisplay) {
          this.applyBoardDisplayCommands(parsed.boardDisplay)
        }
      }
      // 尝试从文本中提取JSON格式的棋盘指令块
      else if (
        content.includes('```json') &&
        content.includes('boardDisplay')
      ) {
        const jsonMatch = content.match(/```json([\s\S]*?)```/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1])
            if (parsed.boardDisplay) {
              this.applyBoardDisplayCommands(parsed.boardDisplay)
            }
          } catch (e) {
            console.warn(
              'Failed to parse board display instructions from JSON block:',
              e
            )
          }
        }
      }
      // 尝试从文本中提取特殊标记的棋盘指令
      else if (content.includes('BOARD_DISPLAY:')) {
        const instructionMatch = content.match(/BOARD_DISPLAY:\s*({[^}]*})/)
        if (instructionMatch) {
          try {
            const parsed = JSON.parse(instructionMatch[1])
            this.applyBoardDisplayCommands(parsed)
          } catch (e) {
            console.warn('Failed to parse board display instructions:', e)
          }
        }
      }
    } catch (error) {
      console.warn('Error processing board display instructions:', error)
    }
  }

  // 应用棋盘显示命令
  applyBoardDisplayCommands = commands => {
    // 获取棋盘显示控制器
    const boardDisplayController = sabaki.getBoardDisplayController()
    if (!boardDisplayController) {
      console.warn('BoardDisplayController not available')
      return
    }

    // 清除现有显示（如果指定）
    if (commands.clear) {
      boardDisplayController.clearBoardDisplay()
    }

    // 设置标记
    if (commands.markers) {
      boardDisplayController.setBoardMarkers(commands.markers)
    }

    // 设置高亮
    if (commands.highlights) {
      boardDisplayController.setBoardHighlights(commands.highlights)
    }

    // 设置热力图
    if (commands.heatmap) {
      boardDisplayController.setBoardHeatmap(
        commands.heatmap.points,
        commands.heatmap.maxValue
      )
    }

    // 绘制线条
    if (commands.lines) {
      boardDisplayController.drawBoardLines(commands.lines)
    }

    // 显示变化走法
    if (commands.variations) {
      boardDisplayController.showBoardVariations(commands.variations)
    }

    // 更新棋盘显示
    boardDisplayController.updateDisplay()
  }

  navigateHistory(direction) {
    const {history, currentHistoryIndex, input} = this.state

    if (currentHistoryIndex === -1 && direction === 1) {
      this.setState({tempInput: input})
    }

    let newIndex = currentHistoryIndex + direction

    if (newIndex >= history.length) {
      newIndex = history.length - 1
    } else if (newIndex < -1) {
      newIndex = -1
    }

    let newInput = ''
    if (newIndex === -1) {
      newInput = this.state.tempInput
    } else {
      newInput = history[newIndex]
    }

    this.setState({input: newInput, currentHistoryIndex: newIndex})
  }

  handleClearMessages = () => {
    this.setState({messages: []})
  }

  toggleMCPTools = () => {
    this.setState(prevState => ({
      showMCPTools: !prevState.showMCPTools,
      activeTool: prevState.showMCPTools ? null : prevState.activeTool
    }))
  }

  handleToolSelect = tool => {
    let defaultParams = {}
    if (tool.parameters && tool.parameters.properties) {
      Object.keys(tool.parameters.properties).forEach(key => {
        if (tool.parameters.properties[key].default !== undefined) {
          defaultParams[key] = tool.parameters.properties[key].default
        }
      })
    }

    this.setState({
      activeTool: tool,
      toolParams: defaultParams
      // kataGoSearchTerm: '',
      // gtpSearchTerm: ''
    })
  }

  handleToolParamChange = (paramName, value) => {
    this.setState(prevState => ({
      toolParams: {
        ...prevState.toolParams,
        [paramName]: value
      }
    }))
  }

  handleToolExecute = async () => {
    if (!this.state.activeTool || this.state.sending) return

    // Check if this is the kata-raw-human-nn tool which requires a human model
    if (this.state.activeTool.id === 'kata-raw-human-nn') {
      this.setState(prevState => ({
        messages: [
          ...prevState.messages,
          {
            role: 'system',
            content: i18n.t(
              'ai',
              `Warning: kata-raw-human-nn tool requires a human model file.\nPlease ensure you have provided the -human-model parameter when launching Sabaki.\nExample: sabaki -- --human-model path/to/human_model.bin`
            )
          }
        ]
      }))
    }

    this.setState(prevState => ({
      sending: true,
      messages: [
        ...prevState.messages,
        {
          role: 'system',
          content: i18n.t('ai', `Executing tool: ${this.state.activeTool.name}`)
        }
      ]
    }))

    try {
      const gameContext = {
        gameTrees: sabaki.state.gameTrees,
        gameIndex: sabaki.state.gameIndex,
        treePosition: sabaki.state.treePosition
      }

      const message = {
        mcp: {
          tool: {
            name: this.state.activeTool.name,
            description: this.state.activeTool.description,
            parameters: this.state.toolParams
          }
        }
      }
      // 使用智能体编排层处理工具调用
      const response = await this.agentOrchestrator.run(message, gameContext, {
        maxSteps: 20,
        timeout: 180000, // 3分钟超时
        maxRetries: 1
      })

      const resultContent =
        response.error ||
        response.content ||
        response.result?.content ||
        'Tool execution completed'

      // 处理棋盘显示指令
      this.processBoardDisplayInstructions(resultContent)

      this.setState(prevState => ({
        messages: [
          ...prevState.messages,
          {
            role: 'tool-result',
            content: resultContent,
            toolName: this.state.activeTool.name
          }
        ],
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      }))
    } catch (error) {
      this.setState(prevState => ({
        messages: [
          ...prevState.messages,
          {
            role: 'error',
            content: i18n.t('ai', `Tool execution failed: ${error.message}`)
          }
        ],
        sending: false,
        agentStatus: AGENT_STATES.IDLE
      }))
    }
  }

  renderMessage(message) {
    if (message.role === 'waiting') {
      return h(
        'li',
        {class: 'command sending'},
        h(
          'pre',
          {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
          h('span', {class: 'engine'}, 'AI ', h(TextSpinner, {}))
        )
      )
    }

    if (message.role === 'tool-result') {
      return h(
        'li',
        {class: 'command tool-result'},
        h(
          'div',
          {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
          h(
            'span',
            {class: 'engine'},
            `${i18n.t('ai', 'Tool result')} (${message.toolName})>  `
          ),
          h('span', {
            dangerouslySetInnerHTML: {
              __html: message.content.replace(/\n/g, '<br>  ')
            }
          })
        )
      )
    }

    if (message.role === 'system') {
      return h(
        'li',
        {class: 'command system'},
        h(
          'pre',
          {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
          h('span', {class: 'internal'}, message.content)
        )
      )
    }

    let roleClass = 'internal'
    let roleLabel = '>'

    if (message.role === 'user') {
      roleClass = 'success'
      roleLabel = 'You>'
    } else if (message.role === 'ai') {
      roleClass = 'engine'
      roleLabel = 'AI >'
    } else if (message.role === 'error') {
      roleClass = 'error'
      roleLabel = '!>'
    }

    // 对于AI消息，允许HTML内容并添加按钮
    if (message.role === 'ai') {
      const elements = [
        h('span', {class: roleClass}, roleLabel + '  '),
        h('span', {
          dangerouslySetInnerHTML: {
            __html: message.content.replace(/\n/g, '<br>  ')
          }
        })
      ]

      // 如果有按钮配置，添加按钮
      if (message.button) {
        elements.push(
          h(
            'div',
            {style: {marginTop: '10px'}},
            h(
              'button',
              {
                style: {
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                },
                onClick: () => this.handleButtonClick(message)
              },
              message.button.text
            )
          )
        )
      }

      return h(
        'li',
        {class: 'command'},
        h(
          'div',
          {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
          ...elements
        )
      )
    }

    const formattedContent = message.content.replace(/\n/g, '\n  ')

    return h(
      'li',
      {class: 'command'},
      h(
        'pre',
        {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
        h('span', {class: roleClass}, roleLabel + '  ' + formattedContent)
      )
    )
  }

  renderMCPTools() {
    let availableTools = mcpHelper.getAvailableEndpoints()

    let kataGoTools = availableTools.filter(
      tool => tool.id.startsWith('katago-') || !tool.id.startsWith('gtp-')
    )
    let gtpTools = availableTools.filter(tool => tool.id.startsWith('gtp-'))

    // 过滤工具列表
    const filteredKataGoTools = kataGoTools.filter(
      tool =>
        tool.description
          .toLowerCase()
          .includes(this.state.kataGoSearchTerm.toLowerCase()) ||
        tool.id
          .toLowerCase()
          .includes(this.state.kataGoSearchTerm.toLowerCase())
    )

    const filteredGtpTools = gtpTools.filter(
      tool =>
        tool.description
          .toLowerCase()
          .includes(this.state.gtpSearchTerm.toLowerCase()) ||
        tool.id.toLowerCase().includes(this.state.gtpSearchTerm.toLowerCase())
    )

    return h(
      'div',
      {class: 'ai-chat-mcp-tools'},
      h(
        'div',
        {class: 'ai-chat-mcp-tool-selects'},

        h(
          'div',
          {class: 'ai-chat-mcp-tool-select-group'},
          h('label', null, i18n.t('ai', 'KataGo Tools')),
          h('input', {
            type: 'text',
            placeholder: i18n.t('ai', 'Search tools...'),
            value: this.state.kataGoSearchTerm,
            onChange: e => this.setState({kataGoSearchTerm: e.target.value})
          }),
          h(
            'select',
            {
              value: this.state.activeTool?.id || '',
              onChange: e => {
                const toolId = e.target.value
                if (toolId) {
                  const tool = availableTools.find(t => t.id === toolId)
                  if (tool) this.handleToolSelect(tool)
                }
              }
            },
            h('option', {value: ''}, ''),
            filteredKataGoTools.map(tool =>
              h('option', {key: tool.id, value: tool.id}, tool.description)
            )
          )
        ),

        h(
          'div',
          {class: 'ai-chat-mcp-tool-select-group'},
          h('label', null, i18n.t('ai', 'GTP Commands')),
          h('input', {
            type: 'text',
            placeholder: i18n.t('ai', 'Search GTP commands...'),
            value: this.state.gtpSearchTerm,
            onChange: e => {
              const searchTerm = e.target.value
              // 先更新状态，确保输入内容显示
              this.setState({gtpSearchTerm: searchTerm}, () => {
                // 在状态更新后再执行工具选择逻辑
                const availableTools = mcpHelper.getAvailableEndpoints()
                const gtpTools = availableTools.filter(tool =>
                  tool.id.startsWith('gtp-')
                )
                const filteredGtpTools = gtpTools.filter(
                  tool =>
                    tool.description
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()) ||
                    tool.id.toLowerCase().includes(searchTerm.toLowerCase())
                )

                if (filteredGtpTools.length > 0) {
                  this.handleToolSelect(filteredGtpTools[0])
                }
              })
            }
          }),
          h(
            'select',
            {
              value: this.state.activeTool?.id || '',
              onChange: e => {
                const toolId = e.target.value
                if (toolId) {
                  const tool = availableTools.find(t => t.id === toolId)
                  if (tool) this.handleToolSelect(tool)
                }
              }
            },
            h('option', {value: ''}, ''),
            filteredGtpTools.map(tool =>
              h('option', {key: tool.id, value: tool.id}, tool.description)
            )
          )
        )
      ),

      this.state.activeTool &&
        h(
          'div',
          {class: 'ai-chat-mcp-tool-details'},
          h('h4', null, this.state.activeTool.name),
          h('p', null, this.state.activeTool.description),

          this.state.activeTool.parameters &&
            this.state.activeTool.parameters.properties &&
            h(
              'div',
              {class: 'ai-chat-mcp-tool-params'},
              Object.entries(this.state.activeTool.parameters.properties).map(
                ([paramName, paramDef]) =>
                  h(
                    'div',
                    {key: paramName, class: 'ai-chat-mcp-tool-param'},
                    h('label', null, paramDef.description),
                    h('input', {
                      type: paramDef.type === 'number' ? 'number' : 'text',
                      value:
                        this.state.toolParams[paramName] ||
                        paramDef.default ||
                        '',
                      onChange: e => {
                        let value = e.target.value
                        if (paramDef.type === 'number') {
                          value = parseFloat(value)
                        }
                        this.handleToolParamChange(paramName, value)
                      },
                      min: paramDef.type === 'number' ? '1' : undefined
                    })
                  )
              )
            ),

          h(
            'button',
            {
              class: 'button button-primary',
              onClick: this.handleToolExecute,
              disabled: this.state.sending
            },
            t('Execute')
          )
        )
    )
  }

  render() {
    if (!this.props.show) return null

    return h(
      'section',
      {id: 'ai-chat', class: 'ai-chat-drawer gtp-console'},
      h(
        'div',
        {class: 'drawer-header'},
        t('AI Assistant'),
        h(
          'div',
          {class: 'drawer-actions'},
          h(
            'button',
            {
              onClick: this.toggleMCPTools,
              class: `drawer-action ${this.state.showMCPTools ? 'active' : ''}`,
              title: t('MCP Tools')
            },
            '🔧'
          ),
          h(
            'button',
            {
              onClick: this.toggleQuestionPrompts,
              class: `drawer-action ${
                this.state.showQuestionPrompts ? 'active' : ''
              }`,
              title: t('Question Prompts')
            },
            '💡'
          ),
          h(
            'button',
            {
              onClick: () => {
                sabaki.aiManager.openApiKeyManager()
              },
              class: 'drawer-action',
              title: t('Configure LLM API Keys…')
            },
            '🔑'
          ),
          h(
            'button',
            {
              onClick: () => {
                const newValue = !this.state.humanCollaborationEnabled
                this.setState({humanCollaborationEnabled: newValue})
                localStorage.setItem(
                  'sabaki-ai-human-collaboration',
                  newValue.toString()
                )
                // 同步更新agentOrchestrator中的人机协作设置
                this.agentOrchestrator.setHumanCollaborationEnabled(newValue)
              },
              class: `drawer-action ${
                this.state.humanCollaborationEnabled ? 'active' : ''
              }`,
              title: t(
                this.state.humanCollaborationEnabled
                  ? 'Disable Human Collaboration'
                  : 'Enable Human Collaboration'
              ),
              style: {
                backgroundColor: this.state.humanCollaborationEnabled
                  ? '#4a9eff'
                  : 'transparent',
                color: this.state.humanCollaborationEnabled
                  ? 'white'
                  : 'inherit',
                borderRadius: '3px'
              }
            },
            this.state.humanCollaborationEnabled ? '👤✓' : '👤'
          ),
          h(
            'button',
            {
              onClick: () => {
                sabaki.closeDrawer()
              },
              class: 'drawer-action',
              title: t('Close AI Chat')
            },
            '✕'
          ),
          h(
            'button',
            {
              onClick: this.handleClearMessages,
              class: 'drawer-action',
              title: t('Clear messages')
            },
            h(
              'span',
              {
                class: 'icon-trash',
                style: {
                  width: '16px',
                  height: '16px',
                  display: 'inline-block',
                  textAlign: 'center',
                  lineHeight: '16px'
                }
              },
              '🗑️'
            )
          )
        )
      ),

      this.state.showMCPTools && this.renderMCPTools(),
      this.state.showQuestionPrompts && this.renderQuestionPrompts(),

      h(
        'ol',
        {ref: el => (this.messagesContainer = el), class: 'chat-messages'},
        this.state.messages.length === 0
          ? h(
              'li',
              {class: 'chat-placeholder'},
              t('Ask questions about the current game or Go strategy.')
            )
          : this.state.messages.map((msg, i) =>
              h('div', {key: i}, this.renderMessage(msg))
            )
      ),
      h(
        'div',
        {class: 'drawer-input-horizontal'},
        h('textarea', {
          value: this.state.input,
          onChange: this.handleInputChange,
          onKeyDown: this.handleKeyDown,
          placeholder: t('Type your message...'),
          disabled: this.state.sending,
          style: {flex: 1, marginRight: '8px'}
        }),
        h(
          'button',
          {onClick: this.handleSendMessage, disabled: this.state.sending},
          this.state.sending ? h(TextSpinner, {}) : 'Send'
        )
      )
    )
  }
}
