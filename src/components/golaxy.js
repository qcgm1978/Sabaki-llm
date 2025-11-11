const SGF = require('@sabaki/sgf')
const GoCommunicate = require('./go_communicate')

// 延迟导入sabaki模块，避免循环依赖
let sabaki = null

class Golaxy extends GoCommunicate {
  constructor(
    prop = 'name',
    today = new Date().toISOString().split('T')[0],
    isLive = true
  ) {
    super()
    this.golaxy_host = 'https://19x19.com'
    this.engine = `${this.golaxy_host}/api/engine`
    this.engineGames = `${this.engine}/games`
    this.golaxyHost = 'https://19x19.com'
    this.golaxyLiveUrl = `${this.engine}/golives`
    this.lizgobanHost = 'http://localhost:7237'
    this.prop = prop
    this.authorizationValue = null
    this.dataCate = null
    this.isLive = isLive
    this.otherData = {}
    this.goodNum = 11
    this.badNum = 4
    this.dLevel = {
      0: '最佳',
      1: '很好',
      3: '可下',
      4: '欠佳',
      5: '失误',
      6: '恶手',
      '-100': '最后一手'
    }
    this.gameResult = {
      0: {
        和: 1,
        无效对局: 0
      },
      1: {
        白中盘胜: 3,
        白超时胜: 7,
        白胜: 5
      },
      '-1': {
        黑中盘胜: 2,
        黑超时胜: 6,
        黑胜: 4
      }
    }
    this.resultTxt = {
      'B+R': {
        txt: '黑中盘胜',
        win: 'b',
        num: false
      },
      'W+R': {
        txt: '白中盘胜',
        win: 'w',
        num: false
      },
      'B+T': {
        txt: '白超时负',
        win: 'b',
        num: false
      },
      'W+T': {
        txt: '黑超时负',
        win: 'w',
        num: false
      },
      'B+O': {
        txt: '白断线负',
        win: 'b',
        num: false
      },
      'W+O': {
        txt: '黑断线负',
        win: 'w',
        num: false
      },
      'R+R': {
        txt: '和棋',
        win: '',
        num: false
      },
      'N+N': {
        txt: '无效对局',
        win: '',
        num: false
      },
      'N+R': {
        txt: '',
        win: null,
        num: false,
        liveTxt: '无胜负'
      },
      'B+': {
        txt: '黑胜',
        win: 'b',
        num: false
      },
      'W+': {
        txt: '白胜',
        win: 'w',
        num: false
      }
    }

    this.dGameId = {}
    this.frameNum = Infinity
    this.gamenameExcluding = ''
    this.isSync = false
    this.today = today
    if (this.today) {
      this.golaxyName = `${this.today}-golaxy`
      // this.golaxyAddress = `${u.resourcePath}${this.golaxyName}`
      // this.golaxyDataAddress = `${u.dataPath}${this.golaxyName}`
    }
  }

  async getLiveReports(name = '', page = 0) {
    const liveUrl = `${this.engine}/golives/all`
    const liveHistoryUrl = `${this.engine}/golives/history?page=${page}&size=20&live_type=TOP_LIVE`
    const livePageUrl = liveHistoryUrl

    const lLive = await this.requestJson(liveUrl)
    const lHistory = await this.requestJson(livePageUrl)

    const live = lLive.data.map(t => t.liveMatch)
    const history = lHistory.data.matches

    const liveGames = [...live, ...history].filter(t =>
      t[this.prop].includes(name)
    )

    return liveGames
  }
  getGolaxyPv(dat) {
    const option = dat.options[0]
    const variation = option.variation.split(',')
    const m = option.coord
    const moves = [m, ...variation]
    return moves
  }

  getGolaxySuggest(dat) {
    const option = dat.options[0]
    const variation = option.variation.split(',')
    const m = option.coord
    const moves = [m, ...variation]
    const move = {move: m, pv: moves}
    return move
  }

  async getGolaxyLive(gameId, moveNum) {
    const url = `${
      this.golaxyLiveUrl
    }/base/${gameId}?live_id=${gameId}&begin_move_num=${moveNum}&end_move_num=${moveNum +
      2}`
    const response = await fetch(url)
    const d = await response.json()
    return d && d.data
  }

  getReportUrl(game, isLive = true) {
    const gameId = game.id
    const moveNum = game.moveNum
    if (isLive) {
      const liveId = game.liveId
      return `${this.golaxyLiveUrl}/base/${liveId}?live_id=${liveId}&begin_move_num=0&end_move_num=${moveNum}`
    } else {
      // return `${this.engineGames}/report/null/${gameId}?game_id=${gameId}&start_move_num=0&end_move_num=${moveNum}`
      return `${this.golaxyLiveUrl}/${gameId}`
    }
  }
  async syncGolaxyOrYikeLizban(
    gameIds,
    isReport = false,
    requestAgain = false,
    isGolaxy = true
  ) {
    for (const gameId of gameIds) {
      // if (this.dGameId[gameId] && !requestAgain) {
      //     this.enableSyncSgf = true;
      //     this.restartRequestGolaxyOrYikeMove()
      //     continue;
      // }
      let s
      if (isGolaxy) {
        const url = `${this.golaxyLiveUrl}/${gameId}`
        // const url = this.isLive
        //   ? `${this.golaxyLiveUrl}/${gameId}`
        //   : `${this.engineGames}/0086-18602481789/${gameId}?id=${gameId}`
        s = await this.getSgfByGolaxy(url)
      } else {
        s = await this.getYikeSgfData(gameId, !isReport)
      }
      const [
        game,
        title,
        PB,
        PW,
        RE,
        DT,
        totalMoves,
        lastMove
      ] = this.getPropsBySgfStr(s)
      const sgfS = this.convertCoordinate(lastMove)
      const playerBlack = PB
      const playerWhite = PW
      // const sgfP = `${this.sgfFolder}/${playerBlack}-${playerWhite}-${gameId}`;
      await this.syncSgf(gameId, s)
      this.dGameId[gameId] = true
      if (RE != 'Unknown Result') {
        return
      }
      const t = new Promise(resolve => {
        this.requestGolaxyOrYikeMove(
          gameId,
          totalMoves,
          sgfS,
          playerBlack,
          playerWhite,
          isGolaxy
        ).then(resolve)
      })
      await t
    }
    return gameIds
  }
  convertFromCoordinate(coordinateStr) {
    // 将围棋棋谱中的字符串坐标转换为 (x, y) 坐标
    let y = coordinateStr.charCodeAt(0) - 'a'.charCodeAt(0)
    let x = parseInt(coordinateStr.slice(1)) - 1
    if (y > 7) {
      y -= 1
    }
    return [x, y]
  }

  convertCoordinate(coordinate) {
    // 将 (x, y) 坐标转换为围棋棋谱中的字符串坐标
    let [x, y] = coordinate
    if (y > 7) {
      y += 1
    }
    return (
      String.fromCharCode('a'.charCodeAt(0) + y).toUpperCase() +
      (x + 1).toString()
    )
  }
  getPropsBySgfStr(sgfStr) {
    const parsed = SGF.parse(sgfStr)
    const rootNode = parsed[0]
    const gameInfo = rootNode.data

    const game = {} // 根据需要初始化游戏对象
    const title = gameInfo.GN ? gameInfo.GN[0] : 'Unknown Title'
    const PB = gameInfo.PB ? gameInfo.PB[0] : 'Unknown Black Player'
    const PW = gameInfo.PW ? gameInfo.PW[0] : 'Unknown White Player'
    const RE = gameInfo.RE ? gameInfo.RE[0] : 'Unknown Result'
    const DT = gameInfo.DT ? gameInfo.DT[0] : 'Unknown Date'
    const {totalMoves, lastMove} = this.countMovesAndGetLastMove(rootNode)

    return [game, title, PB, PW, RE, DT, totalMoves, lastMove] // 返回总步数和最后一步棋的表示
  }
  countMovesAndGetLastMove(node) {
    let count = 0
    let lastMove = null

    function traverse(node) {
      if (node.data) {
        const b_w = node.data.B || node.data.W
        lastMove = b_w ? b_w[0] : null // 更新最后一步
      }
      if (node.children) {
        for (const child of node.children) {
          count += 1
          traverse(child)
        }
      }
    }

    traverse(node)
    return {totalMoves: count, lastMove}
  }
  async getSgfByGolaxy(url, isD = false) {
    const response = await fetch(url)
    const d = await response.json()
    if (isD) {
      return d
    }
    const sgf = d && d.data.sgf
    this.sgf = sgf
    return sgf
  }

  async syncSgf(gameId, sgfContent) {
    // 同步SGF到Sabaki应用中
    console.log(`同步游戏 ${gameId} 的SGF内容`)

    // 确保sabaki已加载 - 使用正确的导入方式获取实例
    if (!sabaki) {
      try {
        // 动态导入sabaki模块 - 使用ES模块导入语法
        const sabakiModule = await import('../modules/sabaki.js')
        sabaki = sabakiModule.default
        console.log('Sabaki模块已成功导入并获取实例')
      } catch (importError) {
        console.error('导入Sabaki模块失败:', importError)
        // 尝试CommonJS导入作为备选方案
        try {
          sabaki = require('../modules/sabaki')
          console.log('使用CommonJS导入Sabaki模块成功')
        } catch (commonJsError) {
          console.error('CommonJS导入也失败:', commonJsError)
          return
        }
      }
    }

    // 确保sabaki是正确的实例
    if (!sabaki || typeof sabaki !== 'object') {
      console.error('sabaki不是有效的对象')
      return
    }

    try {
      // 检查loadContent方法是否存在
      if (typeof sabaki.loadContent === 'function') {
        await sabaki.loadContent(sgfContent, '.sgf')

        // 检查goToEnd方法是否存在
        if (typeof sabaki.goToEnd === 'function') {
          sabaki.goToEnd()
        } else {
          console.warn('sabaki.goToEnd方法不存在')
        }
      } else {
        console.error('sabaki.loadContent方法不存在')
        // 打印sabaki对象的方法，帮助调试
        console.log(
          'sabaki对象可用方法:',
          Object.keys(sabaki).filter(key => typeof sabaki[key] === 'function')
        )

        // 尝试直接使用正确的方式导入
        try {
          const directSabaki = window.require
            ? window.require('../modules/sabaki')
            : null
          if (directSabaki && typeof directSabaki.loadContent === 'function') {
            console.log('尝试使用直接导入的sabaki实例')
            await directSabaki.loadContent(sgfContent, '.sgf')
            if (typeof directSabaki.goToEnd === 'function') {
              directSabaki.goToEnd()
            }
          }
        } catch (directError) {
          console.error('直接导入尝试失败:', directError)
        }
      }
    } catch (error) {
      console.error('同步SGF失败:', error)
    }
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
      if (newMove.moveNum > lastMoveNum) {
        console.log(`发现新的一手: ${newMove.moveNum}`)
        this.lastMoveNum = newMove.moveNum
        this.lastMove = JSON.parse(newMove.data).coord

        // 实时更新棋盘
        if (sabaki) {
          // 获取最新的完整SGF
          const url = this.isLive
            ? `${this.golaxyLiveUrl}/${gameId}`
            : `${this.engineGames}/0086-18602481789/${gameId}?id=${gameId}`
          const latestSgf = await this.getSgfByGolaxy(url)

          if (latestSgf) {
            // 加载最新的SGF并跳转到最后一手
            if (sabaki && typeof sabaki.loadContent === 'function') {
              await sabaki.loadContent(latestSgf, '.sgf')
              if (typeof sabaki.goToEnd === 'function') {
                sabaki.goToEnd()
              }
            } else {
              console.error('无法加载SGF内容，sabaki对象或方法不可用')
            }

            // 显示新着提示
            if (sabaki.flashInfoOverlay) {
              sabaki.flashInfoOverlay(`新着: ${this.lastMove}`)
            }
          }
        }
      }
    }
  }
}
const golaxy = new Golaxy()

async function getLiveReports(name = '', page = 0) {
  const reports = await golaxy.getLiveReports(name, page)
  return reports
}
async function syncGolaxyOrYikeLizban(liveIds, is_live = true) {
  golaxy.isLive = is_live
  const reports = await golaxy.syncGolaxyOrYikeLizban(liveIds)
  return reports
}
module.exports = {
  getLiveReports,
  syncGolaxyOrYikeLizban,
  golaxy
}
