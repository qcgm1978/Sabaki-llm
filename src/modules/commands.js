export default [
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
