import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import engineSyncer from './enginesyncer.js'
import sabaki from './sabaki.js'

/**
 * MCP (Model Context Protocol) 助手模块，处理LLM与KataGo等工具的通信
 * 基于Anthropic的Model Context Protocol开放标准设计
 */
class MCPHelper {
  constructor() {
    this.mcpEndpoints = []
    this.registerDefaultEndpoints()
  }

  /**
   * 注册默认的MCP端点
   */
  registerDefaultEndpoints() {
    // 注册KataGo分析端点
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

    // 注册KataGo评分端点
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

    // 注册获取引擎名称端点
    this.registerEndpoint({
      id: 'get-engine-name',
      name: '获取引擎名称',
      description: '获取当前配置的AI引擎名称',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: this.handleGetEngineName.bind(this)
    })

    this.registerEndpoint({
      id: 'get-engine-commands',
      name: '获取引擎命令列表',
      description: '获取当前配置的AI引擎支持的命令列表',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: this.handleGetEngineCommands.bind(this)
    })

    // 注册GTP命令端点
    const gtpCommands = [
      {
        id: 'protocol_version',
        name: 'protocol_version',
        description: '获取GTP协议版本'
      },
      {id: 'name', name: 'name', description: '获取引擎名称'},
      {id: 'version', name: 'version', description: '获取引擎版本'},
      {
        id: 'known_command',
        name: 'known_command',
        description: '检查引擎是否支持指定命令'
      },
      {
        id: 'list_commands',
        name: 'list_commands',
        description: '列出引擎支持的所有命令'
      },
      {id: 'quit', name: 'quit', description: '退出引擎'},
      {id: 'boardsize', name: 'boardsize', description: '设置棋盘大小'},
      {
        id: 'rectangular_boardsize',
        name: 'rectangular_boardsize',
        description: '设置矩形棋盘大小'
      },
      {id: 'clear_board', name: 'clear_board', description: '清空棋盘'},
      {id: 'set_position', name: 'set_position', description: '设置棋盘位置'},
      {id: 'komi', name: 'komi', description: '设置贴目值'},
      {id: 'get_komi', name: 'get_komi', description: '获取当前贴目值'},
      {id: 'play', name: 'play', description: '在棋盘上落子'},
      {id: 'undo', name: 'undo', description: '撤销一步棋'},
      {
        id: 'kata-get-rules',
        name: 'kata-get-rules',
        description: '获取KataGo当前规则设置'
      },
      {
        id: 'kata-set-rule',
        name: 'kata-set-rule',
        description: '设置KataGo规则'
      },
      {
        id: 'kata-set-rules',
        name: 'kata-set-rules',
        description: '设置KataGo多规则'
      },
      {
        id: 'kata-get-models',
        name: 'kata-get-models',
        description: '获取可用的KataGo模型'
      },
      {
        id: 'kata-get-param',
        name: 'kata-get-param',
        description: '获取KataGo参数'
      },
      {
        id: 'kata-set-param',
        name: 'kata-set-param',
        description: '设置KataGo参数'
      },
      {
        id: 'kata-list-params',
        name: 'kata-list-params',
        description: '列出KataGo参数'
      },
      {id: 'kgs-rules', name: 'kgs-rules', description: '设置KGS规则'},
      {id: 'genmove', name: 'genmove', description: '生成一步棋'},
      {id: 'kata-search', name: 'kata-search', description: '执行KataGo搜索'},
      {
        id: 'kata-search_cancellable',
        name: 'kata-search_cancellable',
        description: '执行可取消的KataGo搜索'
      },
      {
        id: 'genmove_debug',
        name: 'genmove_debug',
        description: '生成一步棋（调试模式）'
      },
      {
        id: 'kata-search_debug',
        name: 'kata-search_debug',
        description: '执行KataGo搜索（调试模式）'
      },
      {id: 'clear_cache', name: 'clear_cache', description: '清除缓存'},
      {id: 'showboard', name: 'showboard', description: '显示当前棋盘状态'},
      {
        id: 'fixed_handicap',
        name: 'fixed_handicap',
        description: '设置固定让子'
      },
      {
        id: 'place_free_handicap',
        name: 'place_free_handicap',
        description: '设置自由让子'
      },
      {
        id: 'set_free_handicap',
        name: 'set_free_handicap',
        description: '设置自由让子位置'
      },
      {id: 'time_settings', name: 'time_settings', description: '设置时间控制'},
      {
        id: 'kgs-time_settings',
        name: 'kgs-time_settings',
        description: '设置KGS时间控制'
      },
      {id: 'time_left', name: 'time_left', description: '设置剩余时间'},
      {
        id: 'kata-list_time_settings',
        name: 'kata-list_time_settings',
        description: '列出KataGo时间设置'
      },
      {
        id: 'kata-time_settings',
        name: 'kata-time_settings',
        description: '设置KataGo时间控制'
      },
      {id: 'final_score', name: 'final_score', description: '计算最终得分'},
      {
        id: 'final_status_list',
        name: 'final_status_list',
        description: '列出最终状态'
      },
      {id: 'loadsgf', name: 'loadsgf', description: '加载SGF文件'},
      {id: 'printsgf', name: 'printsgf', description: '打印当前棋局为SGF'},
      {
        id: 'lz-genmove_analyze',
        name: 'lz-genmove_analyze',
        description: '生成一步棋并分析（Leela Zero兼容）'
      },
      {
        id: 'kata-genmove_analyze',
        name: 'kata-genmove_analyze',
        description: '生成一步棋并分析'
      },
      {
        id: 'kata-search_analyze',
        name: 'kata-search_analyze',
        description: '执行搜索并分析'
      },
      {
        id: 'kata-search_analyze_cancellable',
        name: 'kata-search_analyze_cancellable',
        description: '执行可取消的搜索并分析'
      },
      {
        id: 'lz-analyze',
        name: 'lz-analyze',
        description: '分析当前棋局（Leela Zero兼容）'
      },
      {id: 'kata-analyze', name: 'kata-analyze', description: '分析当前棋局'},
      {
        id: 'kata-raw-nn',
        name: 'kata-raw-nn',
        description: '获取原始神经网络输出'
      },
      {
        id: 'kata-raw-human-nn',
        name: 'kata-raw-human-nn',
        description: '获取人类友好的原始神经网络输出'
      },
      {id: 'cputime', name: 'cputime', description: '获取CPU时间'},
      {
        id: 'gomill-cpu_time',
        name: 'gomill-cpu_time',
        description: '获取CPU时间（gomill兼容）'
      },
      {
        id: 'kata-benchmark',
        name: 'kata-benchmark',
        description: '执行KataGo基准测试'
      },
      {
        id: 'kata-debug-print-tc',
        name: 'kata-debug-print-tc',
        description: '打印时间控制调试信息'
      },
      {id: 'debug_moves', name: 'debug_moves', description: '调试着法'},
      {id: 'stop', name: 'stop', description: '停止当前操作'}
    ]

    // 为每个GTP命令注册MCP端点
    gtpCommands.forEach(cmd => {
      // 定义不需要参数的命令列表
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

      // 对于不需要参数的命令，不设置parameters属性
      let parameters = null

      // 为需要参数的命令设置默认参数列表
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

      // 为需要特定参数的命令提供详细的参数说明
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
      } else if (cmd.id === 'kata-raw-nn' || cmd.id === 'kata-raw-human-nn') {
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
            moves: {
              type: 'array',
              description:
                '着法列表，格式为[颜色,位置,颜色,位置,...]，如["B","A1","W","B1"]',
              items: {
                type: 'string'
              },
              default: []
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
              description: 'SGF格式的棋谱内容'
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

      // 注册MCP端点，只有当parameters不为null时才包含该属性
      const endpoint = {
        id: `gtp-${cmd.id}`,
        name: `GTP: ${cmd.name}`,
        description: cmd.description
      }

      if (parameters) {
        endpoint.parameters = parameters
      }

      endpoint.handler = async (params, gameContext) => {
        // 根据不同命令类型构建args数组
        let commandArgs = params.args || []

        // 为新增的命令添加参数处理逻辑
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

          // 添加各种key-value参数
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
        }

        return await this.handleGTPCommand(cmd.name, commandArgs, gameContext)
      }

      // 注册端点
      this.registerEndpoint(endpoint)
    })
  }

  /**
   * 注册新的MCP端点
   * @param {Object} endpoint - 端点配置
   */
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

  /**
   * 处理KataGo分析请求
   * @param {Object} params - 请求参数
   * @param {Object} gameContext - 游戏上下文
   * @returns {Promise<Object>} 分析结果
   */
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

    let visits = params.visits || 50
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

          if (
            !sabaki ||
            !sabaki.state ||
            !sabaki.state.attachedEngineSyncers ||
            !sabaki.state.attachedEngineSyncers.find(s => s.id === syncer.id)
          ) {
            syncer.stop()
          }
          resolve({data: result})
        }
      })

      syncer.queueCommand(analyzeCommand)

      setTimeout(() => {
        if (
          !sabaki ||
          !sabaki.state ||
          !sabaki.state.attachedEngineSyncers ||
          !sabaki.state.attachedEngineSyncers.find(s => s.id === syncer.id)
        ) {
          syncer.stop()
        }
        resolve({error: '分析超时'})
      }, 10000)
    })
  }

  /**
   * 处理KataGo评分请求
   * @param {Object} params - 请求参数
   * @param {Object} gameContext - 游戏上下文
   * @returns {Promise<Object>} 评分结果
   */
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

  /**
   * 通用GTP命令处理函数
   * @param {string} command - GTP命令名称
   * @param {Array} args - 命令参数
   * @param {Object} gameContext - 游戏上下文
   * @returns {Promise<Object>} 命令执行结果
   */
  async handleGTPCommand(command, args, gameContext) {
    // 验证参数
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

    // 获取引擎实例
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

    // 对于需要同步棋盘状态的命令，先同步
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

    // 执行GTP命令
    let response = await syncer.queueCommand({name: command, args: args || []})

    // 处理完成后停止引擎（如果是我们启动的）
    if (needStop) {
      await syncer.stop()
    }

    // 返回命令执行结果
    return {
      data: {
        command: command,
        args: args || [],
        response: response.content.trim(),
        success: response.status === 0 || response.error == false
      }
    }
  }

  /**
   * 生成MCP格式的工具调用消息
   * @param {string} endpointId - 端点ID
   * @param {Object} params - 参数
   * @returns {Object} MCP格式消息
   */
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

  /**
   * 处理来自LLM的MCP请求
   * @param {Object} mcpRequest - MCP请求
   * @param {Object} gameContext - 游戏上下文
   * @returns {Promise<Object>} 处理结果
   */
  async handleMCPRequest(mcpRequest, gameContext) {
    if (!mcpRequest.mcp || !mcpRequest.mcp.tool) {
      return {error: '无效的MCP请求格式'}
    }

    let toolName = mcpRequest.mcp.tool.name
    let endpoint = this.mcpEndpoints.find(e => e.name === toolName)

    if (!endpoint) {
      return {error: `未找到工具: ${toolName}`}
    }

    return await endpoint.handler(
      mcpRequest.mcp.tool.parameters || {},
      gameContext
    )
  }

  /**
   * 获取可用的MCP端点列表
   * @returns {Array} 端点列表
   */
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
