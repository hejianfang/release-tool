const inquirer = require('inquirer')

function inquirerOption(options) {
  return new Promise((resolve, reject) => {
    inquirer.prompt(options)
    .then((answers) => {
      resolve(answers)
    })
    .catch((error) => {
      reject(error)
    })
  })
}

class Inquirer {
  async confirmInquirer() {
    const res = await inquirerOption({
      type: 'confirm', message: '是否立即提交?', name: 'confirm'
    })

    return res
  }
  async commitMsgInquirer (validate) {
    const res = await inquirerOption({ 
      type: 'input', 
      message: '请输入 commit 信息 (如:feat: 新增功能; fix: bug修复;)', 
      name: 'commit', 
      validate
    })

    return res
  }
  async slectBranchInquirer(obj) {
    const res = await inquirerOption({
      type: 'list',
      message: '请选择要构建的环境',
      name: 'stage',
      choices: Object.keys(obj)
    })
    return res
  }
  async confirmTagInquirer() {
    const res = await inquirerOption({
			type: 'confirm', message: '自动生成git tag?', name: 'confirm'
		})
    return res
  }
  async tagInquirer(validate) {
    const res = await inquirerOption({ 
      type: 'input', message: '请输入要生成的tag', name: 'tag', validate
    })
    return res
  }
  async tagMsgInquirer() {
    const res = await inquirerOption([
			{ 
				type: 'input', 
				message: '请输入此次需求开发内容简介', 
				name: 'description',
			},
			{
				type: 'list',
				message: '请选择生成git diff的工具( 推荐使用 arc )',
				name: 'difftool',
				choices: [
					'arc',
					'compose'
				]
			}
		])
    return res
  }
	async mergeRequestInquirer() {
		const res = await inquirerOption({
      type: 'confirm', message: '所有merge request都被合并过?', name: 'mergerequest'
    })

    return res
	}
	async confirmNextStepInquirer(branch) {
		const res = await inquirerOption({
      type: 'confirm', message: `**注意: 当前是在 ${branch} 分支进行操作，是否继续 ?**`, name: 'confirm'
    })

    return res
	}
}

module.exports = new Inquirer()