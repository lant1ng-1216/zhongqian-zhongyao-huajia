# 仲谦 · 中药材划价系统

> 一款面向**单人中医诊所 / 中药房**的**单机离线**中药划价桌面软件。开方划价、库存进货、顾客档案、常用方、调价、进销存报表一站搞定，体验、效率对标并超越传统"满天星"类划价软件。

<p align="center">
  <a href="https://github.com/lant1ng-1216/zhongqian-zhongyao-huajia/releases/latest">
    <img src="https://img.shields.io/badge/⬇%20下载最新版-Windows%20安装包-08a17a?style=for-the-badge&logo=windows&logoColor=white" alt="下载 Windows 安装包" height="42">
  </a>
</p>

<p align="center">
  <a href="https://github.com/lant1ng-1216/zhongqian-zhongyao-huajia/releases/latest"><img src="https://img.shields.io/github/v/release/lant1ng-1216/zhongqian-zhongyao-huajia?label=最新版本&color=8A1E1E" alt="最新版本"></a>
  <img src="https://img.shields.io/badge/平台-Windows%2010%20%2F%2011-0078D6?logo=windows&logoColor=white" alt="平台">
  <img src="https://img.shields.io/badge/离线-单机运行-5DCAA5" alt="离线单机">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/许可-非商业·自定义-lightgrey" alt="许可"></a>
</p>

关键词：中药划价 · 中药材划价系统 · 中医处方划价 · 中药房管理 · 诊所划价软件 · 开方划价 · 进销存 · 库存管理 · 单机离线 · Windows 桌面应用

> **📥 [点此下载最新版安装包（Releases）](https://github.com/lant1ng-1216/zhongqian-zhongyao-huajia/releases/latest)** —— 下载 `Zhongqian-Setup-x.y.z.exe`，双击安装即可使用。

---

## ✨ 功能特性

- **开方划价（核心）**：顺序键盘录入——药名（拼音简码/全拼/汉字）→ 回车 → 单付用量(g) → 回车，自动追加到药方、焦点回到药名框，全程不碰鼠标。付数为整张处方全局字段。左右分栏：左侧药方单实时汇总总价，右侧操作台，确认后弹出结算（小票预览 + 打印并划价 / 仅划价）。
- **询价 / 正式划价两阶段**：询价实时算价不扣库存，正式划价才生成处方、扣减库存、打印小票；划错可**作废并自动恢复库存**。
- **针灸费 / 其它费**：单次收费项计入总价并打印在小票上。
- **药品基础数据**：增删改、拼音简码自动生成（可手改）、零售价/成本价、库存与预警线；库存不足仅提示、不阻断（允许负库存先卖后补）。
- **库存与进货**：进货自动增库存、更新最近进货价；库存偏低可筛选提示。
- **顾客档案 + 历史方**：建档（姓名/性别/年龄/联系方式），复诊可**一键调取历史方**到划价页复用。
- **常用方模板**：自建方剂组合，划价时整体套用。
- **调价 + 调价历史**：改零售价留痕可追溯。
- **进销存报表**：按时间段查看销售/进货明细，历史处方可补打小票。
- **满天星 Excel 导入** + 一键导出核心数据（可读性备份）。
- **数据自动备份**：启动/关闭自动备份 SQLite 到指定目录，保留最近 10 份。
- **三套界面主题**：现代极简 / 中式国风 / 实用大字，切换只改表现层、不影响操作习惯。
- **登录保护**：本地密码（bcrypt 哈希），忘记密码由开发者用恢复密钥协助重置。
- **小票打印**：58mm 热敏静默打印 / A5 普通打印，双列版式。

## 🧱 技术栈

Electron · React · TypeScript · Tailwind CSS · SQLite（better-sqlite3）· electron-vite · electron-builder · pinyin-pro · xlsx

## 📦 下载安装（给最终用户）

到本仓库 **[Releases](../../releases)** 页面下载最新的 `仲谦-安装程序-x.y.z.exe`，双击 → 下一步 → 完成，桌面出现"仲谦"图标即可使用。

> 首次打开：设置诊所名称 + 登录密码；之后每次打开输入密码进入。
> 安装或首次运行时若出现 Windows"未知发布者"提示，点"更多信息 → 仍要运行"即可（因未购买代码签名证书，属正常现象）。

## 🛠 本地开发运行

需要 Node.js 18+。

```bash
npm install     # 安装依赖（会自动为 Electron 重编译 better-sqlite3）
npm run dev     # 启动开发模式，自动打开窗口
```

数据库文件位于系统用户数据目录（macOS：`~/Library/Application Support/zhongqian/`，Windows：`%APPDATA%/zhongqian/`）。

## ☁️ 打包 Windows 安装包（云端自动构建）

本仓库已内置 GitHub Actions 工作流（`.github/workflows/build-win.yml`）：

- 打开仓库 **Actions** 页 → 选择"构建 Windows 安装包" → **Run workflow**，或推送 `vX.Y.Z` 标签自动触发；
- 约 8–10 分钟后，在该次运行的 **Artifacts** 里下载安装包；推送标签时还会自动发布到 Releases。

> 分发前建议在仓库 `Settings → Secrets and variables → Actions` 添加密钥 `ZHONGQIAN_RECOVERY_KEY`（自定义一串恢复密钥），构建时会注入进包，用于忘记密码时重置；不设置则使用占位符（不安全）。

## 📄 许可与商用授权

本项目采用**自定义·非商业**许可（见 [LICENSE](./LICENSE)）：

- ✅ 个人学习、研究、评估：可自由查看、下载、修改源码；
- ⚠️ **商业使用（诊所/药店实际经营、二次开发销售、以此牟利等）必须事先获得作者书面授权。**

商业授权与合作请联系：

- 📧 邮箱：**zfu9751@gmail.com** ／ **1339698907@qq.com**
- 💬 微信等其它联系方式：请先邮件说明来意后获取。

---

如果这个项目对你有帮助，欢迎 Star ⭐ 支持一下。
