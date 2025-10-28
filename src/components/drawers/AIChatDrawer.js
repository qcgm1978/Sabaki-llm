import {h, Component} from 'preact'
import sabaki from '../../modules/sabaki.js'
import i18n from '../../i18n.js'
import TextSpinner from '../TextSpinner.js'

const t = i18n.context('AIChatDrawer')

// 消息条目组件，模仿GtpConsole的命令和响应样式
class MessageEntry extends Component {
  render({message}) {
    // 根据角色选择不同的样式类
    const getRoleClass = () => {
      switch (message.role) {
        case 'user':
          return 'success' // 用户消息使用成功色
        case 'ai':
          return 'engine' // AI消息使用引擎色
        case 'error':
          return 'error' // 错误消息使用错误色
        default:
          return 'internal'
      }
    }

    const getRoleLabel = () => {
      switch (message.role) {
        case 'user':
          return 'You>'
        case 'ai':
          return 'AI>'
        case 'error':
          return '!>'
        default:
          return '>'
      }
    }

    return h(
      'li',
      {class: 'command'},
      h(
        'pre',
        {},
        h('span', {class: getRoleClass()}, getRoleLabel()),
        ' ',
        // 将消息内容按行分割显示
        message.content.split('\n').map((line, i) =>
          h('span', {key: i}, [
            i > 0 ? '\n' : '', // 每行前添加换行符（第一行除外）
            '  ', // 缩进
            line
          ])
        )
      )
    )
  }
}

export default class AIChatDrawer extends Component {
  constructor(props) {
    super(props)

    this.scrollToBottom = true

    this.state = {
      messages: [],
      input: '',
      sending: false
    }

    this.handleInputChange = evt => {
      this.setState({input: evt.target.value})
    }

    this.handleSendMessage = async () => {
      let message = this.state.input.trim()
      if (!message || this.state.sending) return

      this.setState({
        sending: true,
        messages: [...this.state.messages, {role: 'user', content: message}],
        input: ''
      })

      try {
        let response = await sabaki.sendDeepSeekMessage(message)
        if (response.error) {
          this.setState({
            messages: [
              ...this.state.messages,
              {role: 'error', content: response.error}
            ]
          })
        } else {
          this.setState({
            messages: [
              ...this.state.messages,
              {role: 'ai', content: response.content}
            ]
          })
        }
      } catch (err) {
        this.setState({
          messages: [
            ...this.state.messages,
            {role: 'error', content: err.message}
          ]
        })
      } finally {
        this.setState({sending: false})
      }
    }

    this.handleKeyDown = evt => {
      if (evt.key === 'Enter' && !evt.shiftKey) {
        evt.preventDefault()
        this.handleSendMessage()
      }
    }

    this.handleClearMessages = () => {
      this.setState({messages: []})
    }
  }

  // 自动滚动到底部逻辑
  componentWillUpdate() {
    if (this.messagesContainer) {
      let {scrollTop, scrollHeight, offsetHeight} = this.messagesContainer
      this.scrollToBottom = scrollTop >= scrollHeight - offsetHeight
    }
  }

  componentDidUpdate() {
    if (this.messagesContainer && this.scrollToBottom) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight
    }
  }

  render() {
    if (!this.props.show) return null

    return h(
      'div',
      {
        class: 'ai-chat-drawer gtp-console', // 使用gtp-console类以便应用相同样式
        style: {
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '400px',
          backgroundColor: '#111',
          color: '#d0d0d0',
          boxShadow: '-5px 0 20px rgba(0,0,0,0.3)',
          zIndex: 10, // 与leftsidebar保持一致的z-index
          display: 'grid',
          gridTemplateRows: '40px 1fr 40px' // 头部、消息区、输入区
        }
      },
      [
        // 头部 - 模仿GtpConsole的简洁风格
        h(
          'div',
          {
            style: {
              padding: '10px',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#111',
              fontSize: '14px',
              fontWeight: 'bold'
            }
          },
          t('AI Assistant'),
          h(
            'button',
            {
              onClick: this.handleClearMessages,
              style: {
                padding: '5px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.7
              },
              title: t('Clear messages')
            },
            h('img', {
              src: '/node_modules/@primer/octicons/build/svg/trashcan.svg',
              width: '16px',
              height: '16px',
              alt: t('Clear'),
              style: {
                filter: 'invert(100%)'
              }
            })
          )
        ),

        // 消息区域 - 模仿GtpConsole的日志样式
        h(
          'ol',
          {
            ref: el => (this.messagesContainer = el),
            class: 'log',
            style: {
              flex: 1,
              overflowY: 'auto',
              padding: '0.3rem 10px',
              margin: 0,
              listStyle: 'none',
              fontFamily: 'Consolas, Menlo, Monaco, "Ubuntu Mono", monospace',
              fontSize: '14px',
              lineHeight: '1.3',
              userSelect: 'text',
              cursor: 'auto'
            }
          },
          [
            this.state.messages.length === 0 &&
              h(
                'li',
                {
                  style: {
                    color: '#888',
                    textAlign: 'center',
                    padding: '40px 20px'
                  }
                },
                t('Ask questions about the current game or Go strategy.')
              ),

            this.state.messages.map((message, index) =>
              h(MessageEntry, {key: index, message})
            ),

            this.state.sending &&
              h(
                'li',
                {class: 'response waiting'},
                h('pre', {}, h('span', {class: 'internal'}, h(TextSpinner)))
              )
          ]
        ),

        // 输入区域 - 模仿GtpConsole的单行输入样式
        h(
          'div',
          {
            class: 'input',
            style: {
              position: 'relative',
              background: '#181818',
              overflow: 'hidden',
              borderTop: '1px solid #333'
            }
          },
          h('input', {
            type: 'text',
            value: this.state.input,
            onChange: this.handleInputChange,
            onKeyDown: this.handleKeyDown,
            placeholder: t('Type your question...'),
            disabled: this.state.sending,
            style: {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '100%',
              boxSizing: 'border-box',
              padding: '0 10px',
              backgroundColor: 'transparent',
              color: '#d0d0d0',
              border: 'none',
              fontFamily: 'Consolas, Menlo, Monaco, "Ubuntu Mono", monospace',
              fontSize: '14px',
              zIndex: 3
            }
          })
        )
      ]
    )
  }
}
