import {h, Component} from 'preact'
import classNames from 'classnames'

import sabaki from '../modules/sabaki.js'
import {noop} from '../modules/helper.js'

export default class ChatInterface extends Component {
  constructor() {
    super()

    this.state = {
      input: '',
      messages: [],
      isLoading: false
    }

    this.handleInput = evt => this.setState({input: evt.currentTarget.value})
    this.handleSubmit = this.handleSubmit.bind(this)
    this.handleKeyPress = this.handleKeyPress.bind(this)
    this.closeChat = this.closeChat.bind(this)
    this.stopPropagation = evt => evt.stopPropagation()
  }

  async handleSubmit() {
    if (!this.state.input.trim() || this.state.isLoading) return

    let query = this.state.input.trim()
    this.setState(prev => ({
      input: '',
      messages: [...prev.messages, {type: 'user', content: query}],
      isLoading: true
    }))

    try {
      let response = await sabaki.processUserQuery(query)
      this.setState(prev => ({
        messages: [...prev.messages, {type: 'ai', content: response}],
        isLoading: false
      }))
    } catch (error) {
      this.setState(prev => ({
        messages: [...prev.messages, {type: 'error', content: error.message}],
        isLoading: false
      }))
    }
  }

  handleKeyPress(evt) {
    if (evt.key === 'Enter' && !evt.shiftKey) {
      evt.preventDefault()
      this.handleSubmit()
    }
  }

  closeChat() {
    sabaki.setState({showChatInterface: false})
  }

  clearHistory() {
    sabaki.clearPromptHistory()
    this.setState({messages: []})
  }

  render({show}, {input, messages, isLoading}) {
    return h(
      'section',
      {
        id: 'chat-interface',
        class: classNames({show}),
        onClick: this.closeChat
      },
      h(
        'div',
        {class: 'inner', onClick: this.stopPropagation},
        h(
          'div',
          {class: 'chat-header'},
          h('h3', null, 'AI 助手'),
          h(
            'div',
            {class: 'chat-actions'},
            h(
              'button',
              {
                class: 'clear-button',
                onClick: this.clearHistory,
                title: '清除历史'
              },
              '清除'
            ),
            h(
              'button',
              {
                class: 'close-button',
                onClick: this.closeChat,
                title: '关闭'
              },
              '×'
            )
          )
        ),
        h(
          'div',
          {class: 'chat-messages'},
          messages.map((msg, index) =>
            h(
              'div',
              {class: `message ${msg.type}`, key: index},
              h('div', {class: 'message-content'}, msg.content)
            )
          ),
          isLoading &&
            h(
              'div',
              {class: 'message loading'},
              h('div', {class: 'message-content'}, 'AI 正在思考...')
            )
        ),
        h(
          'div',
          {class: 'chat-input'},
          h('textarea', {
            placeholder: '输入您的问题或请求...',
            value: input,
            onInput: this.handleInput,
            onKeyPress: this.handleKeyPress,
            rows: 3,
            disabled: isLoading
          }),
          h(
            'button',
            {
              class: 'submit-button',
              onClick: this.handleSubmit,
              disabled: isLoading || !input.trim()
            },
            '发送'
          )
        )
      )
    )
  }
}
