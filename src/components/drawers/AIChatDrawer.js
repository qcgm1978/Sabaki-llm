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
    this.state = {
      messages: [],
      input: '',
      sending: false,
      showMCPTools: false,
      activeTool: null,
      toolParams: {},
      history: [],
      currentHistoryIndex: -1,
      tempInput: ''
    }
    this.messagesContainer = null

    // 监听AI消息添加事件
    sabaki.on('ai.message.add', this.handleAIMessageAdd)
  }

  componentWillUnmount() {
    // 移除事件监听
    sabaki.off('ai.message.add', this.handleAIMessageAdd)
  }

  handleAIMessageAdd = message => {
    // 添加新的AI消息到消息列表
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

    try {
      // 传递当前游戏上下文
      const gameContext = {
        gameTrees: sabaki.state.gameTrees,
        gameIndex: sabaki.state.gameIndex,
        treePosition: sabaki.state.treePosition
      }

      let response = await sabaki.sendLLMMessage(message, gameContext)
      // 移除等待消息并添加响应
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
    } catch (err) {
      // 移除等待消息并添加错误
      const updatedMessages = newMessages.filter(msg => msg.role !== 'waiting')
      this.setState({
        messages: [...updatedMessages, {role: 'error', content: err.message}],
        sending: false
      })
    }
  }

  handleKeyDown = evt => {
    if (evt.key === 'Enter' && !evt.shiftKey) {
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

  componentDidUpdate() {
    if (this.messagesContainer && this.scrollToBottom) {
      setTimeout(() => {
        if (this.messagesContainer) {
          this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
        }
      }, 0)
    }
  }

  toggleMCPTools = () => {
    this.setState(prevState => ({
      showMCPTools: !prevState.showMCPTools,
      activeTool: prevState.showMCPTools ? null : prevState.activeTool
    }))
  }

  handleToolSelect = tool => {
    // 初始化工具参数为默认值
    let defaultParams = {}
    if (tool.parameters && tool.parameters.properties) {
      Object.keys(tool.parameters.properties).forEach(key => {
        if (tool.parameters.properties[key].default !== undefined) {
          defaultParams[key] = tool.parameters.properties[key].default
        }
      })
    }

    this.setState({activeTool: tool, toolParams: defaultParams})
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

    this.setState(prevState => ({
      sending: true,
      messages: [
        ...prevState.messages,
        {
          role: 'system',
          content: `正在执行工具: ${this.state.activeTool.name}`
        }
      ]
    }))

    try {
      // 传递当前游戏上下文
      const gameContext = {
        gameTrees: sabaki.state.gameTrees,
        gameIndex: sabaki.state.gameIndex,
        treePosition: sabaki.state.treePosition
      }

      // 调用MCP工具
      let response = await sabaki.aiManager.sendLLMMessage(
        {
          mcp: {
            tool: {
              name: this.state.activeTool.name,
              description: this.state.activeTool.description,
              parameters: this.state.toolParams
            }
          }
        },
        gameContext
      )

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
            content: `工具执行失败: ${error.message}`
          }
        ],
        sending: false
      }))
    }
  }

  renderMessage(message) {
    // 处理等待消息的特殊情况
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

    // 处理工具结果消息
    if (message.role === 'tool-result') {
      return h(
        'li',
        {class: 'command tool-result'},
        h(
          'pre',
          {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
          h('span', {class: 'engine'}, `工具结果 (${message.toolName})>  `),
          h('span', null, message.content)
        )
      )
    }

    // 处理系统消息
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
      roleLabel = 'AI>'
    } else if (message.role === 'error') {
      roleClass = 'error'
      roleLabel = '!>'
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

    return h(
      'div',
      {class: 'ai-chat-mcp-tools'},
      h(
        'div',
        {class: 'ai-chat-mcp-tool-list'},
        availableTools.map(tool =>
          h(
            'button',
            {
              key: tool.id,
              class: `button button-small ${
                this.state.activeTool?.id === tool.id ? 'active' : ''
              }`,
              onClick: () => this.handleToolSelect(tool)
            },
            tool.name
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
                      type: 'number',
                      value:
                        this.state.toolParams[paramName] ||
                        paramDef.default ||
                        '',
                      onChange: e =>
                        this.handleToolParamChange(
                          paramName,
                          parseFloat(e.target.value)
                        ),
                      min: '1'
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
        {class: 'drawer-input'},
        h('textarea', {
          value: this.state.input,
          onChange: this.handleInputChange,
          onKeyDown: this.handleKeyDown,
          placeholder: t('Type your message...'),
          disabled: this.state.sending
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
