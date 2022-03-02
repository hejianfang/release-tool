const path = require("path");
const process = require("process");
const fs = require("fs");
const log = require("npmlog");
const git = require("./git");
const inquirer = require("./inquirer");
const fetch = require("node-fetch");
const { getAutoTag, getProjectInfo } = require("./utils");
log.addLevel("success", 2000, { fg: "red", bg: "yellow" }); // 自定义success日志

const argv = require("minimist")(process.argv.slice(2));
const configFileName = argv.config || argv.c || "release.config.js";

const configFilePath = path.resolve(process.cwd(), configFileName);
if (!fs.existsSync(configFilePath)) {
  log.error("配置文件不存在");
  process.exit(0);
}

const config = require(configFilePath);
let { projectId, privateToken, stages = {} } = config;
stages = resetOnlineStage(stages);

const { projectGit, projectUrl, projectName, gitlab } = getProjectInfo(
  config.git
);

if (!projectId || !config.git) {
  log.error("配置文件不完整, 请检查后再试");
  process.exit(0);
}
const token = setPrivateToken(privateToken);

/**
 * git 暂存区检测与提交
 */
async function gitCheckStatus() {
  log.info("本地暂存区代码检测...");
  const statusRes = await git.gitStatus();
  if (!statusRes.done) {
    log.warn("暂存区还有未提交的代码");
    const confirmAnswer = await inquirer.confirmInquirer();

    // 取消提交
    if (!confirmAnswer.confirm) process.exit(0);

    // 提交代码
    const commitAnswer = await inquirer.commitMsgInquirer((val) => {
      const validate = git.commitStandard.some((item) =>
        val.startsWith(`${item.type}:`)
      );
      if (validate) return true;
      return "commit 信息不规范，请重新输入";
    });
    // 添加暂存区
    await git.gitAdd(statusRes.status);

    // 提交commit
    await git.gitCommit(commitAnswer.commit);
    log.info("本地 commit 提交成功");
  }
  log.info("git pull获取最新代码...");
  await git.gitPull();
  log.info("git push 提交本地仓库代码到远程");
  await git.gitPush();
}

/**
 * 构建环境选择
 */
async function stageSelect() {
  // 构建环境选择
  const selectBranchRes = await inquirer.slectBranchInquirer(stages);

  // 构建环境
  const branchStage = selectBranchRes.stage;
  // 获取构建环境对应的分支及jenkins
  const branchInfo = stages[branchStage];

  return {
    branchStage,
    branch: branchInfo.branch || branchInfo,
    appJob: branchInfo.appJob || branchInfo.jenkins || null,
  };
}

/**
 * 获取当前分支与分支列表
 */
async function getBranchInfo() {
  // 先同步一次远程信息
  log.info("拉取最新远程数据");
  await git.gitPull();
  // 获取本地分支相关信息
  const localBranchObj = await git.gitBranchLocal();
  // 本地分支名称
  const currentBranch = localBranchObj.current;
  return {
    localBranchList: localBranchObj.all,
    currentBranch,
  };
}

// 持续部署
async function devOps(
  localBranchList,
  branchStage,
  branch,
  currentBranch,
  appJob
) {
  // 如果在部署分支进行操作需进行确认后再操作
  const isDanger = currentBranch === branch;
  if (isDanger) {
    const nextStep = await inquirer.confirmNextStepInquirer(branchStage);
    if (!nextStep.confirm) process.exit(0);
  }
  if (branchStage === "online") {
    const isMerged = await checkMergeRequest();

    if (isMerged) {
      // 拉取远程master合并到当前分支
      log.info("拉取远程master合并到当前分支");
      await git.gitPullOrigin("origin", branch);
      await git.gitPush();
    } else {
      process.exit(0);
    }
  } else {
    if (!isDanger) {
      /**
       * 检测指定分支在本地分支列表中是否存在, 如果存在就先删除，再从远程重新拉取到本地
       * 如果不存在, 检测远程分支中是否存在，如果存在就从远程拉取到本地，
       * 如果不存在，(基于master创建一个分支，在合并后创建并推送到远程master, TODO后期在开发)
       */
      if (localBranchList.indexOf(branch) >= 0) {
        // 删除本地分支
        await git.gitDeleteLocalBranch(branch, true);
        // 切换分支
        await git.gitCheckoutBranch(branch, `origin/${branch}`);
        // 拉取最新代码
        await git.gitPull();
        log.info(`分支已切换到 ${branch}分支`);
      } else {
        const remoteBranchList = await git.gitBranch();
        if (remoteBranchList.all.indexOf(`remotes/origin/${branch}`) >= 0) {
          await git.gitCheckoutBranch(branch, `origin/${branch}`);
        } else {
          log.error("远程没有这个分支，请先创建");
          await git.gitCheckout(currentBranch);
          process.exit(0);
        }
      }

      // 合并本地分支到指定分支
      await git.gitMerge(currentBranch, branch);
      log.info(`合并分支${currentBranch} -> ${branch}分支`);
      // 提交代码
      await git.gitPush();
      log.info(`${branch}分支 push 完成`);
    }

    if (
      branchStage === "dev" ||
      branchStage === "test" ||
      branchStage === "gray"
    ) {
      log.success(
        `${branchStage} 环境推送完成 `,
        `请前往${appJob || "Jenkins或gitlab-ci"}执行构建或查看构建进度`
      );
    }
  }
}

async function workEnd(currentBranch) {
  await git.gitCheckout(currentBranch);
  log.info(`工作流已完成，切换回源分支 ${currentBranch}`);
}

/**
 * 获取git tag
 */
async function getGitTag(branchStage) {
  let tag = "";
  const autoTag = await inquirer.confirmTagInquirer();
  const tagList = await git.gitTags();
  if (autoTag.confirm) {
    // 自动生成TAG
    tag = await getAutoTag(tagList.all, projectName);
  } else {
    // 手动生成TAG
    const inputTag = await inquirer.tagInquirer((val) => {
      const isHasTag = tagList.all.find((item) => item === val);
      if (!isHasTag) return true;
      return "tag已存在，请重新输入";
    });
    tag = inputTag.tag;
  }
  const tagres = await inquirer.tagMsgInquirer();

  const description = tagres.description;
  const difftool = tagres.difftool;
  // 本地创建tag
  await git.gitAddAnnotatedTag(tag, `${branchStage}环境 ${description}`);
  // 推送tag到远程
  await git.gitPush(["origin", tag]);
  log.info(`git tag: ${tag} 已推送到远程`);

  return {
    tag,
    difftool,
  };
}

/**
 * 获取git diff
 */
async function getGitDiff(difftool, currentBranch) {
  let diffUrl = "";
  if (difftool == "arc") {
    diffUrl = `请自行通过 arc diff origin/master --only 命令创建git diff工单`;
  } else {
    diffUrl = `${projectUrl}/-/compare/master...${currentBranch}`;
  }
  return { diffUrl };
}

/**
 * 创建审批单
 */
async function approvalFform(options) {
  const { projectName, appJob, projectGit, tag, diffUrl } = options;

  console.table({
    "git 项目  ": projectName,
    "git url  ": projectGit,
    "appJob   ": appJob,
    "appTag   ": tag,
    "git diff ": diffUrl,
  });
}
/**
 * 检测是否有merge quest
 * @returns
 */
async function checkMergeRequest() {
  const mergeRequestCounts = await fetchProject();

  if (mergeRequestCounts) {
    log.success(
      `**master还有${mergeRequestCounts}个merge request需要被处理, 请处理后再继续后面流程**`,
      `${projectUrl}/-/merge_requests`
    );
  } else {
    return true;
  }

  const mergeRequestRes = await inquirer.mergeRequestInquirer();

  if (mergeRequestRes.mergerequest) {
    const isChecked = await checkMergeRequest();
    if (isChecked) return true;
  } else {
    process.exit(0);
  }
}

async function fetchProject() {
  return new Promise((resolve) => {
    fetch(
      `${gitlab}/api/v4/projects/${projectId}/merge_requests?state=opened`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", "private-token": token },
      }
    )
      .then((res) => res.json())
      .then((json) => {
        resolve(json.length);
      });
  });
}

function setPrivateToken(token) {
  const onebyone = "jPx9yYmi7jb6Zi8fH757",
    bear = "G5zFWx1xtTySc39GYsbx";

  if (token) {
    return token;
  } else {
    if (gitlab.includes("newsgitlab")) return bear;
    return onebyone;
  }
}

function resetOnlineStage(stages) {
  if (!stages.online) {
    stages.online = { branch: "master" };
    return stages;
  }

  if (typeof stages.online === "string") {
    stages.online = { branch: stages.online };
    return stages;
  }

  if (!stages.online.branch) {
    stages.online.branch = "master";
  }
  return stages;
}
async function release() {
  await gitCheckStatus();
  const { branchStage, branch, appJob } = await stageSelect();
  const { localBranchList, currentBranch } = await getBranchInfo();
  await devOps(localBranchList, branchStage, branch, currentBranch, appJob);
  // 预发&生产 生成tag&diff
  if (branchStage === "online") {
    const { tag, difftool } = await getGitTag(branchStage);
    const { diffUrl } = await getGitDiff(difftool, currentBranch);
    await approvalFform({ projectName, appJob, projectGit, tag, diffUrl });
  }
  if (
    (branchStage === "dev" ||
      branchStage === "test" ||
      branchStage === "gray") &&
    currentBranch !== branch
  ) {
    await workEnd(currentBranch);
  }
}
module.exports = release;
