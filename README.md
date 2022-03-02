# 发布脚本

专注于业务开发，避免发布项目时频繁切换分支，合并分支及创建 tag 的过程

## 使用

```bash
msb-tools release --config release.config.js
```

## 配置文件

```
module.exports = {
	// 项目信息  用于进行merge request检查
	git: '',             // git地址 (https或ssh)
	projectId: '',       // gitlab 项目id
	privateToken: '',    // 非必填  默认支持一对一与小熊艺术

	// 各发布阶段对应分支   支持字符串与对象
	stages: {
		dev: ''             // 开发环境
		test: '',           // 测试环境
		gray: '',           // 预发环境
		online: {           // 生产环境
			branch: '',
			appJob: ''
		}
	}
}
```

## 工作流

1. dev，test, prod
   本地版本库检测&推送 -> 切换分支 -> 合并分支 -> 推送 -> 返回
2. online
   本地版本库检测&推送 -> 合并分支 -> 创建 tag -> 推送 -> 生成工单

## TODO

1. 发布时更新版本号
2. 版本检测与强制升级
3. 构建生产环境时增加中间临时分支
