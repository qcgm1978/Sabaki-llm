const os = require('os')
const path = require('path')
const fs = require('fs')
const {version} = require('../package.json')

function printSetOutputs(outputs) {
  const githubOutput = process.env.GITHUB_OUTPUT
  if (githubOutput) {
    // 使用新的环境文件方式
    for (let [name, value] of Object.entries(outputs)) {
      fs.appendFileSync(githubOutput, `${name}=${value}\n`)
    }
  } else {
    // 兼容旧版本，本地运行时使用console输出
    for (let [name, value] of Object.entries(outputs)) {
      console.log(`::set-output name=${name}::${value}`)
    }
  }
}

printSetOutputs({
  version,
  tag: (process.env.GITHUB_REF || '').replace('refs/tags/', ''),
  ci: path.resolve(process.cwd(), './ci'),
  distcommand: {
    win32: 'dist:win',
    linux: 'dist:linux',
    darwin: 'dist:macos'
  }[os.platform()]
})
