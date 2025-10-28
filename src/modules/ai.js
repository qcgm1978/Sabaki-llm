import * as remote from '@electron/remote'
const setting = remote.require('./setting')

/**
 * AI助手模块，处理与DeepSeek API的交互
 */
class AIHelper {
  /**
   * 向DeepSeek API发送消息
   * @param {string} message - 用户消息
   * @param {Object} gameContext - 游戏上下文信息
   * @returns {Promise<Object>} API响应
   */
  async sendDeepSeekMessage(message, gameContext) {
    let apiKey = setting.get('ai.deepseek_key')
    if (!apiKey) {
      return {error: 'DeepSeek API Key not configured'}
    }

    try {
      // 获取当前游戏信息作为上下文
      let {gameTrees, gameIndex, treePosition} = gameContext
      let tree = gameTrees[gameIndex]
      let currentNode = tree.get(treePosition)
      let moves = []
      let node = currentNode

      // 收集最近的20步棋作为上下文
      while (node && moves.length < 20) {
        if (node.data.B) moves.unshift(`B[${node.data.B.join('][')}]`)
        if (node.data.W) moves.unshift(`W[${node.data.W.join('][')}]`)
        node = tree.get(node.parentId)
      }

      let boardContext = moves.join('\n')

      // 调用DeepSeek API
      let response = await fetch(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content:
                  'You are a Go game assistant. Help analyze games, suggest moves, and answer questions about Go strategy. The current game state is:\n' +
                  boardContext
              },
              {
                role: 'user',
                content: message
              }
            ]
          })
        }
      )

      let data = await response.json()
      if (data.error) {
        return {error: data.error.message || 'API Error'}
      }

      return {content: data.choices[0].message.content}
    } catch (err) {
      return {error: err.message}
    }
  }
}

export default new AIHelper()
