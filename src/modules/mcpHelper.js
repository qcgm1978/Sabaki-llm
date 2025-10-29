import * as remote from '@electron/remote'
const setting = remote.require('./setting')
import engineSyncer from './enginesyncer.js'

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
  }

  /**
   * 注册新的MCP端点
   * @param {Object} endpoint - 端点配置
   */
  registerEndpoint(endpoint) {
    this.mcpEndpoints.push(endpoint)
  }

  /**
   * 处理KataGo分析请求
   * @param {Object} params - 请求参数
   * @param {Object} gameContext - 游戏上下文
   * @returns {Promise<Object>} 分析结果
   */
  async handleKataGoAnalysis(params, gameContext) {
    try {
      // 获取当前引擎，优先使用gtp.engine，如果不存在则尝试从engines.list获取第一个引擎
      let engine = setting.get('gtp.engine')

      // 如果gtp.engine不存在或无效，尝试从engines.list获取
      if (!engine || !engine.path) {
        let enginesList = setting.get('engines.list') || []
        if (enginesList.length > 0) {
          engine = enginesList[0]
        }
      }

      if (!engine || !engine.path) {
        return {error: '未配置KataGo引擎'}
      }

      // 创建引擎同步器
      // todo "_enginesyncer_js__WEBPACK_IMPORTED_MODULE_1__.default.EngineSyncer is not a constructor"
      // maybe 封装
      /*
      name
version
known_command
list_commands
quit
boardsize
rectangular_boardsize
clear_board
set_position
komi
get_komi
play
undo
kata-get-rules
kata-set-rule
kata-set-rules
kata-get-models
kata-get-param
kata-set-param
kata-list-params
kgs-rules
genmove
kata-search
kata-search_cancellable
genmove_debug
kata-search_debug
clear_cache
showboard
fixed_handicap
place_free_handicap
set_free_handicap
time_settings
kgs-time_settings
time_left
kata-list_time_settings
kata-time_settings
final_score
final_status_list
loadsgf
printsgf
lz-genmove_analyze
kata-genmove_analyze
kata-search_analyze
kata-search_analyze_cancellable
lz-analyze
kata-analyze
kata-raw-nn
kata-raw-human-nn
cputime
gomill-cpu_time
kata-benchmark
kata-debug-print-tc
debug_moves
stop
*/
      let syncer = new engineSyncer.EngineSyncer(engine)

      // 启动引擎
      syncer.start()

      // 同步当前棋局状态
      await syncer.sync(
        gameContext.gameTrees[gameContext.gameIndex],
        gameContext.treePosition
      )

      // 发送分析命令
      let analyzeCommand = {
        name: 'lz-analyze',
        args: [params.visits.toString()]
      }

      // 等待分析结果
      return new Promise(resolve => {
        syncer.on('analysis-update', () => {
          if (syncer.analysis) {
            // 格式化分析结果
            let result = {
              winrate: syncer.analysis.winrate,
              bestMove: syncer.analysis.variations[0]?.vertex,
              variations: syncer.analysis.variations
                .slice(0, params.lookahead)
                .map(v => ({
                  vertex: v.vertex,
                  winrate: v.winrate,
                  visits: v.visits,
                  scoreLead: v.scoreLead
                }))
            }

            // 停止引擎
            syncer.stop()
            resolve({data: result})
          }
        })

        // 发送命令
        syncer.queueCommand(analyzeCommand)

        // 超时处理
        setTimeout(() => {
          syncer.stop()
          resolve({error: '分析超时'})
        }, 10000)
      })
    } catch (err) {
      return {error: err.message}
    }
  }

  /**
   * 处理KataGo评分请求
   * @param {Object} params - 请求参数
   * @param {Object} gameContext - 游戏上下文
   * @returns {Promise<Object>} 评分结果
   */
  async handleKataGoScore(params, gameContext) {
    try {
      // 获取当前引擎，优先使用gtp.engine，如果不存在则尝试从engines.list获取第一个引擎
      let engine = setting.get('gtp.engine')

      // 如果gtp.engine不存在或无效，尝试从engines.list获取
      if (!engine || !engine.path) {
        let enginesList = setting.get('engines.list') || []
        if (enginesList.length > 0) {
          engine = enginesList[0]
        }
      }

      if (!engine || !engine.path) {
        return {error: '未配置KataGo引擎'}
      }

      // 创建引擎同步器
      let syncer = new engineSyncer.EngineSyncer(engine)

      // 启动引擎
      syncer.start()

      // 同步当前棋局状态
      await syncer.sync(
        gameContext.gameTrees[gameContext.gameIndex],
        gameContext.treePosition
      )

      // 发送评分命令
      let response = await syncer.queueCommand({name: 'final_score'})

      // 停止引擎
      await syncer.stop()

      return {data: {score: response.content.trim()}}
    } catch (err) {
      return {error: err.message}
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
