# 🍎🎈 Loon-SMS-Forwarder

> **基于 MitM 拦截腾讯手机管家实现的 iOS (<17) 短信自动化转发方案。支持 Telegram、飞书、Webhook 三个转发通道，如需钉钉、邮件等方式请自己让AI糊**
> 
> 专门为坚守 iOS 15/16、追求 TrollStore (巨魔) 或越狱体验，却苦于没有 iOS 17 快捷指令自动化转发功能的用户打造。因为IOS17以下即使转发也要手动点一下快捷指令的通知才能转发出去，畜生COOK
> 
> 
![Only Apple can do](<./Only Apple can do.jpg>)
---

### ⚠️ 免责声明 (Disclaimer)

本项目的所有代码、插件配置文件及本 `README` 说明文档均完全由 **AI (Gemini)** 协作生成。本人并不具备专业的代码开发技术背景，代码逻辑仅供技术研究参考。

---

## 🛠️ 实现原理

由于系统权限限制，脚本无法直接读取短信。本方案采用“曲线救国”：
1. **腾讯手机管家**：开启“精准查询”后，系统收到短信时，管家会将短信特征同步至云端。
2. **Loon (MitM)**：通过中间人攻击技术拦截管家发往 `jprx.m.qq.com` 的请求包。
3. **JS 脚本**：从拦截到的包中提取发信人与正文，并顺序推送到你的指定终端。

---

## 🚀 快速上手 (Quick Start)

按照以下步骤，即可快速搭建属于你自己的短信转发系统：

### 1. Fork 本仓库
点击页面右上角的 **Fork** 按钮，将本项目克隆到你的个人 GitHub 账号下。

### 2. 准备软件环境
* **Loon**: 确保已安装并开启 `脚本` 与 `MitM` 开关。
* **证书**: 必须在 Loon 中生成并 **“完全信任”** CA 证书。
* **腾讯手机管家**: 进入系统 `设置` -> `信息` -> `未知与过滤信息` 选择并开启管家的过滤功能，并在管家 App 内开启“精准查询”。

### 3. 导入插件 (Plugin)
在 Loon 的插件页面，点击 `+` 号选择从 URL 导入，填入你 Fork 后的插件地址：
`https://raw.githubusercontent.com/你的用户名/SMSForwarder_LOON/main/get_sms.plugin`
> *(请将路径中的“你的用户名”替换为你真实的 GitHub ID)*

### 4. 将 script-path= 后面替换为你仓库里 js 文件的实际位置（关键）
为了让 Loon 加载你仓库里最新的 JS 脚本，请在插件编辑界面找到 `[Script]` 部分，将 `script-path` 修改为你自己的地址。

```script-path=https://gh-proxy.org/https://raw.githubusercontent.com/你的用户名/SMSForwarder_LOON/refs/heads/main/get_sms.js```

>  **建议使用 gh-proxy 加速以避免网络问题**
---

## ⚙️ 配置参数说明

在 Loon 插件 UI 面板中，根据提示填入以下参数：

| 参数项 | 说明 | 示例值 |
| :--- | :--- | :--- |
| **电报Token.ChatID** | Telegram 转发参数 | `12345:ABC.678910` |
| **飞书完整链接或Token** | 飞书机器人 Webhook | `https://open.feishu.cn/...` |
| **notifyme 的 UUID** | Webhook 通道 (NotifyMe) | `ETt9hnMLNXt46ZJL3TpMkg` |

---

## 🔗 参考与致谢

本项目灵感与部分逻辑参考了以下社区优秀方案：

* **Linux.do**: [iOS17以下使用Loon短信转发](https://linux.do/t/topic/654075)
* **GetQuicker**: [不用捷径转发短信到QK的方法](https://getquicker.net/Common/Topics/ViewTopic/27184)
* **Gitee / SMSForward**: [iOS短信自动转发解决方案](https://gitee.com/knc/sms)
* **SmsForwarder**：[短信转发器](https://github.com/pppscn/SmsForwarder/wiki)
---

## ⚖️ 法律说明

本脚本仅用于个人自动化技术研究及辅助生活便利。请确保在法律允许的范围内使用，严禁用于任何形式的非法监听、隐私侵犯或数据窃取。因使用不当产生的后果由使用者自行承担。
