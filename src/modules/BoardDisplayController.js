import React, {useEffect} from 'react'

/**
 * 棋盘显示控制器组件
 * 负责将agentOrchestrator的棋盘显示状态同步到Goban组件
 */
export default class BoardDisplayController {
  constructor(sabaki) {
    this.sabaki = sabaki
    this.agentOrchestrator = sabaki.agentOrchestrator
    this.goban = null

    this._setupListeners()
  }

  /**
   * 设置监听器，监听agentOrchestrator的棋盘显示变化
   * @private
   */
  _setupListeners() {
    if (this.agentOrchestrator) {
      // 注册棋盘显示变化监听器
      this.agentOrchestrator.addStateListener({
        onBoardDisplayChange: this.handleBoardDisplayChange.bind(this)
      })
    }
  }

  /**
   * 设置Goban组件实例
   * @param {Object} goban - Goban组件实例
   */
  setGoban(goban) {
    this.goban = goban
  }

  /**
   * 处理棋盘显示状态变化
   * @param {Object} displayState - 棋盘显示状态
   */
  handleBoardDisplayChange(displayState) {
    if (!this.goban || !this.goban.props) return

    // 应用棋盘标记
    this._applyMarkers(displayState.markers)

    // 应用高亮
    this._applyHighlights(displayState.highlights)

    // 应用热力图
    this._applyHeatMap(displayState.heatMap)

    // 应用线条
    this._applyLines(displayState.lines)

    // 应用变化走法
    this._applyVariationMoves(
      displayState.variationMoves,
      displayState.variationSign,
      displayState.variationSibling
    )
  }

  /**
   * 应用棋盘标记
   * @private
   */
  _applyMarkers(markers) {
    const {goban} = this
    if (!goban) return

    // 创建标记映射，按照Goban组件期望的格式
    const markersByType = {}

    // 支持的标记类型
    const supportedTypes = ['label', 'triangle', 'square', 'circle', 'x']

    // 初始化每种标记类型的映射
    supportedTypes.forEach(type => {
      markersByType[type] = {}
    })

    // 填充标记数据
    Object.entries(markers).forEach(([key, marker]) => {
      const [x, y] = key.split(',').map(Number)

      if (marker.type && supportedTypes.includes(marker.type)) {
        if (marker.type === 'label' && marker.label) {
          // 对于label类型，使用标签文本作为值
          markersByType.label[`${x},${y}`] = marker.label
        } else {
          // 对于其他类型，使用1作为存在标记
          markersByType[marker.type][`${x},${y}`] = 1
        }
      }
    })

    // 更新Goban组件的标记状态
    if (goban.updateMarkers) {
      goban.updateMarkers(markersByType)
    } else if (goban.props.onMarkersChange) {
      goban.props.onMarkersChange(markersByType)
    }
  }

  /**
   * 应用高亮
   * @private
   */
  _applyHighlights(highlights) {
    const {goban} = this
    if (!goban) return

    // 转换高亮格式为Goban组件期望的格式
    const highlightsMap = {}
    highlights.forEach(([x, y]) => {
      highlightsMap[`${x},${y}`] = 1
    })

    // 更新Goban组件的高亮状态
    if (goban.updateHighlights) {
      goban.updateHighlights(highlightsMap)
    } else if (goban.props.onHighlightsChange) {
      goban.props.onHighlightsChange(highlightsMap)
    }
  }

  /**
   * 应用热力图
   * @private
   */
  _applyHeatMap(heatMap) {
    const {goban} = this
    if (!goban) return

    // 更新Goban组件的热力图状态
    if (goban.updateHeatMap) {
      goban.updateHeatMap(heatMap)
    } else if (goban.props.onHeatMapChange) {
      goban.props.onHeatMapChange(heatMap)
    }
  }

  /**
   * 应用线条
   * @private
   */
  _applyLines(lines) {
    const {goban} = this
    if (!goban) return

    // 更新Goban组件的线条状态
    if (goban.updateLines) {
      goban.updateLines(lines)
    } else if (goban.props.onLinesChange) {
      goban.props.onLinesChange(lines)
    }
  }

  /**
   * 应用变化走法
   * @private
   */
  _applyVariationMoves(moves, sign, sibling) {
    const {goban} = this
    if (!goban) return

    // 如果有变化走法，播放变化
    if (moves && moves.length > 0 && goban.playVariation) {
      goban.playVariation(moves, sign, sibling)
    } else if (!moves && goban.stopPlayingVariation) {
      // 如果没有变化走法，停止播放变化
      goban.stopPlayingVariation()
    }
  }

  /**
   * 销毁控制器，清理监听器
   */
  destroy() {
    // 清理监听器等资源
    this.agentOrchestrator = null
    this.goban = null
  }
}
