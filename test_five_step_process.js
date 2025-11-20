// 五步问题解决流程测试脚本
// 这个脚本用于测试AgentOrchestrator中的五步问题解决流程功能

const {AgentOrchestrator} = require('./src/modules/agentOrchestrator')

// 模拟AI助手，用于测试
global.ai = {
  sendLLMMessage: async (prompt, context) => {
    console.log('\n--- 模拟LLM调用 ---')
    console.log(`提示长度: ${prompt.length} 字符`)

    // 根据提示内容返回模拟响应
    if (prompt.includes('分解为五步问题解决流程')) {
      return {
        steps: [
          {
            id: 'task_clarification',
            name: '明确任务',
            description: '理解和澄清用户请求',
            objectives: [
              '分析用户的核心需求',
              '识别问题的边界和范围',
              '澄清任何可能的歧义或假设',
              '定义成功标准'
            ],
            expectedOutput: '对任务的清晰理解和成功标准'
          },
          {
            id: 'environment_perception',
            name: '感知环境',
            description: '收集相关信息和上下文',
            objectives: [
              '分析当前棋盘状态',
              '识别相关的上下文信息',
              '收集解决问题所需的信息'
            ],
            expectedOutput: '完整的环境分析报告'
          },
          {
            id: 'planning',
            name: '思考规划',
            description: '制定解决方案和执行计划',
            objectives: [
              '提出解决思路',
              '设计具体的执行步骤',
              '评估可能的风险'
            ],
            expectedOutput: '详细的行动计划和执行步骤'
          },
          {
            id: 'execution',
            name: '执行行动',
            description: '按照计划执行具体操作',
            objectives: [
              '执行计划中的关键操作',
              '应用适当的工具和方法',
              '记录执行过程和结果'
            ],
            expectedOutput: '操作执行结果和关键数据'
          },
          {
            id: 'observation',
            name: '观察迭代',
            description: '评估结果并根据需要调整',
            objectives: ['评估执行结果', '识别成功和不足之处', '提供改进建议'],
            expectedOutput: '最终评估和总结报告'
          }
        ]
      }
    }

    if (prompt.includes('明确任务')) {
      return {
        summary: '用户需要分析棋局并提供最佳下一步建议',
        details:
          '详细分析了用户的核心需求，用户希望获得关于当前棋局的专业分析和下一步走法建议',
        ambiguities: '无明显歧义',
        successCriteria: '提供准确的棋局分析和有效的下一步建议'
      }
    }

    if (prompt.includes('感知环境')) {
      return {
        summary: '已获取当前棋盘状态和相关上下文',
        details: '分析了当前棋盘的布局、棋子分布和可能的战略要点',
        relevantInformation: ['棋盘布局数据', '当前回合信息', '历史走法记录'],
        informationGaps: '无明显信息缺口'
      }
    }

    if (prompt.includes('思考规划')) {
      return {
        summary: '制定了三步行动计划来分析棋局',
        details: '基于任务和环境分析，提出了系统性的棋局分析方法',
        executionSteps: [
          '分析棋盘上的关键区域',
          '评估当前形势优劣',
          '计算最佳走法选择'
        ],
        potentialRisks: '可能存在计算复杂度高的情况'
      }
    }

    if (prompt.includes('执行行动')) {
      return {
        summary: '已执行棋局分析的关键操作',
        details: '完成了所有计划的执行步骤',
        executedActions: ['关键区域分析', '形势评估', '最佳走法计算'],
        results: '分析结果显示黑方有优势，建议在左上角落子'
      }
    }

    if (prompt.includes('观察迭代')) {
      return {
        summary: '评估显示分析结果符合预期目标',
        details: '详细评估了整个问题解决过程',
        achievements: ['完成了全面的棋局分析', '提供了明确的下一步建议'],
        improvements: '可以考虑增加更多变招分析',
        finalConclusion: '五步问题解决流程成功应用于棋局分析任务'
      }
    }

    // 默认响应
    return '测试响应: 这是一个模拟的LLM响应'
  }
}

// 模拟AGENT_STATES常量
global.AGENT_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  ACTING: 'acting',
  OBSERVING: 'observing',
  ERROR: 'error'
}

// 模拟ERROR_TYPES常量
global.ERROR_TYPES = {
  LLM_ERROR: 'llm_error',
  TOOL_ERROR: 'tool_error',
  TIMEOUT_ERROR: 'timeout_error'
}

async function runTest() {
  console.log('开始测试五步问题解决流程...')

  const orchestrator = new AgentOrchestrator()

  // 测试1: 启用人机协作并生成流程计划
  console.log('\n测试1: 启用人机协作并生成流程计划')
  orchestrator.setHumanCollaborationEnabled(true)

  const gameContext = {
    gameTrees: [],
    gameIndex: 0,
    treePosition: []
  }

  try {
    // 生成五步流程计划
    const processPlanResult = await orchestrator.runWithFiveStepProcess(
      '分析当前棋局并提供最佳下一步建议',
      gameContext
    )

    console.log('\n流程计划生成结果:')
    console.log('- 需要用户确认:', processPlanResult.requiresHumanConfirmation)
    console.log('- 流程步骤数量:', processPlanResult.processPlan?.length || 0)
    console.log(
      '- 格式化输出预览:',
      processPlanResult.content.substring(0, 100) + '...'
    )

    // 测试2: 执行各个步骤
    console.log('\n测试2: 执行五步流程的各个步骤')

    const processContext = orchestrator.getFiveStepProcessState().processContext
    if (!processContext) {
      console.error('无法获取流程上下文')
      return
    }

    // 依次执行每个步骤
    for (let i = 0; i < 5; i++) {
      console.log(`\n执行步骤 ${i + 1}: ${processContext.stepPlan[i].name}`)
      const stepResult = await orchestrator.executeProcessStep(
        i,
        processContext
      )

      if (stepResult.error) {
        console.error(`步骤执行失败: ${stepResult.error}`)
      } else {
        console.log(`步骤 ${i + 1} 执行成功`)
        console.log(`- 摘要: ${stepResult.content.substring(0, 100)}...`)
        console.log(`- 是否最后一步: ${stepResult.isLastStep}`)
      }
    }

    // 测试3: 重置流程
    console.log('\n测试3: 重置五步流程')
    orchestrator.resetFiveStepProcess()
    const resetState = orchestrator.getFiveStepProcessState()
    console.log(
      '流程重置后状态:',
      !resetState.isRunning && !resetState.currentStep
    )

    console.log('\n🎉 所有测试完成！')
  } catch (error) {
    console.error('测试过程中发生错误:', error)
  }
}

// 运行测试
runTest().catch(console.error)
