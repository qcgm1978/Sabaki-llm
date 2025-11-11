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
      isSyncing: false,
      syncingGameId: null,
      lastMove: null
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

    this.setState({syncingGameId: game_id})

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
      this.setState({lastMove})
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
    this.setState({isSyncing: false})
    this.setState({syncingGameId: null})
    this.setState({lastMove: null})
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
              placeholder: i18n.t('golaxy', 'Search players or events'),
              className: 'search-input'
            }),
            h(
              'button',
              {type: 'submit', className: 'search-button'},
              i18n.t('golaxy', 'Search')
            )
          ]
        )
      ]),

      isLoading
        ? h('div', {className: 'loading'}, i18n.t('golaxy', 'Loading...'))
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
                          game.name || i18n.t('golaxy', 'Unnamed game')
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
                              (game.moveNum ? game.moveNum : 0) +
                                i18n.t('golaxy', 'Move')
                            ),
                            game.liveStatus === 0
                              ? h(
                                  'span',
                                  {className: 'live-indicator'},
                                  `(${i18n.t('golaxy', 'Live')}${
                                    this.state.syncingGameId === game.id &&
                                    this.state.lastMove
                                      ? `, ${i18n.t('golaxy', 'New move')}: ${
                                          this.state.lastMove
                                        }`
                                      : ''
                                  })`
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
              : h(
                  'div',
                  {className: 'no-games'},
                  i18n.t('golaxy', 'No matching games found')
                )
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
                isSyncing
                  ? i18n.t('golaxy', 'Syncing...')
                  : i18n.t('golaxy', 'Sync to board')
              ),
              // 只有直播中的棋局才显示停止同步按钮
              selectedGame.liveStatus === 0 &&
                h(
                  'button',
                  {
                    className: 'stop-sync-button',
                    onClick: () => this.handleStopSync()
                  },
                  i18n.t('golaxy', 'Stop sync')
                )
            ].filter(Boolean)
          : h(
              'button',
              {
                className: 'refresh-button',
                onClick: () => this.fetchLiveGames()
              },
              i18n.t('golaxy', 'Refresh list')
            )
      ])
    ])
  }
}
