import {createElement as h, Component} from 'preact/compat'
import sabaki from '../../modules/sabaki.js'
import i18n from '../../i18n.js'
import TextSpinner from '../TextSpinner.js'
import mcpHelper from '../../modules/mcpHelper.js'
import Drawer from './Drawer.js'

const t = i18n.context('AIChatDrawer')

export default class AIChatDrawer extends Drawer {
  constructor(props) {
    super(props)
    this.scrollToBottom = true

    const savedHistory = JSON.parse(
      localStorage.getItem('sabaki-llm-history') || '[]'
    )
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
      gtpSearchTerm: ''
    }

    // 加载问题分类
    this.loadQuestionCategories()
    this.messagesContainer = null

    sabaki.on('ai.message.add', this.handleAIMessageAdd)
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

    let response = await sabaki.sendLLMMessage(message, gameContext)

    const updatedMessages = newMessages.filter(msg => msg.role !== 'waiting')
    if (response.error) {
      this.setState({
        messages: [
          ...updatedMessages,
          {role: 'error', content: response.error}
        ],
        sending: false
      })
    } else {
      this.setState({
        messages: [
          ...updatedMessages,
          {role: 'ai', content: response.content || response}
        ],
        sending: false
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
      let response = await sabaki.aiManager.sendLLMMessage(message, gameContext)

      this.setState(prevState => ({
        messages: [
          ...prevState.messages,
          {
            role: 'tool-result',
            content: response.error || response.content,
            toolName: this.state.activeTool.name
          }
        ],
        sending: false
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
        sending: false
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

    // 对于AI消息，允许HTML内容
    if (message.role === 'ai') {
      return h(
        'li',
        {class: 'command'},
        h(
          'div',
          {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
          h('span', {class: roleClass}, roleLabel + '  '),
          h('span', {
            dangerouslySetInnerHTML: {
              __html: message.content.replace(/\n/g, '<br>  ')
            }
          })
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
