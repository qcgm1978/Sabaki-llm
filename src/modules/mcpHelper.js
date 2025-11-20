import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import engineSyncer from './enginesyncer.js'
import sabaki from './sabaki.js'
import commands from './commands.js'
class MCPHelper {
  constructor() {
    this.mcpEndpoints = []
    this.registerDefaultEndpoints()
  }

  registerDefaultEndpoints() {
    // 注册获取棋盘上下文端点
    this.registerGetBoardContext()

    this.registerEndpoint({
      id: 'get-game-metadata',
      name: '获取棋局元信息',
      description: '提取当前棋局的元信息，如赛事、选手、等级、规则等',
      type: 'info_retrieval',
      parameters: {
        type: 'object',
        properties: {
          includeEmptyFields: {
            type: 'boolean',
            description: '是否包含空字段',
            default: false
          }
        }
      },
      handler: this.handleGetGameMetadata.bind(this)
    })

    this.registerEndpoint({
      id: 'get-game-info',
      name: '获取棋局详细信息',
      description:
        '提取当前棋局的详细信息，包括赛事、选手、等级、规则等，并以格式化字符串返回',
      type: 'info_retrieval',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            description: '返回格式，可以是text或object',
            enum: ['text', 'object'],
            default: 'text'
          }
        }
      },
      handler: this.handleGetGameInfo.bind(this)
    })

    this.registerEndpoint({
      id: 'katago-analysis',
      name: 'KataGo分析',
      description: '使用KataGo分析当前棋局，提供胜率、最佳着法等信息',
      parameters: {
        type: 'object',
        properties: {
          lookahead: {
            type: 'number',
            description: '分析步数',
            default: 5
          },
          visits: {
            type: 'number',
            description: '分析访问量',
            default: 100
          }
        }
      },
      handler: this.handleKataGoAnalysis.bind(this)
    })

    this.registerEndpoint({
      id: 'katago-score',
      name: 'KataGo评分',
      description: '使用KataGo对当前棋局进行形势判断',
      parameters: {
        type: 'object',
        properties: {
          visits: {
            type: 'number',
            description: '分析访问量',
            default: 50
          }
        }
      },
      handler: this.handleKataGoScore.bind(this)
    })

    const gtpCommands = commands

    gtpCommands.forEach(cmd => {
      const noParamsCommands = [
        'protocol_version',
        'name',
        'version',
        'list_commands',
        'quit',
        'clear_board',
        'get_komi',
        'undo',
        'kata-get-rules',
        'kata-get-models',
        'kata-list-params',
        'showboard',
        'final_score',
        'final_status_list',
        'printsgf',
        'cputime',
        'gomill-cpu_time',
        'kata-debug-print-tc',
        'debug_moves',
        'stop'
      ]

      let parameters = null

      if (!noParamsCommands.includes(cmd.id)) {
        parameters = {
          type: 'object',
          properties: {
            args: {
              type: 'array',
              description: '命令参数列表',
              items: {
                type: 'string'
              },
              default: []
            }
          }
        }
      }

      if (cmd.id === 'genmove') {
        parameters = {
          type: 'object',
          required: ['color'],
          properties: {
            color: {
              type: 'string',
              description: '要生成的棋子颜色，必须是B(黑)或W(白)',
              enum: ['B', 'W']
            }
          }
        }
      } else if (cmd.id === 'play') {
        parameters = {
          type: 'object',
          required: ['color', 'vertex'],
          properties: {
            color: {
              type: 'string',
              description: '落子颜色，必须是B(黑)或W(白)',
              enum: ['B', 'W']
            },
            vertex: {
              type: 'string',
              description: '落子位置，如A1、T19或pass'
            }
          }
        }
      } else if (cmd.id === 'boardsize') {
        parameters = {
          type: 'object',
          required: ['size'],
          properties: {
            size: {
              type: 'integer',
              description: '棋盘大小，如9、13、19等',
              minimum: 1
            }
          }
        }
      } else if (cmd.id === 'rectangular_boardsize') {
        parameters = {
          type: 'object',
          required: ['width', 'height'],
          properties: {
            width: {
              type: 'integer',
              description: '棋盘宽度',
              minimum: 1
            },
            height: {
              type: 'integer',
              description: '棋盘高度',
              minimum: 1
            }
          }
        }
      } else if (cmd.id === 'komi') {
        parameters = {
          type: 'object',
          required: ['value'],
          properties: {
            value: {
              type: 'number',
              description: '贴目值'
            }
          }
        }
      } else if (cmd.id === 'known_command') {
        parameters = {
          type: 'object',
          required: ['command'],
          properties: {
            command: {
              type: 'string',
              description: '要检查的命令名称'
            }
          }
        }
      } else if (cmd.id === 'kata-set-rules') {
        parameters = {
          type: 'object',
          required: ['rules'],
          properties: {
            rules: {
              type: 'string',
              description:
                '规则设置，可以是JSON字典或规则简写（如tromp-taylor、chinese-kgs、aga等）'
            }
          }
        }
      } else if (cmd.id === 'kata-analyze') {
        parameters = {
          type: 'object',
          properties: {
            player: {
              type: 'string',
              description: '指定分析方，B或W',
              enum: ['B', 'W']
            },
            interval: {
              type: 'integer',
              description: '分析间隔'
            },
            rootInfo: {
              type: 'boolean',
              description: '是否包含根节点信息'
            },
            ownership: {
              type: 'boolean',
              description: '是否包含所有权信息'
            },
            pvVisits: {
              type: 'boolean',
              description: '是否包含变例访问信息'
            }
          }
        }
      } else if (cmd.id === 'kata-raw-nn') {
        parameters = {
          type: 'object',
          required: ['symmetry'],
          properties: {
            symmetry: {
              type: ['integer', 'string'],
              description: '对称性参数，0-7的整数或all',
              enum: [0, 1, 2, 3, 4, 5, 6, 7, 'all']
            }
          }
        }
      } else if (cmd.id === 'kata-raw-human-nn') {
        parameters = {
          type: 'object',
          required: ['symmetry'],
          properties: {
            symmetry: {
              type: ['integer', 'string'],
              description: '对称性参数，0-7的整数或all',
              enum: [0, 1, 2, 3, 4, 5, 6, 7, 'all']
            }
          },
          dependencies: {
            'human-model': {
              description: '需要通过命令行参数 -human-model 提供人类模型文件'
            }
          }
        }
      } else if (cmd.id === 'kata-benchmark') {
        parameters = {
          type: 'object',
          required: ['nVisits'],
          properties: {
            nVisits: {
              type: 'integer',
              description: '基准测试的访问次数'
            }
          }
        }
      } else if (cmd.id === 'kata-get-param') {
        parameters = {
          type: 'object',
          required: ['param'],
          properties: {
            param: {
              type: 'string',
              description: '要获取的参数名称'
            }
          }
        }
      } else if (cmd.id === 'kata-set-param') {
        parameters = {
          type: 'object',
          required: ['param', 'value'],
          properties: {
            param: {
              type: 'string',
              description: '要设置的参数名称'
            },
            value: {
              type: ['string', 'number', 'boolean'],
              description: '要设置的参数值'
            }
          }
        }
      } else if (cmd.id === 'set_position') {
        parameters = {
          type: 'object',
          properties: {
            position: {
              type: 'string',
              description:
                '空格分隔的颜色-顶点对序列，如 "B a1 W b1" (顶点坐标使用小写字母)'
            }
          }
        }
      } else if (cmd.id === 'kgs-rules') {
        parameters = {
          type: 'object',
          required: ['rules'],
          properties: {
            rules: {
              type: 'string',
              description: 'KGS规则设置，如chinese、japanese、aga等'
            }
          }
        }
      } else if (cmd.id === 'time_settings') {
        parameters = {
          type: 'object',
          required: ['mainTime', 'byoYomiTime', 'byoYomiStones'],
          properties: {
            mainTime: {
              type: 'integer',
              description: '主时间（秒）'
            },
            byoYomiTime: {
              type: 'integer',
              description: '读秒时间（秒）'
            },
            byoYomiStones: {
              type: 'integer',
              description: '读秒次数'
            }
          }
        }
      } else if (cmd.id === 'kgs-time_settings') {
        parameters = {
          type: 'object',
          required: ['mainTime', 'byoYomiTime', 'byoYomiPeriods'],
          properties: {
            mainTime: {
              type: 'integer',
              description: '主时间（秒）'
            },
            byoYomiTime: {
              type: 'integer',
              description: '每读秒周期时间（秒）'
            },
            byoYomiPeriods: {
              type: 'integer',
              description: '读秒周期数'
            }
          }
        }
      } else if (cmd.id === 'time_left') {
        parameters = {
          type: 'object',
          required: ['color', 'time', 'stones'],
          properties: {
            color: {
              type: 'string',
              description: '颜色，B或W',
              enum: ['B', 'W']
            },
            time: {
              type: 'integer',
              description: '剩余时间（秒）'
            },
            stones: {
              type: 'integer',
              description: '剩余读秒次数'
            }
          }
        }
      } else if (cmd.id === 'fixed_handicap') {
        parameters = {
          type: 'object',
          required: ['n'],
          properties: {
            n: {
              type: 'integer',
              description: '让子数量（2-9）',
              minimum: 2,
              maximum: 9
            }
          }
        }
      } else if (cmd.id === 'place_free_handicap') {
        parameters = {
          type: 'object',
          required: ['n'],
          properties: {
            n: {
              type: 'integer',
              description: '让子数量（2-9）',
              minimum: 2,
              maximum: 9
            }
          }
        }
      } else if (cmd.id === 'set_free_handicap') {
        parameters = {
          type: 'object',
          required: ['vertices'],
          properties: {
            vertices: {
              type: 'array',
              description: '让子位置列表，如["A1", "T19"]',
              items: {
                type: 'string'
              }
            }
          }
        }
      } else if (
        cmd.id === 'lz-genmove_analyze' ||
        cmd.id === 'kata-genmove_analyze'
      ) {
        parameters = {
          type: 'object',
          required: ['color'],
          properties: {
            color: {
              type: 'string',
              description: '要生成的棋子颜色，必须是B(黑)或W(白)',
              enum: ['B', 'W']
            },
            visits: {
              type: 'integer',
              description: '分析访问量'
            }
          }
        }
      } else if (cmd.id === 'lz-analyze') {
        parameters = {
          type: 'object',
          properties: {
            visits: {
              type: 'integer',
              description: '分析访问量'
            }
          }
        }
      } else if (cmd.id === 'loadsgf') {
        parameters = {
          type: 'object',
          required: ['sgf'],
          properties: {
            sgf: {
              type: 'string',
              description: 'string filename - Name of an sgf file.'
            }
          }
        }
      } else if (cmd.id === 'clear_cache') {
        parameters = {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: '缓存类型（可选）'
            }
          }
        }
      } else if (cmd.id === 'kata-set-rule') {
        parameters = {
          type: 'object',
          required: ['rule', 'value'],
          properties: {
            rule: {
              type: 'string',
              description: '规则名称'
            },
            value: {
              type: ['string', 'number', 'boolean'],
              description: '规则值'
            }
          }
        }
      } else if (
        cmd.id === 'kata-search' ||
        cmd.id === 'kata-search_cancellable' ||
        cmd.id === 'kata-search_analyze' ||
        cmd.id === 'kata-search_analyze_cancellable' ||
        cmd.id === 'kata-search_debug'
      ) {
        parameters = {
          type: 'object',
          properties: {
            player: {
              type: 'string',
              description: '搜索方，B或W',
              enum: ['B', 'W']
            },
            visits: {
              type: 'integer',
              description: '搜索访问量'
            }
          }
        }
      } else if (cmd.id === 'genmove_debug') {
        parameters = {
          type: 'object',
          required: ['color'],
          properties: {
            color: {
              type: 'string',
              description: '要生成的棋子颜色，必须是B(黑)或W(白)',
              enum: ['B', 'W']
            }
          }
        }
      } else if (cmd.id === 'kata-time_settings') {
        parameters = {
          type: 'object',
          required: ['mainTime', 'byoYomiTime', 'byoYomiStones'],
          properties: {
            mainTime: {
              type: 'integer',
              description: '主时间（秒）'
            },
            byoYomiTime: {
              type: 'integer',
              description: '读秒时间（秒）'
            },
            byoYomiStones: {
              type: 'integer',
              description: '读秒次数'
            }
          }
        }
      } else if (cmd.id === 'kata-list_time_settings') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'kata-list-params') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'kata-get-models') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'kata-get-rules') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'final_score') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'final_status_list') {
        parameters = {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              description: '要查询的状态类型（如dead、alive等）'
            }
          }
        }
      } else if (cmd.id === 'cputime' || cmd.id === 'gomill-cpu_time') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'debug_moves') {
        parameters = {
          type: 'object',
          properties: {
            n: {
              type: 'integer',
              description: '调试的步数'
            }
          }
        }
      } else if (cmd.id === 'stop') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'showboard') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'printsgf') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'kata-debug-print-tc') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'undo') {
        parameters = {
          type: 'object',
          properties: {
            n: {
              type: 'integer',
              description: '撤销的步数，默认为1'
            }
          }
        }
      } else if (cmd.id === 'clear_board') {
        parameters = {
          type: 'object',
          properties: {}
        }
      } else if (cmd.id === 'get_komi') {
        parameters = {
          type: 'object',
          properties: {}
        }
      }

      const endpoint = {
        id: `gtp-${cmd.id}`,
        name: `GTP: ${cmd.name}`,
        description: cmd.description
      }

      if (parameters) {
        endpoint.parameters = parameters
      }

      endpoint.handler = async (params, gameContext) => {
        let commandArgs = params.args || []

        if (cmd.id === 'final_status_list' && params.status) {
          commandArgs = [params.status]
        } else if (cmd.id === 'debug_moves' && params.n !== undefined) {
          commandArgs = [params.n.toString()]
        } else if (cmd.id === 'undo' && params.n !== undefined) {
          commandArgs = [params.n.toString()]
        } else if (
          cmd.id === 'kata-search_analyze' ||
          cmd.id === 'kata-search_analyze_cancellable'
        ) {
          if (params.player) commandArgs.push(params.player)
          if (params.visits !== undefined)
            commandArgs.push(params.visits.toString())
        } else if (cmd.id === 'genmove_debug' && params.color) {
          commandArgs = [params.color]
        } else if (
          cmd.id === 'kata-time_settings' &&
          params.mainTime !== undefined &&
          params.byoYomiTime !== undefined &&
          params.byoYomiStones !== undefined
        ) {
          commandArgs = [
            params.mainTime.toString(),
            params.byoYomiTime.toString(),
            params.byoYomiStones.toString()
          ]
        }

        if (cmd.id === 'genmove' && params.color) {
          commandArgs = [params.color]
        } else if (cmd.id === 'play' && params.color && params.vertex) {
          commandArgs = [params.color, params.vertex]
        } else if (cmd.id === 'boardsize' && params.size !== undefined) {
          commandArgs = [params.size.toString()]
        } else if (
          cmd.id === 'rectangular_boardsize' &&
          params.width !== undefined &&
          params.height !== undefined
        ) {
          commandArgs = [params.width.toString(), params.height.toString()]
        } else if (cmd.id === 'komi' && params.value !== undefined) {
          commandArgs = [params.value.toString()]
        } else if (cmd.id === 'known_command' && params.command) {
          commandArgs = [params.command]
        } else if (cmd.id === 'kata-set-rules' && params.rules) {
          commandArgs = [params.rules]
        } else if (cmd.id === 'kata-analyze') {
          if (params.player) commandArgs.push(params.player)
          if (params.interval !== undefined)
            commandArgs.push(params.interval.toString())

          const boolParams = ['rootInfo', 'ownership', 'pvVisits']
          boolParams.forEach(param => {
            if (params[param] !== undefined) {
              commandArgs.push(param + '=' + (params[param] ? 'true' : 'false'))
            }
          })
        } else if (
          (cmd.id === 'kata-raw-nn' || cmd.id === 'kata-raw-human-nn') &&
          params.symmetry !== undefined
        ) {
          commandArgs = [params.symmetry.toString()]
        } else if (
          cmd.id === 'kata-benchmark' &&
          params.nVisits !== undefined
        ) {
          commandArgs = [params.nVisits.toString()]
        } else if (cmd.id === 'kata-get-param' && params.param) {
          commandArgs = [params.param]
        } else if (
          cmd.id === 'kata-set-param' &&
          params.param &&
          params.value !== undefined
        ) {
          commandArgs = [params.param, params.value.toString()]
        } else if (cmd.id === 'set_position' && params.position) {
          commandArgs = params.position.split(' ')
        }

        return await this.handleGTPCommand(cmd.name, commandArgs, gameContext)
      }

      this.registerEndpoint(endpoint)
    })
  }

  registerEndpoint(endpoint) {
    this.mcpEndpoints.push(endpoint)
  }

  vertexToGTP(vertex) {
    if (!vertex || vertex[0] < 0 || vertex[1] < 0) return 'pass'
    const alpha = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
    let x = alpha[vertex[0]]
    let y = 19 - vertex[1]
    return x + y
  }

  async handleKataGoAnalysis(params, gameContext) {
    let syncer = null
    if (
      sabaki &&
      sabaki.state &&
      sabaki.state.attachedEngineSyncers &&
      sabaki.state.attachedEngineSyncers.length > 0
    ) {
      syncer = sabaki.state.attachedEngineSyncers[0]
    } else {
      let engine = setting.get('gtp.engine')

      if (!engine || !engine.path) {
        let enginesList = setting.get('engines.list') || []
        if (enginesList.length > 0) {
          engine = enginesList[0]
        }
      }

      if (!engine || !engine.path) {
        return {error: '未配置KataGo引擎'}
      }

      syncer = new engineSyncer(engine)
      syncer.start()
    }

    await syncer.sync(
      gameContext.gameTrees[gameContext.gameIndex],
      gameContext.treePosition
    )

    let visits = 100
    let analyzeCommand = {
      name: 'lz-analyze',
      args: [visits.toString()]
    }

    return new Promise(resolve => {
      syncer.on('analysis-update', () => {
        if (syncer.analysis) {
          let result = {
            winrate: syncer.analysis.winrate,
            bestMove: syncer.analysis.variations[0]?.vertex
              ? this.vertexToGTP(syncer.analysis.variations[0].vertex)
              : null,
            variations: syncer.analysis.variations
              .slice(0, params.lookahead)
              .map(v => ({
                vertex: this.vertexToGTP(v.vertex),
                winrate: v.winrate,
                visits: v.visits,
                scoreLead: v.scoreLead
              }))
          }

          // 确保分析完成后重置engineSyncer的busy状态
          // 发送一个简单的命令来触发busy状态更新
          syncer.controller.sendCommand({name: 'protocol_version'}).then(() => {
            if (
              !sabaki ||
              !sabaki.state ||
              !sabaki.state.attachedEngineSyncers ||
              !sabaki.state.attachedEngineSyncers.find(s => s.id === syncer.id)
            ) {
              syncer.stop()
            }
            resolve({data: result})
          })
        }
      })

      syncer.queueCommand(analyzeCommand)

      setTimeout(() => {
        // 超时情况下也发送protocol_version命令来重置busy状态
        syncer.controller
          .sendCommand({name: 'protocol_version'})
          .then(() => {
            if (
              !sabaki ||
              !sabaki.state ||
              !sabaki.state.attachedEngineSyncers ||
              !sabaki.state.attachedEngineSyncers.find(s => s.id === syncer.id)
            ) {
              syncer.stop()
            }
            resolve({error: '分析超时'})
          })
          .catch(() => {
            // 如果命令发送失败，直接处理超时
            if (
              !sabaki ||
              !sabaki.state ||
              !sabaki.state.attachedEngineSyncers ||
              !sabaki.state.attachedEngineSyncers.find(s => s.id === syncer.id)
            ) {
              syncer.stop()
            }
            resolve({error: '分析超时'})
          })
      }, 100000)
    })
  }

  async handleGetEngineName(params, gameContext) {
    let engine = setting.get('gtp.engine')

    if (!engine || !engine.path) {
      let enginesList = setting.get('engines.list') || []
      if (enginesList.length > 0) {
        engine = enginesList[0]
      }
    }

    if (!engine || !engine.path) {
      return {data: {name: '未配置引擎'}}
    }

    let engineName = engine.name || '未知引擎'
    return {data: {name: engineName}}
  }

  async handleGetEngineCommands(params, gameContext) {
    let syncer = null
    let needStop = false

    if (
      sabaki &&
      sabaki.state &&
      sabaki.state.attachedEngineSyncers &&
      sabaki.state.attachedEngineSyncers.length > 0
    ) {
      syncer = sabaki.state.attachedEngineSyncers[0]
    } else {
      let engine = setting.get('gtp.engine')

      if (!engine || !engine.path) {
        let enginesList = setting.get('engines.list') || []
        if (enginesList.length > 0) {
          engine = enginesList[0]
        }
      }

      if (!engine || !engine.path) {
        return {error: '未配置引擎'}
      }

      syncer = new engineSyncer(engine)
      syncer.start()
      needStop = true
    }

    let response = await syncer.queueCommand({name: 'list_commands'})

    if (needStop) {
      await syncer.stop()
    }

    let commands = response.content
      .split('\n')
      .filter(
        line => line.trim() && !line.startsWith('=') && !line.startsWith('?')
      )
      .map(line => line.trim())

    return {data: {commands: commands}}
  }

  async handleKataGoScore(params, gameContext) {
    let syncer = null
    let needStop = false

    if (
      sabaki &&
      sabaki.state &&
      sabaki.state.attachedEngineSyncers &&
      sabaki.state.attachedEngineSyncers.length > 0
    ) {
      syncer = sabaki.state.attachedEngineSyncers[0]
    } else {
      let engine = setting.get('gtp.engine')

      if (!engine || !engine.path) {
        let enginesList = setting.get('engines.list') || []
        if (enginesList.length > 0) {
          engine = enginesList[0]
        }
      }

      if (!engine || !engine.path) {
        return {error: '未配置KataGo引擎'}
      }

      syncer = new engineSyncer(engine)
      syncer.start()
      needStop = true
    }

    await syncer.sync(
      gameContext.gameTrees[gameContext.gameIndex],
      gameContext.treePosition
    )

    let response = await syncer.queueCommand({name: 'final_score'})

    if (needStop) {
      await syncer.stop()
    }

    return {data: {score: response.content.trim()}}
  }

  async handleGTPCommand(command, args, gameContext) {
    if (command === 'genmove' && args.length < 1) {
      return {command, args, response: '? 缺少颜色参数', success: false}
    }
    if (command === 'play' && args.length < 2) {
      return {command, args, response: '? 缺少颜色或位置参数', success: false}
    }
    if (
      (command === 'boardsize' ||
        command === 'fixed_handicap' ||
        command === 'place_free_handicap' ||
        command === 'komi' ||
        command === 'known_command' ||
        command === 'kata-set-rules' ||
        command === 'kata-raw-nn' ||
        command === 'kata-benchmark' ||
        command === 'kata-get-param' ||
        command === 'kgs-rules') &&
      args.length < 1
    ) {
      return {command, args, response: '? 缺少必要参数', success: false}
    }
    if (
      (command === 'rectangular_boardsize' ||
        command === 'set_free_handicap' ||
        command === 'kata-set-param' ||
        command === 'time_settings' ||
        command === 'kgs-time_settings' ||
        command === 'time_left') &&
      args.length < 2
    ) {
      return {command, args, response: '? 缺少必要参数', success: false}
    }
    if (command === 'time_settings' && args.length < 3) {
      return {
        command,
        args,
        response: '? 缺少完整的时间设置参数',
        success: false
      }
    }
    if (command === 'kgs-time_settings' && args.length < 3) {
      return {
        command,
        args,
        response: '? 缺少完整的KGS时间设置参数',
        success: false
      }
    }
    if (
      command === 'lz-genmove_analyze' ||
      command === 'kata-genmove_analyze'
    ) {
      if (args.length < 1) {
        return {command, args, response: '? 缺少颜色参数', success: false}
      }
      if (!['B', 'W'].includes(args[0].toUpperCase())) {
        return {command, args, response: '? 颜色参数必须是B或W', success: false}
      }
    }
    if (command === 'loadsgf' && args.length < 1) {
      return {command, args, response: '? 缺少SGF内容', success: false}
    }
    if (command === 'kata-set-rule' && args.length < 2) {
      return {command, args, response: '? 缺少规则名称或值', success: false}
    }
    if (command === 'fixed_handicap' || command === 'place_free_handicap') {
      if (args.length > 0) {
        const n = parseInt(args[0])
        if (isNaN(n) || n < 2 || n > 9) {
          return {
            command,
            args,
            response: '? 让子数量必须在2-9之间',
            success: false
          }
        }
      }
    }
    if (command === 'play' && args && !['B', 'W'].includes(args[0])) {
      return {
        command,
        args,
        response: '? play命令的第一个参数必须是B或W',
        success: false
      }
    }

    let syncer = null
    let needStop = false

    if (
      sabaki &&
      sabaki.state &&
      sabaki.state.attachedEngineSyncers &&
      sabaki.state.attachedEngineSyncers.length > 0
    ) {
      syncer = sabaki.state.attachedEngineSyncers[0]
    } else {
      let engine = setting.get('gtp.engine')

      if (!engine || !engine.path) {
        let enginesList = setting.get('engines.list') || []
        if (enginesList.length > 0) {
          engine = enginesList[0]
        }
      }

      if (!engine || !engine.path) {
        return {error: '未配置引擎'}
      }

      syncer = new engineSyncer(engine)
      syncer.start()
      needStop = true
    }

    const needSync = [
      'genmove',
      'play',
      'undo',
      'final_score',
      'showboard',
      'final_status_list',
      'lz-analyze',
      'kata-analyze',
      'kata-search',
      'kata-genmove_analyze'
    ]
    if (needSync.includes(command)) {
      await syncer.sync(
        gameContext.gameTrees[gameContext.gameIndex],
        gameContext.treePosition
      )
    }

    let response = await syncer.queueCommand({name: command, args: args || []})

    if (needStop) {
      await syncer.stop()
    }

    return {
      data: {
        command: command,
        args: args || [],
        response: response.content.trim(),
        success: response.status === 0 || response.error == false
      }
    }
  }

  generateMCPMessage(endpointId, params) {
    let endpoint = this.mcpEndpoints.find(e => e.id === endpointId)
    if (!endpoint) {
      return {error: `未知的MCP端点: ${endpointId}`}
    }

    return {
      mcp: {
        tool: {
          name: endpoint.name,
          description: endpoint.description,
          parameters: params
        }
      }
    }
  }

  async handleMCPRequest(mcpRequest, gameContext) {
    // 检查MCP请求格式
    if (!mcpRequest.mcp || !mcpRequest.mcp.tool) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: '无效的MCP请求格式'
        }
      }
    }

    let toolName = mcpRequest.mcp.tool.name
    let endpoint = this.mcpEndpoints.find(e => e.name === toolName)

    // 检查工具是否存在
    if (!endpoint) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Method not found',
          data: `未找到工具: ${toolName}`
        }
      }
    }

    try {
      return await endpoint.handler(
        mcpRequest.mcp.tool.parameters || {},
        gameContext
      )
    } catch (error) {
      // 处理服务器错误
      console.error(`MCP处理错误 - 工具: ${toolName}`, error)
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: `服务器内部错误: ${error.message}`
        }
      }
    }
  }

  /**
   * 注册获取棋盘上下文端点
   */
  registerGetBoardContext() {
    this.registerEndpoint({
      id: 'get-board-context',
      name: '获取棋盘上下文',
      description: '获取当前棋局的棋盘上下文信息，包含所有着法历史',
      type: 'info_retrieval', // 更新为信息检索类型
      parameters: {
        type: 'object',
        properties: {
          includeFullHistory: {
            type: 'boolean',
            description: '是否包含完整的棋局历史',
            default: true
          }
        }
      },
      handler: this.handleGetBoardContext.bind(this)
    })
  }

  /**
   * 处理获取棋局元信息的请求
   */
  async handleGetGameMetadata(params, gameContext) {
    try {
      const {includeEmptyFields = false} = params || {}

      // 获取当前游戏树
      const tree =
        gameContext?.gameTrees?.[gameContext.gameIndex] ||
        sabaki?.state?.gameTrees?.[sabaki.state.gameIndex]
      if (!tree || !tree.root) {
        return {success: false, error: '没有找到当前棋局'}
      }

      const rootNode = tree.root
      const metadata = {}
      const fieldMapping = {
        GN: '赛事',
        PB: '黑方',
        PW: '白方',
        BR: '黑方等级',
        WR: '白方等级',
        KM: '贴目',
        RU: '规则',
        SZ: '棋盘大小',
        HA: '让子数',
        RE: '结果'
      }

      // 提取元信息
      Object.entries(fieldMapping).forEach(([key, label]) => {
        if (rootNode.data[key]) {
          metadata[key] = {
            label: label,
            value: rootNode.data[key]
          }
        } else if (includeEmptyFields) {
          metadata[key] = {
            label: label,
            value: null
          }
        }
      })

      return {
        success: true,
        data: {
          metadata: metadata,
          hasMetadata: Object.keys(metadata).length > 0,
          metadataCount: Object.keys(metadata).length
        }
      }
    } catch (error) {
      console.error('获取棋局元信息失败:', error)
      return {
        success: false,
        error: error.message || '获取棋局元信息失败'
      }
    }
  }

  /**
   * 处理获取棋局详细信息的请求
   */
  async handleGetGameInfo(params, gameContext) {
    try {
      const {format = 'text'} = params || {}

      // 获取当前游戏树
      const tree =
        gameContext?.gameTrees?.[gameContext.gameIndex] ||
        sabaki?.state?.gameTrees?.[sabaki.state.gameIndex]

      if (!tree || !tree.root || !tree.root.data) {
        return {
          success: false,
          error: '没有找到当前棋局或棋局数据'
        }
      }

      const rootNode = tree.root
      let gameInfo = ''
      let metaInfo = []

      // 提取棋局元信息
      if (rootNode.data.GN) metaInfo.push(`赛事: ${rootNode.data.GN}`)
      if (rootNode.data.PB) metaInfo.push(`黑方: ${rootNode.data.PB}`)
      if (rootNode.data.PW) metaInfo.push(`白方: ${rootNode.data.PW}`)
      if (rootNode.data.BR) metaInfo.push(`黑方等级: ${rootNode.data.BR}`)
      if (rootNode.data.WR) metaInfo.push(`白方等级: ${rootNode.data.WR}`)
      if (rootNode.data.KM) metaInfo.push(`贴目: ${rootNode.data.KM}`)
      if (rootNode.data.RU) metaInfo.push(`规则: ${rootNode.data.RU}`)
      if (rootNode.data.SZ) metaInfo.push(`棋盘大小: ${rootNode.data.SZ}`)
      if (rootNode.data.HA) metaInfo.push(`让子数: ${rootNode.data.HA}`)
      if (rootNode.data.RE) metaInfo.push(`结果: ${rootNode.data.RE}`)

      if (format === 'text') {
        // 返回格式化文本
        if (metaInfo.length > 0) {
          gameInfo = '棋局信息:\n' + metaInfo.join('\n')
        } else {
          gameInfo = '未找到棋局元信息'
        }

        return {
          success: true,
          content: gameInfo
        }
      } else {
        // 返回对象格式
        const metadata = {}
        const fieldMapping = {
          GN: '赛事',
          PB: '黑方',
          PW: '白方',
          BR: '黑方等级',
          WR: '白方等级',
          KM: '贴目',
          RU: '规则',
          SZ: '棋盘大小',
          HA: '让子数',
          RE: '结果'
        }

        Object.entries(fieldMapping).forEach(([key, label]) => {
          if (rootNode.data[key]) {
            metadata[key] = {
              label: label,
              value: rootNode.data[key]
            }
          }
        })

        return {
          success: true,
          data: {
            metadata: metadata,
            hasMetadata: Object.keys(metadata).length > 0,
            metadataCount: Object.keys(metadata).length
          }
        }
      }
    } catch (error) {
      console.error('获取棋局详细信息失败:', error)
      return {
        success: false,
        error: error.message || '获取棋局详细信息失败'
      }
    }
  }

  /**
   * 处理获取棋盘上下文的请求
   */
  async handleGetBoardContext(params, gameContext) {
    try {
      let {gameTrees, gameIndex, treePosition} = gameContext
      let tree = gameTrees[gameIndex]
      let currentNode = tree.get(treePosition)
      let moves = []
      let node = currentNode

      // 收集所有着法历史
      while (node) {
        if (node.data.B) moves.unshift(`B[${node.data.B.join('][')}]`)
        if (node.data.W) moves.unshift(`W[${node.data.W.join('][')}]`)
        node = tree.get(node.parentId)
      }

      // 构建boardContext字符串
      const boardContext = moves.join('\n')

      return {
        success: true,
        data: {
          boardContext: boardContext,
          moveCount: moves.length,
          currentNodeId: currentNode.id
        }
      }
    } catch (error) {
      console.error('获取棋盘上下文失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  getAvailableEndpoints() {
    return this.mcpEndpoints.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      parameters: e.parameters
    }))
  }
}

export default new MCPHelper()
