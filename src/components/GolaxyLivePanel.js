import {h, Component} from 'preact'
import i18n from '../i18n.js'
import sabaki from '../modules/sabaki.js'
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
    // 同步游戏并获取SGF内容
    await syncGolaxyOrYikeLizban([this.state.selectedGame.id], true)

    // 获取SGF内容并加载到棋盘
    const url = `${golaxy.golaxyLiveUrl}/${this.state.selectedGame.id}`
    const sgfContent = await golaxy.getSgfByGolaxy(url)

    if (sgfContent) {
      await sabaki.loadContent(sgfContent, '.sgf')
      sabaki.goToEnd()

      // 开始实时同步
      const [, , , , RE, , totalMoves, lastMove] = golaxy.getPropsBySgfStr(
        sgfContent
      )
      if (RE === 'Unknown Result') {
        golaxy.startSync(
          this.state.selectedGame.id,
          totalMoves,
          lastMove,
          this.state.selectedGame.black_player,
          this.state.selectedGame.white_player
        )
      }
    }
    this.setState({isSyncing: false})
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
                          h(
                            'span',
                            {className: 'black-player'},
                            game.black_player
                          ),
                          h('span', {}, ' vs '),
                          h(
                            'span',
                            {className: 'white-player'},
                            game.white_player
                          )
                        ]),
                        h(
                          'div',
                          {className: 'game-status'},
                          [
                            h(
                              'span',
                              {},
                              game.move_num
                                ? '第 ' + game.move_num + ' 手'
                                : '未开始'
                            ),
                            game.live_status === 1 &&
                              h(
                                'span',
                                {className: 'live-indicator'},
                                ' 直播中'
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
              h(
                'button',
                {
                  className: 'stop-sync-button',
                  onClick: this.handleStopSync
                },
                '停止同步'
              )
            ]
          : h(
              'button',
              {className: 'refresh-button', onClick: this.fetchLiveGames},
              '刷新列表'
            )
      ])
    ])
  }
}
