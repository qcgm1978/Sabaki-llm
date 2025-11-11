import * as remote from '@electron/remote'
import i18n from '../i18n.js'
import * as helper from './helper.js'
import * as dialog from './dialog.js'
const setting = remote.require('./setting')
import aiHelper from './ai.js'
import {ApiKeyManager} from 'llm-service-provider'

/**
 * AI管理模块，处理AI相关功能
 */
class AIManager {
  constructor(sabaki) {
    this.sabaki = sabaki
    this.setting = remote.require('./setting')
  }

  openApiKeyManager() {
    // 由于ApiKeyManager是React组件，我们需要使用React或Preact进行渲染
    // 创建一个临时容器来渲染API密钥管理器
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    container.style.zIndex = '1000'
    container.style.display = 'flex'
    container.style.alignItems = 'center'
    container.style.justifyContent = 'center'

    document.body.appendChild(container)

    // 尝试动态导入React和render方法，避免直接依赖
    import('react')
      .then(React => {
        import('react-dom/client')
          .then(ReactDOM => {
            // 创建React根并渲染ApiKeyManager组件
            const root = ReactDOM.createRoot(container)
            // 定义关闭处理函数
            const handleClose = () => {
              root.unmount()
              document.body.removeChild(container)
            }

            root.render(
              React.createElement(ApiKeyManager, {
                isOpen: true,
                onSave: key => {
                  console.log('API key saved:', key)
                  // 将API密钥保存到设置中以持久化
                  this.setting.set('ai.llm.apiKey', key)
                },
                showCloseButton: false,
                onClose: handleClose,
                language: setting.get('app.lang') == 'zh-Hans' ? 'zh' : 'en',
                styleVariant: 'default',
                compactTemplate: true
              })
            )

            // 添加全局点击事件监听，如果点击容器外部则关闭
            container.addEventListener('click', e => {
              if (e.target === container) {
                handleClose()
              }
            })
          })
          .catch(() => {
            // 如果React DOM不可用，使用简化版本
            this.renderSimplifiedApiKeyManager(container)
          })
      })
      .catch(() => {
        // 如果React不可用，使用简化版本
        this.renderSimplifiedApiKeyManager(container)
      })
  }

  // 备用的简化版API密钥管理器
  renderSimplifiedApiKeyManager(container) {
    const apiKeyManager = document.createElement('div')
    apiKeyManager.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 500px;">
        <h2>配置 LLM API 密钥</h2>
        <p>请在设置中配置您的 API 密钥</p>
        <button id="close-btn" style="margin-top: 10px;">关闭</button>
      </div>
    `

    container.appendChild(apiKeyManager)

    document.getElementById('close-btn').addEventListener('click', () => {
      document.body.removeChild(container)
    })
  }

  /**
   * 发送消息到DeepSeek API
   */
  async sendLLMMessage(message, gameContext) {
    // 调用AI助手模块处理消息，使用llm-service-provider
    if (!gameContext) {
      gameContext = {
        gameTrees: this.sabaki.state.gameTrees,
        gameIndex: this.sabaki.state.gameIndex,
        treePosition: this.sabaki.state.treePosition
      }
    }

    // 这里将调用更新后的aiHelper方法
    return await aiHelper.sendLLMMessage(message, gameContext)
  }

  // 直接添加AI消息到聊天抽屉
  addAIMessage(content) {
    // 打开AI聊天抽屉
    this.sabaki.openDrawer('ai-chat')

    // 通知AIChatDrawer组件添加新消息
    this.sabaki.emit('ai.message.add', {role: 'ai', content: content})
  }
}

export default AIManager
