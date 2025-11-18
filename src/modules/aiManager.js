import * as remote from '@electron/remote'
import aiHelper from './ai.js'
import {ApiKeyManager} from 'llm-service-provider'

class AIManager {
  constructor(sabaki) {
    this.sabaki = sabaki
    this.setting = remote.require('./setting')
  }

  openApiKeyManager() {
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

    import('react')
      .then(React => {
        import('react-dom/client')
          .then(ReactDOM => {
            const root = ReactDOM.createRoot(container)

            const handleClose = () => {
              root.unmount()
              document.body.removeChild(container)
            }

            root.render(
              React.createElement(ApiKeyManager, {
                isOpen: true,
                onSave: key => {
                  console.log('API key saved:', key)

                  this.setting.set('ai.llm.apiKey', key)
                },
                showCloseButton: false,
                onClose: handleClose,
                language:
                  this.setting.get('app.lang') == 'zh-Hans' ? 'zh' : 'en',
                styleVariant: 'default',
                compactTemplate: true
              })
            )

            container.addEventListener('click', e => {
              if (e.target === container) {
                handleClose()
              }
            })
          })
          .catch(() => {
            this.renderSimplifiedApiKeyManager(container)
          })
      })
      .catch(() => {
        this.renderSimplifiedApiKeyManager(container)
      })
  }

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

  async sendLLMMessage(message, gameContext) {
    if (!gameContext) {
      gameContext = {
        gameTrees: this.sabaki.state.gameTrees,
        gameIndex: this.sabaki.state.gameIndex,
        treePosition: this.sabaki.state.treePosition
      }
    }

    return await aiHelper.sendLLMMessage(message, gameContext)
  }

  addAIMessage(content) {
    this.sabaki.openDrawer('ai-chat')

    this.sabaki.emit('ai.message.add', {role: 'ai', content: content})
  }
}

export default AIManager
