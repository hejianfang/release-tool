const SimpleGit = require('simple-git')
const process = require('process')
const git = SimpleGit()
const log = require('npmlog')

// git commit 检测列表
const COMMIT_LIST = ['not_added', 'created', 'deleted', 'modified', 'renamed']
// git commit 规范
const COMMIT_STANDARD = [
  {
    type: 'feat',
    subject: '新功能（feature）'
  },
  {
    type: 'fix',
    subject: '修补bug'
  },
  {
    type: 'docs',
    subject: '文档（documentation）'
  },
  {
    type: 'style',
    subject: '格式（不影响代码运行的变动）'
  },
  {
    type: 'refactor',
    subject: '重构（即不是新增功能，也不是修改bug的代码变动）'
  },
  {
    type: 'test',
    subject: '增加测试'
  },
  {
    type: 'chore',
    subject: '构建过程或辅助工具的变动'
  },   
]

class Git {
  constructor() {
    this.commitStandard = COMMIT_STANDARD
  }
  // 暂存区检测
  async gitStatus() {
    const status = await git.status()
    return {
      status,
      done: COMMIT_LIST.every(item => status[item].length == 0)
    }
  }
  // 添加暂存区
  async gitAdd(status) {
    // Todo renamed 变更 有bug 定位后在使用这种方式
    // for(let i = 0; i < COMMIT_LIST.length; i++) {
    //   const item = COMMIT_LIST[i]
    //   await git.add(status[item])
    // }
    await git.add('./*')
  }
  // 提交commit
  async gitCommit(message) {
    await git.commit(message)
  }
  // 本地分支列表
  async gitBranchLocal() {
    const localBranchList = await git.branchLocal()
    return localBranchList
  }
  async gitBranch() {
    const branchList = await git.branch()
    return branchList
  }
  // 删除本地分支
  async gitDeleteLocalBranch(branchName, forceDelete) {
    await git.deleteLocalBranch(branchName, forceDelete)
  }
  // 切换分支
  async gitCheckoutBranch(branchName, startPoint) {
    await git.checkoutBranch(branchName, startPoint)
  }
  // 切换分支
  async gitCheckout(branchName) {
    await git.checkout(branchName).catch(catchErr)
  }
  // 拉取代码
  async gitPull() {
    await git.pull().catch(catchErr)
  }
	async gitPullOrigin(origin, branchName) {
		await git.pull(origin, branchName).catch(catchErr)
	}
  async gitPush(options = []) {
    await git.push(options).catch(catchErr)
  }
  /**
  * 合并分支
  * @param {string} from 源分支
  * @param {string} to   最终被合并到的目标分支
  */
  async gitMerge(from, to) {
    await git.mergeFromTo(from, to).catch(catchErr)
  }
	async gitAddAnnotatedTag(tag, message) {
		await git.addAnnotatedTag(tag, message)
	}
  async gitTags() {
    const taglist = await git.tags()
    return taglist
  }
}

function catchErr (err) {
  if (err.message.indexOf('Automatic merge failed')) {
    log.error('自动合并失败, 请手动解决冲突后在发布...')
  } else {
    log.error(err.message)
  }
  process.exit(0)
}

module.exports = new Git()