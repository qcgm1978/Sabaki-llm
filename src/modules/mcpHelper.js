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

    return await endpoint.handler(mcpRequest.mcp.tool.parameters, gameContext)
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
