const SGF = require('@sabaki/sgf')
const fetch = require('node-fetch')

class GoCommunicate {
  constructor(u, c) {
    this.u = u
    this.c = c
    this.enableSyncSgf = false
    this.requestInterval = 5000
    this.requestTimer = null
    this.lastMove = null
    this.currentGameId = null
  }

  async requestJson(url, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    }
    const response = await fetch(url, {...defaultOptions, ...options})
    return await response.json()
  }

  async syncSgf(gameId, sgfContent) {
    // 同步SGF到应用中
    console.log(`同步游戏 ${gameId} 的SGF内容`)
    // 这里将在集成时调用sabaki的loadContent方法
  }

  restartRequestGolaxyOrYikeMove() {
    if (this.requestTimer) {
      clearInterval(this.requestTimer)
    }
    this.requestTimer = setInterval(() => {
      if (this.enableSyncSgf && this.currentGameId) {
        this.requestGolaxyOrYikeMove(
          this.currentGameId,
          this.lastMoveNum,
          this.lastMove,
          this.playerBlack,
          this.playerWhite
        )
      }
    }, this.requestInterval)
  }

  async requestGolaxyOrYikeMove(
    gameId,
    lastMoveNum,
    lastMove,
    playerBlack,
    playerWhite,
    isGolaxy = true
  ) {
    const data = await this.getGolaxyLive(gameId, lastMoveNum)
    if (data && data.length > 0) {
      const newMove = data[data.length - 1]
      if (newMove.move_num > lastMoveNum) {
        console.log(`发现新的一手: ${newMove.move_num}`)
        this.lastMoveNum = newMove.move_num
        // 这里将在集成时更新棋盘
      }
    }
  }

  stopSync() {
    this.enableSyncSgf = false
    if (this.requestTimer) {
      clearInterval(this.requestTimer)
      this.requestTimer = null
    }
  }

  startSync(gameId, lastMoveNum, lastMove, playerBlack, playerWhite) {
    this.currentGameId = gameId
    this.lastMoveNum = lastMoveNum
    this.lastMove = lastMove
    this.playerBlack = playerBlack
    this.playerWhite = playerWhite
    this.enableSyncSgf = true
    this.restartRequestGolaxyOrYikeMove()
  }
}

module.exports = GoCommunicate
