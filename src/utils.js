/**
 * 获取日期
 * @returns YYYYMMDD
 */
function getDate() {
  const d = new Date()
  const year = d.getFullYear(),
        month = d.getMonth() + 1,
        day = d.getDate()
  return `${year}${toDouble(month)}${toDouble(day)}`
}
/**
 * 0-9数值补零
 * @param {number} num 数值
 * @returns 补零后的值
 */
function toDouble(num) {
  return (num >= 0 && num <= 9) ? `0${num}` : `${num}`
}
/**
 * 根据项目名称生成tag
 * @param {array} tagList 目前存在的tag列表
 * @param {string} projectName 项目名称
 * @returns 生成的tag
 */
async function getAutoTag(tagList, projectName) {
  let i = 1
  let name = `${projectName}_${getDate()}_v0`
  const getTagName = () => {
    const isHasTag = tagList.find(item => item === name + i)
    if(isHasTag) {
      i++
      getTagName()
    }
    return name + i
  }
  return getTagName(name)
}
/**
 * 根据git获取项目信息
 * @param {string} git 
 * @returns git地址 项目地址 项目名称
 */
function getProjectInfo(git) {
	const projectUrl = git.replace(/^(git\@)/, 'https://').replace(/(\.git)$/, '').replace(/\.com\:/, '.com/')
	const arr = projectUrl.replace(/^https:\/\//,'').split('/')
  const gitlab = 'https://' + arr[0]
	const projectName = arr[arr.length - 1]
	return {
		projectGit: git,
		projectUrl,
		projectName,
    gitlab
	}
}
module.exports = {
  getDate,
  toDouble,
  getAutoTag,
  getProjectInfo
}