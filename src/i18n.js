const nativeRequire = eval('require')

const {ipcMain} = require('electron')
var remote = null
try {
  remote = require('@electron/remote')
} catch (e) {}
const {readFileSync} = require('fs')
const path = require('path')
const {load: dolmLoad, getKey: dolmGetKey} = require('dolm')
const languages = require('@sabaki/i18n')

const isElectron = process.versions.electron != null
const isRenderer = isElectron && remote != null
const fs = require('fs')
const app = isElectron
  ? isRenderer
    ? remote.app
    : require('electron').app
  : null

const mainI18n = isRenderer ? remote.require('./i18n') : null
const setting = isRenderer
  ? remote.require('./setting')
  : isElectron
  ? nativeRequire('./setting')
  : null

function getKey(input, params = {}) {
  let key = dolmGetKey(input, params)
  return key.replace(/&(?=\w)/g, '')
}

const dolm = dolmLoad({}, getKey)

// 获取当前应用语言，默认使用系统语言
let getSystemLanguage = () => {
  if (app) {
    return app.getLocale()
  }
  return navigator ? navigator.language : 'en'
}

let appLang = setting == null ? getSystemLanguage() : setting.get('app.lang')
let langFilePath = setting == null ? null : setting.get('app.lang_file')

exports.getKey = getKey
exports.t = dolm.t
exports.context = dolm.context

exports.formatNumber = function(num) {
  return new Intl.NumberFormat(appLang).format(num)
}

exports.formatMonth = function(month) {
  let date = new Date()
  date.setMonth(month)
  return date.toLocaleString(appLang, {month: 'long'})
}

exports.formatWeekday = function(weekday) {
  let date = new Date(2020, 2, 1 + (weekday % 7))
  return date.toLocaleString(appLang, {weekday: 'long'})
}

exports.formatWeekdayShort = function(weekday) {
  let date = new Date(2020, 2, 1 + (weekday % 7))
  return date.toLocaleString(appLang, {weekday: 'short'})
}

function loadStrings(strings) {
  dolm.load(strings)

  if (isElectron && !isRenderer) {
    ipcMain.emit('build-menu')
  }
}

exports.loadFile = function(filename) {
  if (isRenderer) {
    mainI18n.loadFile(filename)
  }

  try {
    loadStrings(
      Function(`
        "use strict"

        let exports = {}
        let module = {exports}

        ;(() => (${readFileSync(filename, 'utf8')}))()

        return module.exports
      `)()
    )

    // 保存当前加载的语言文件路径到设置中，以便重启后自动加载
    if (setting != null) {
      setting.set('app.lang_file', filename)
    }
  } catch (err) {
    loadStrings({})
  }
}

exports.loadLang = function(lang) {
  appLang = lang

  exports.loadFile(languages[lang].filename)
}

exports.getLanguages = function() {
  return languages
}

// 获取正确的i18n目录路径，兼容开发和打包环境
function getI18nDirectory() {
  // 在Electron环境中
  if (isElectron && app) {
    // 开发环境
    if (process.env.NODE_ENV === 'development') {
      return path.join(__dirname, '..', 'i18n')
    }
    // 生产环境 - 使用应用目录
    return path.join(app.getAppPath(), 'i18n')
  }
  // 默认路径
  return path.join(__dirname, '..', 'i18n')
}

// 扫描i18n文件夹，查找并加载匹配的语言文件
function scanAndLoadLanguageFile() {
  const i18nDir = getI18nDirectory()
  let foundLanguageFile = false

  // 检查i18n目录是否存在
  if (fs.existsSync(i18nDir)) {
    const files = fs.readdirSync(i18nDir)
    const langCode = appLang.split('-')[0] // 获取语言代码（如zh-CN -> zh）

    // 优先级：精确匹配（如zh-CN） > 语言代码匹配（如zh） > en（英文）
    const preferredPatterns = [
      `${appLang}.i18n.js`,
      `${langCode}.i18n.js`,
      'en.i18n.js'
    ]

    // 尝试按优先级加载匹配的语言文件
    for (const pattern of preferredPatterns) {
      const matchingFile = files.find(file => file === pattern)
      if (matchingFile) {
        const filePath = path.join(i18nDir, matchingFile)
        exports.loadFile(filePath)
        foundLanguageFile = true
        break
      }
    }
  }
  return foundLanguageFile
}

// 初始化语言加载顺序：
// 1. 优先加载保存的语言文件路径（用户手动选择的）
// 2. 扫描i18n文件夹自动加载匹配的语言文件
// 3. 回退到使用语言代码加载默认语言包
if (langFilePath != null && typeof langFilePath === 'string') {
  try {
    exports.loadFile(langFilePath)
  } catch (err) {
    // 如果加载失败，尝试扫描i18n文件夹
    if (!scanAndLoadLanguageFile() && appLang != null) {
      // 如果扫描也失败，回退到默认语言加载
      exports.loadLang(appLang)
    }
  }
} else {
  // 没有保存的语言文件路径，直接扫描i18n文件夹
  if (!scanAndLoadLanguageFile() && appLang != null) {
    // 如果扫描失败，回退到默认语言加载
    exports.loadLang(appLang)
  }
}
