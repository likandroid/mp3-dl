/**
 * 命令行入口
 */
const chalk = require('chalk')
const minimist = require('minimist')
const ora = require('ora')
const inquirer = require('inquirer')
const { config, mergeConfig, writeConfigFile } = require('./lib/config')
const { downloadSong } = require('./lib/download')
// 命令参数简写map
const argMap = {
  o: 'output',
  O: 'origin',
  a: 'adapter',
  c: 'chrome'
}

// 根据命令行参数执行解析下载等操作
module.exports = async function(args) {
  const argv = minimist(args)
  console.log(argv)
  if (validateArgv(argv)) {
    extendArgv(argv)
    // 没有传搜索内容参数
    if (argv._.length === 0 || argv.h) {
      // 显示帮助
      return showHelp()
    }
    // 打印版本
    if (argv.v || argv.version) {
      return showVersion()
    }
    // 初始化配置
    mergeConfig(argv)
    // 保存文件
    writeConfigFile()
    // 多搜索内容用空格拼接mmp
    const searchContent = argv._.join(' ')
    // 搜索
    const { search, loadMore } = require('./lib/search')
    const spinner = ora('搜索中...').start()
    try {
      const list = await search(searchContent)
      // 没有搜索到数据
      if (!list.length) {
        return spinner.warn('没有搜索到任何数据，请尝试修改搜索内容')
      } else {
        // 有搜索结果
        try {
          if (argv.y) {
            await downloadSong([list[0]], argv.y)
            return
          }
          const { answers } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'answers',
              message: '按空格键选择或取消你要下载的歌曲，支持多选',
              choices: list.map(music => `${music.author}-${music.title}`),
              default: 0
            }
          ])
          // 过滤下载歌曲
          let downloadSongList = []
          list.forEach(r => {
            answers.forEach(answer => {
              if (`${r.author}-${r.title}` === answer) {
                downloadSongList.push(r)
              }
            })
          })
          await downloadSong(downloadSongList, argv.lrc)
        } catch (error) {
          // do nothing
        }
      }
    } catch (error) {
      spinner.fail(chalk.red('音乐搜索失败，尝试更换搜索源和adapter'))
      throw error
    }
  }
}

// 验证命令行参数
function validateArgv(argv) {
  if (argv.adapter) {
    const adapters = require('./lib/adapters')
    // 是否是支持的adapter
    if (!adapters.includes(argv.adapter)) {
      return false
    }
  }
  return true
}

// 扩展命令行参数
function extendArgv(argv) {
  Object.keys(argMap).forEach(key => {
    if (argv[key] !== undefined) {
      argv[argMap[key]] = argv[key]
    }
  })
}

// 打印帮助信息
function showHelp() {
  console.log(
    chalk.blue(`用法:
  -h, --help 打印帮助信息
  -v, --version 显示当前版本
  -o /path/to/save 下载保存位置
  -O https://muc.cheshirex.com 下载网站来源
  -a default|mk|mm 适配器，根据网站决定
  -c "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" 如果自动查找chrome安装位置失败时需要手动指定chrome的安装目录
  --lrc 同时下载歌词
  --verbose 显示详细信息
  -y 可以跳过选择 直接下载第一个搜索结果
示例：
  mp3-dl -h
  mp3-dl -v
  mp3-dl 丑八怪 -o ~/Documents/Musics --lrc --verbose
  mp3-dl 丑八怪 -y
`)
  )
}

// 打印当前版本
function showVersion() {
  console.log(chalk.blue(require('./package.json').version))
}
