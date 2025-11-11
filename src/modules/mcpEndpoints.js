import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import engineSyncer from './enginesyncer.js'
import sabaki from './sabaki.js'
import commands from './commands.js'

class MCPEndpoints {
  constructor() {
    this.endpoints = []
    this.registerDefaultEndpoints()
  }

  /**
   * 注册新的MCP端点
   */
  registerEndpoint(endpoint) {
    this.endpoints.push(endpoint)
  }

  /**
   * 注册默认的MCP端点
   */
  registerDefaultEndpoints() {
    // 注册KataGo分析端点
    this.registerKataGoAnalysis()

    // 注册KataGo评分端点
    this.registerKataGoScore()

    // 注册引擎信息端点
    this.registerEngineInfoEndpoints()

    // 注册GTP命令端点
    this.registerGTPCommandEndpoints()
  }

  /**
   * 注册KataGo分析端点
   */
  registerKataGoAnalysis() {
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
  }

  /**
   * 注册KataGo评分端点
   */
  registerKataGoScore() {
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
  }

  /**
   * 注册引擎信息相关端点
   */
  registerEngineInfoEndpoints() {
    this.registerEndpoint({
      id: 'engine-info-name',
      name: '获取引擎名称',
      description: '获取当前配置的引擎名称',
      parameters: {},
      handler: this.handleGetEngineName.bind(this)
    })

    this.registerEndpoint({
      id: 'engine-info-commands',
      name: '获取引擎命令',
      description: '获取引擎支持的所有GTP命令',
      parameters: {},
      handler: this.handleGetEngineCommands.bind(this)
    })
  }

  /**
   * 注册所有GTP命令端点
   */
  registerGTPCommandEndpoints() {
    commands.forEach(cmd => this.registerGTPCommandEndpoint(cmd))
  }

  /**
   * 注册单个GTP命令端点
   */
  registerGTPCommandEndpoint(cmd) {
    const endpoint = {
      id: `gtp-${cmd.id}`,
      name: `GTP: ${cmd.name}`,
      description: cmd.description
    }

    // 根据命令类型设置参数
    endpoint.parameters = this.getGTPCommandParameters(cmd.id)

    // 设置处理器
    endpoint.handler = async (params, gameContext) => {
      // 准备命令参数
      const commandArgs = this.prepareGTPCommandArgs(cmd.id, params)
      // 执行GTP命令
      return await this.handleGTPCommand(cmd.name, commandArgs, gameContext)
    }

    this.registerEndpoint(endpoint)
  }

  /**
   * 获取GTP命令的参数定义
   */
  getGTPCommandParameters(commandId) {
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

    if (noParamsCommands.includes(commandId)) {
      return null
    }

    // 默认参数结构
    let parameters = {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          description: '命令参数列表',
          items: {type: 'string'},
          default: []
        }
      }
    }

    // 特定命令的参数定义
    switch (commandId) {
      case 'genmove':
        return {
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
      case 'play':
        return {
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
      // 可以根据需要添加更多特定命令的参数定义
      default:
        return parameters
    }
  }

  /**
   * 准备GTP命令参数
   */
  prepareGTPCommandArgs(commandId, params) {
    let commandArgs = params.args || []

    // 根据命令类型处理参数
    if (commandId === 'genmove' && params.color) {
      commandArgs = [params.color]
    } else if (commandId === 'play' && params.color && params.vertex) {
      commandArgs = [params.color, params.vertex]
    }
    // 可以根据需要添加更多特定命令的参数处理

    return commandArgs
  }

  /**
   * 将顶点坐标转换为GTP格式
   */
  vertexToGTP(vertex) {
    if (!vertex || vertex[0] < 0 || vertex[1] < 0) return 'pass'
    const alpha = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
    let x = alpha[vertex[0]]
    let y = 19 - vertex[1]
    return x + y
  }

  /**
   * 获取或创建引擎同步器
   */
  async getOrCreateEngineSyncer() {
    // 检查是否已有连接的引擎
    if (
      sabaki &&
      sabaki.state &&
      sabaki.state.attachedEngineSyncers &&
      sabaki.state.attachedEngineSyncers.length > 0
    ) {
      return {syncer: sabaki.state.attachedEngineSyncers[0], needStop: false}
    }

    // 获取引擎配置
    let engine = setting.get('gtp.engine')
    if (!engine || !engine.path) {
      const enginesList = setting.get('engines.list') || []
      if (enginesList.length > 0) {
        engine = enginesList[0]
      }
    }

    if (!engine || !engine.path) {
      throw new Error('未配置引擎')
    }

    // 创建并启动新的引擎同步器
    const syncer = new engineSyncer(engine)
    await syncer.start()
    return {syncer, needStop: true}
  }

  /**
   * 处理KataGo分析请求
   */
  async handleKataGoAnalysis(params, gameContext) {
    try {
      const {syncer, needStop} = await this.getOrCreateEngineSyncer()

      // 同步当前棋局状态
      await syncer.sync(
        gameContext.gameTrees[gameContext.gameIndex],
        gameContext.treePosition
      )

      // 设置分析参数
      const visits = params.visits || 100
      const lookahead = params.lookahead || 5

      // 执行分析命令
      syncer.queueCommand({name: 'lz-analyze', args: [visits.toString()]})

      // 等待分析结果
      return await new Promise(resolve => {
        const handleAnalysisUpdate = () => {
          if (syncer.analysis) {
            const result = {
              winrate: syncer.analysis.winrate,
              bestMove: syncer.analysis.variations[0]?.vertex
                ? this.vertexToGTP(syncer.analysis.variations[0].vertex)
                : null,
              variations: syncer.analysis.variations
                .slice(0, lookahead)
                .map(v => ({
                  vertex: this.vertexToGTP(v.vertex),
                  winrate: v.winrate,
                  visits: v.visits,
                  scoreLead: v.scoreLead
                }))
            }

            // 清理并返回结果
            syncer.off('analysis-update', handleAnalysisUpdate)
            if (needStop) {
              syncer.stop()
            }
            resolve({data: result})
          }
        }

        syncer.on('analysis-update', handleAnalysisUpdate)

        // 设置超时
        setTimeout(() => {
          syncer.off('analysis-update', handleAnalysisUpdate)
          if (needStop) {
            syncer.stop()
          }
          resolve({error: '分析超时'})
        }, 100000)
      })
    } catch (error) {
      return {error: error.message}
    }
  }

  /**
   * 处理KataGo评分请求
   */
  async handleKataGoScore(params, gameContext) {
    try {
      const {syncer, needStop} = await this.getOrCreateEngineSyncer()

      // 同步当前棋局状态
      await syncer.sync(
        gameContext.gameTrees[gameContext.gameIndex],
        gameContext.treePosition
      )

      // 执行评分命令
      const response = await syncer.queueCommand({name: 'final_score'})

      // 清理资源
      if (needStop) {
        await syncer.stop()
      }

      return {data: {score: response.content.trim()}}
    } catch (error) {
      return {error: error.message}
    }
  }

  /**
   * 处理获取引擎名称请求
   */
  async handleGetEngineName(params, gameContext) {
    let engine = setting.get('gtp.engine')

    if (!engine || !engine.path) {
      const enginesList = setting.get('engines.list') || []
      if (enginesList.length > 0) {
        engine = enginesList[0]
      }
    }

    if (!engine || !engine.path) {
      return {data: {name: '未配置引擎'}}
    }

    const engineName = engine.name || '未知引擎'
    return {data: {name: engineName}}
  }

  /**
   * 处理获取引擎命令列表请求
   */
  async handleGetEngineCommands(params, gameContext) {
    try {
      const {syncer, needStop} = await this.getOrCreateEngineSyncer()

      // 获取命令列表
      const response = await syncer.queueCommand({name: 'list_commands'})

      // 清理资源
      if (needStop) {
        await syncer.stop()
      }

      // 解析命令列表
      const commands = response.content
        .split('\n')
        .filter(
          line => line.trim() && !line.startsWith('=') && !line.startsWith('?')
        )
        .map(line => line.trim())

      return {data: {commands}}
    } catch (error) {
      return {error: error.message}
    }
  }

  /**
   * 处理GTP命令
   */
  async handleGTPCommand(command, args, gameContext) {
    try {
      // 参数验证
      this.validateGTPCommand(command, args)

      const {syncer, needStop} = await this.getOrCreateEngineSyncer()

      // 对于需要同步棋局状态的命令进行同步
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

      // 执行命令
      const response = await syncer.queueCommand({
        name: command,
        args: args || []
      })

      // 清理资源
      if (needStop) {
        await syncer.stop()
      }

      return {
        data: {
          command,
          args: args || [],
          response: response.content.trim(),
          success: response.status === 0 || response.error === false
        }
      }
    } catch (error) {
      return {error: error.message}
    }
  }

  /**
   * 验证GTP命令参数
   */
  validateGTPCommand(command, args) {
    // 基本参数验证
    if (command === 'genmove' && args.length < 1) {
      throw new Error('缺少颜色参数')
    }
    if (command === 'play' && args.length < 2) {
      throw new Error('缺少颜色或位置参数')
    }

    // 颜色参数验证
    if (
      (command === 'genmove' || command === 'play') &&
      args.length > 0 &&
      !['B', 'W'].includes(args[0].toUpperCase())
    ) {
      throw new Error('颜色参数必须是B或W')
    }

    // 让子参数验证
    if (
      (command === 'fixed_handicap' || command === 'place_free_handicap') &&
      args.length > 0
    ) {
      const n = parseInt(args[0])
      if (isNaN(n) || n < 2 || n > 9) {
        throw new Error('让子数量必须在2-9之间')
      }
    }
  }

  /**
   * 生成MCP消息
   */
  generateMCPMessage(endpointId, params) {
    const endpoint = this.endpoints.find(e => e.id === endpointId)
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
   * 处理MCP请求
   */
  async handleMCPRequest(mcpRequest, gameContext) {
    if (!mcpRequest.mcp || !mcpRequest.mcp.tool) {
      return {error: '无效的MCP请求格式'}
    }

    const toolName = mcpRequest.mcp.tool.name
    const endpoint = this.endpoints.find(e => e.name === toolName)

    if (!endpoint) {
      return {error: `未找到工具: ${toolName}`}
    }

    try {
      return await endpoint.handler(
        mcpRequest.mcp.tool.parameters || {},
        gameContext
      )
    } catch (error) {
      return {error: error.message}
    }
  }

  /**
   * 获取所有可用的端点
   */
  getAvailableEndpoints() {
    return this.endpoints.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      parameters: e.parameters
    }))
  }

  /**
   * 注册自定义端点
   */
  registerCustomEndpoint(id, name, description, parameters, handler) {
    this.registerEndpoint({
      id,
      name,
      description,
      parameters,
      handler
    })
  }

  /**
   * 根据ID查找端点
   */
  findEndpointById(id) {
    return this.endpoints.find(e => e.id === id)
  }

  /**
   * 根据名称查找端点
   */
  findEndpointByName(name) {
    return this.endpoints.find(e => e.name === name)
  }

  /**
   * 过滤端点
   */
  filterEndpoints(filterFn) {
    return this.endpoints.filter(filterFn)
  }
}

// 导出单例实例
export default new MCPEndpoints()
