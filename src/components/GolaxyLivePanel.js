import {h, Component} from 'preact'
import i18n from '../i18n.js'
import {getLiveReports, syncGolaxyOrYikeLizban, golaxy} from './golaxy.js'

const t = i18n.context('GolaxyLivePanel')

export default class GolaxyLivePanel extends Component {
  constructor(props) {
    super(props)
    this.state = {
      liveGames: [],
      searchQuery: '',
      isLoading: false,
      selectedGame: null,
      isSyncing: false
    }
  }

  async componentDidMount() {
    await this.fetchLiveGames()
  }

  async fetchLiveGames() {
    this.setState({isLoading: true})
    const games = await getLiveReports(this.state.searchQuery)
    this.setState({liveGames: games})
    this.setState({isLoading: false})
  }

  handleSearch = e => {
    this.setState({searchQuery: e.target.value})
  }

  handleSearchSubmit = async e => {
    e.preventDefault()
    await this.fetchLiveGames()
  }

  handleGameSelect = game => {
    this.setState({selectedGame: game})
  }

  handleSyncGame = async () => {
    if (!this.state.selectedGame) return

    this.setState({isSyncing: true})
    // 根据棋局是否结束决定is_live参数
    const is_live = this.state.selectedGame.liveStatus === 0
    const game_id = this.state.selectedGame.liveId

    // 同步游戏并获取SGF内容
    if (is_live) {
      await syncGolaxyOrYikeLizban([game_id], is_live)
      const [
        game,
        title,
        PB,
        PW,
        RE,
        DT,
        totalMoves,
        lastMove
      ] = golaxy.getPropsBySgfStr(golaxy.sgf)
      if (RE === 'Unknown Result') {
        golaxy.startSync(game_id, totalMoves, lastMove, PB, PW)
      }
    }

    // 获取SGF内容并加载到棋盘
    else {
      const url = `${golaxy.golaxyLiveUrl}/${game_id}`
      const sgfContent = await golaxy.getSgfByGolaxy(url)

      if (sgfContent) {
        await golaxy.syncSgf(game_id, sgfContent)

        // 只有直播中的棋局才开始实时同步
        if (is_live) {
        }
      }
      this.setState({isSyncing: false})
    }
  }

  handleStopSync = () => {
    golaxy.stopSync()
    this.setState({selectedGame: null})
  }

  render() {
    const {
      liveGames,
      searchQuery,
      isLoading,
      selectedGame,
      isSyncing
    } = this.state

    return h('div', {className: 'golaxy-live-panel'}, [
      h('div', {className: 'panel-header'}, [
        h(
          'form',
          {onSubmit: this.handleSearchSubmit, className: 'search-form'},
          [
            h('input', {
              type: 'text',
              value: searchQuery,
              onChange: this.handleSearch,
              placeholder: '搜索棋手或赛事',
              className: 'search-input'
            }),
            h('button', {type: 'submit', className: 'search-button'}, '搜索')
          ]
        )
      ]),

      isLoading
        ? h('div', {className: 'loading'}, '加载中...')
        : h('div', {className: 'games-list'}, [
            liveGames.length > 0
              ? liveGames.map(game =>
                  h(
                    'div',
                    {
                      key: game.id,
                      className:
                        'game-item ' +
                        (selectedGame && selectedGame.id === game.id
                          ? 'selected'
                          : ''),
                      onClick: () => this.handleGameSelect(game)
                    },
                    [
                      h('div', {className: 'game-info'}, [
                        h(
                          'div',
                          {className: 'game-title'},
                          game.name || '未命名对局'
                        ),
                        h('div', {className: 'players'}, [
                          h('span', {className: 'black-player'}, game.pb),
                          h('span', {}, ' vs '),
                          h('span', {className: 'white-player'}, game.pw)
                        ]),
                        h(
                          'div',
                          {className: 'game-status'},
                          [
                            h(
                              'span',
                              {},
                              '第 ' + (game.moveNum ? game.moveNum : 0) + ' 手'
                            ),
                            game.liveStatus === 0
                              ? h(
                                  'span',
                                  {className: 'live-indicator'},
                                  '(直播中)'
                                )
                              : h(
                                  'span',
                                  {className: ''},
                                  `(${game.gameResult})`
                                )
                          ].filter(Boolean)
                        )
                      ])
                    ]
                  )
                )
              : h('div', {className: 'no-games'}, '暂无符合条件的对局')
          ]),

      h('div', {className: 'action-buttons'}, [
        selectedGame
          ? [
              h(
                'button',
                {
                  className: 'sync-button',
                  onClick: this.handleSyncGame,
                  disabled: isSyncing
                },
                isSyncing ? '同步中...' : '同步到棋盘'
              ),
              // 只有直播中的棋局才显示停止同步按钮
              selectedGame.liveStatus === 0 &&
                h(
                  'button',
                  {
                    className: 'stop-sync-button',
                    onClick: this.handleStopSync
                  },
                  '停止同步'
                )
            ].filter(Boolean)
          : h(
              'button',
              {className: 'refresh-button', onClick: this.fetchLiveGames},
              '刷新列表'
            )
      ])
    ])
  }
}
