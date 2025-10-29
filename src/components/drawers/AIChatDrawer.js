import {createElement as h, Component} from 'preact/compat'
import sabaki from '../../modules/sabaki.js'
import i18n from '../../i18n.js'
import TextSpinner from '../TextSpinner.js'

const t = i18n.context('AIChatDrawer')

export default class AIChatDrawer extends Component {
  constructor(props) {
    super(props)
    this.scrollToBottom = true
    this.state = {
      messages: [],
      input: '',
      sending: false
    }
    this.messagesContainer = null
  }

  handleInputChange = evt => {
    this.setState({input: evt.target.value})
  }

  handleSendMessage = async () => {
    let message = this.state.input.trim()
    if (!message || this.state.sending) return

    const newMessages = [
      ...this.state.messages,
      {role: 'user', content: message},
      {role: 'waiting', id: Date.now()}
    ]
    this.setState({sending: true, messages: newMessages, input: ''})

    try {
      let response = await sabaki.sendDeepSeekMessage(message)
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
            {role: 'ai', content: response.content}
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
    }
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

  renderMessage(message) {
    // 处理等待消息的特殊情况
    if (message.role === 'waiting') {
      return h(
        'li',
        {class: 'command sending'},
        h(
          'pre',
          {style: {whiteSpace: 'pre-wrap', wordBreak: 'break-word'}},
          h('span', {class: 'engine'}, 'AI >  ', h(TextSpinner, {}))
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

  render() {
    if (!this.props.show) return null

    return h(
      'div',
      {class: 'ai-chat-drawer gtp-console'},
      h(
        'div',
        {class: 'drawer-header'},
        t('AI Assistant'),
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
      ),
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
