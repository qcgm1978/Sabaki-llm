import {h, Component} from 'preact'

import Goban from './Goban.js'
import PlayBar from './bars/PlayBar.js'
import EditBar from './bars/EditBar.js'
import GuessBar from './bars/GuessBar.js'
import AutoplayBar from './bars/AutoplayBar.js'
import ScoringBar from './bars/ScoringBar.js'
import FindBar from './bars/FindBar.js'

import sabaki from '../modules/sabaki.js'
import * as gametree from '../modules/gametree.js'
import * as setting from '../setting.js'

export default class MainView extends Component {
  constructor(props) {
    super(props)

    this.handleTogglePlayer = () => {
      let {gameTree, treePosition, currentPlayer} = this.props
      sabaki.setPlayer(treePosition, -currentPlayer)
    }

    this.handleToolButtonClick = evt => {
      sabaki.setState({selectedTool: evt.tool})
    }

    this.handleFindButtonClick = evt =>
      sabaki.findMove(evt.step, {
        vertex: this.props.findVertex,
        text: this.props.findText
      })

    this.handleGobanVertexClick = this.handleGobanVertexClick.bind(this)
    this.handleGobanLineDraw = this.handleGobanLineDraw.bind(this)
  }

  componentDidMount() {
    // Pressing Ctrl/Cmd should show crosshair cursor on Goban in edit mode

    // 将匿名函数改为类方法以便在卸载时移除
    this.handleKeyDown = evt => {
      if (evt.key !== 'Control' && evt.key !== 'Meta') return

      if (this.props.mode === 'edit') {
        this.setState({gobanCrosshair: true})
      }
    }

    this.handleKeyUp = evt => {
      if (evt.key !== 'Control' && evt.key !== 'Meta') return

      if (this.props.mode === 'edit') {
        this.setState({gobanCrosshair: false})
      }
    }

    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)

    // 监听设置变化事件，特别是坐标类型的变化
    this.handleSettingChange = evt => {
      console.log('设置变化事件捕获:', evt.key, '=>', evt.value)
      // 对于任何设置变化，都强制更新组件
      this.forceUpdate()
    }

    // 简化事件监听器注册方式，直接使用窗口ID作为第一个参数
    const {remote} = require('electron')
    const windowId = remote.getCurrentWindow().id.toString()

    // 直接使用setting.events.on注册事件监听器
    setting.events.on(windowId, 'change', this.handleSettingChange)

    // 存储窗口ID以便在卸载时使用
    this.windowId = windowId

    // 添加初始日志，显示当前坐标类型设置
    console.log(
      'MainView初始化时坐标类型设置:',
      setting.get('view.coordinates_type')
    )
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.mode !== 'edit') {
      this.setState({gobanCrosshair: false})
    }
  }

  componentWillUnmount() {
    // 清理键盘事件监听器
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)

    // 虽然setting.js的events对象没有直接提供removeListener方法
    // 但我们可以通过重新创建事件发射器来清理监听器
    if (this.windowId) {
      const {remote} = require('electron')
      const currentWindows = remote.BrowserWindow.getAllWindows()
      // 检查窗口是否仍然存在
      if (
        !currentWindows.some(window => window.id.toString() === this.windowId)
      ) {
        console.log('窗口已关闭，事件监听器将被自动清理')
      }
    }
  }

  handleGobanVertexClick(evt) {
    sabaki.clickVertex(evt.vertex, evt)
  }

  handleGobanLineDraw(evt) {
    let {v1, v2} = evt.line
    sabaki.useTool(this.props.selectedTool, v1, v2)
    sabaki.editVertexData = null
  }

  render(
    {
      mode,
      gameIndex,
      gameTree,
      gameCurrents,
      treePosition,
      currentPlayer,
      gameInfo,

      deadStones,
      scoringMethod,
      scoreBoard,
      playVariation,
      analysis,
      analysisTreePosition,
      areaMap,
      blockedGuesses,

      highlightVertices,
      analysisType,
      showAnalysis,
      showCoordinates,
      coordinatesType, // 从props中解构coordinatesType
      showMoveColorization,
      showMoveNumbers,
      showNextMoves,
      showSiblings,
      fuzzyStonePlacement,
      animateStonePlacement,
      boardTransformation,

      selectedTool,
      findText,
      findVertex
    },
    {gobanCrosshair}
  ) {
    let node = gameTree.get(treePosition)
    let board = gametree.getBoard(gameTree, treePosition)
    let komi = +gametree.getRootProperty(gameTree, 'KM', 0)
    let handicap = +gametree.getRootProperty(gameTree, 'HA', 0)
    let paintMap

    if (['scoring', 'estimator'].includes(mode)) {
      paintMap = areaMap
    } else if (mode === 'guess') {
      paintMap = [...Array(board.height)].map(_ => Array(board.width).fill(0))

      for (let [x, y] of blockedGuesses) {
        paintMap[y][x] = 1
      }
    }

    return h(
      'section',
      {id: 'main'},

      h(
        'main',
        {ref: el => (this.mainElement = el)},

        h(Goban, {
          gameTree,
          treePosition,
          board,
          highlightVertices:
            findVertex && mode === 'find' ? [findVertex] : highlightVertices,
          analysisType,
          analysis:
            showAnalysis &&
            analysisTreePosition != null &&
            analysisTreePosition === treePosition
              ? analysis
              : null,
          paintMap,
          dimmedStones: ['scoring', 'estimator'].includes(mode)
            ? deadStones
            : [],

          crosshair: gobanCrosshair,
          showCoordinates,
          // 添加日志检查实际的坐标类型设置值
          // 使用从props传递的coordinatesType，而不是直接从setting获取
          coordinatesType: coordinatesType,
          showMoveColorization,
          showMoveNumbers: mode !== 'edit' && showMoveNumbers,
          showNextMoves: mode !== 'guess' && showNextMoves,
          showSiblings: mode !== 'guess' && showSiblings,
          fuzzyStonePlacement,
          animateStonePlacement,

          playVariation,
          drawLineMode:
            mode === 'edit' && ['arrow', 'line'].includes(selectedTool)
              ? selectedTool
              : null,
          transformation: boardTransformation,

          onVertexClick: this.handleGobanVertexClick,
          onLineDraw: this.handleGobanLineDraw
        })
      ),

      h(
        'section',
        {id: 'bar'},
        h(PlayBar, {
          mode,
          engineSyncers: [
            this.props.blackEngineSyncerId,
            this.props.whiteEngineSyncerId
          ].map(id =>
            this.props.attachedEngineSyncers.find(syncer => syncer.id === id)
          ),
          playerNames: gameInfo.playerNames,
          playerRanks: gameInfo.playerRanks,
          playerCaptures: [1, -1].map(sign => board.getCaptures(sign)),
          currentPlayer,
          showHotspot: node.data.HO != null,
          onCurrentPlayerClick: this.handleTogglePlayer
        }),

        h(EditBar, {
          mode,
          selectedTool,
          onToolButtonClick: this.handleToolButtonClick
        }),

        h(GuessBar, {
          mode,
          treePosition
        }),

        h(AutoplayBar, {
          mode,
          gameTree,
          gameCurrents: gameCurrents[gameIndex],
          treePosition
        }),

        h(ScoringBar, {
          type: 'scoring',
          mode,
          method: scoringMethod,
          scoreBoard,
          areaMap,
          komi,
          handicap
        }),

        h(ScoringBar, {
          type: 'estimator',
          mode,
          method: scoringMethod,
          scoreBoard,
          areaMap,
          komi,
          handicap
        }),

        h(FindBar, {
          mode,
          findText,
          onButtonClick: this.handleFindButtonClick
        })
      )
    )
  }
}
