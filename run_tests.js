const fs = require('fs')
const path = require('path')
const {execSync} = require('child_process')

// 测试目录路径
const testDir = path.join(__dirname, 'test')

// 获取test目录下所有的.js测试文件
function getTestFiles(dir) {
  const testFiles = []
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stats = fs.statSync(filePath)

    if (stats.isFile() && file.endsWith('.js') && !file.endsWith('Tests.js')) {
      testFiles.push(filePath)
    }
  })

  return testFiles
}

// 运行单个测试文件
function runTestFile(filePath) {
  console.log(`\n=== 运行测试文件: ${path.basename(filePath)} ===`)

  try {
    const output = execSync(`node ${filePath}`, {encoding: 'utf8'})
    console.log('✅ 测试通过')
    console.log(output)
    return {passed: true, file: filePath, output}
  } catch (error) {
    console.log('❌ 测试失败')
    console.error(error.stdout || error.message)
    return {passed: false, file: filePath, error: error.stdout || error.message}
  }
}

// 主函数
function main() {
  console.log('=== 开始运行所有测试文件 ===')
  console.log(`测试目录: ${testDir}\n`)

  const testFiles = getTestFiles(testDir)
  const results = []
  let passedCount = 0
  let failedCount = 0

  if (testFiles.length === 0) {
    console.log('没有找到测试文件！')
    return
  }

  console.log(`找到 ${testFiles.length} 个测试文件:\n`)
  testFiles.forEach(file => console.log(`- ${path.basename(file)}`))
  console.log('')

  // 运行每个测试文件
  for (const file of testFiles) {
    const result = runTestFile(file)
    results.push(result)
    if (result.passed) passedCount++
    else failedCount++
  }

  // 输出测试汇总
  console.log('\n=== 测试运行汇总 ===')
  console.log(`总测试文件数: ${testFiles.length}`)
  console.log(`通过: ${passedCount}`)
  console.log(`失败: ${failedCount}`)

  if (failedCount > 0) {
    console.log('\n失败的测试文件:')
    results.forEach(result => {
      if (!result.passed) {
        console.log(`- ${path.basename(result.file)}`)
      }
    })
  }

  console.log('\n=== 测试运行完成 ===')
}

// 执行主函数
main()
