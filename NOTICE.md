# 修改声明 / Modification Notice

本仓库是 **ChatterUI** 的修改版本。

-   上游项目：ChatterUI
-   上游地址：https://github.com/Vali-98/ChatterUI
-   上游作者：Vali-98
-   上游授权：GNU Affero General Public License v3.0

## 本仓库的改动

本仓库以 明月 (MingYue) 的名义，在 ChatterUI 基础上进行了修改，主要改动包括：

-   应用名称、图标、包名（`com.zjf20.mingyue`）与深色主题
-   联系人人设系统、人设随对话自然演进
-   亲密度、关系（情侣）、联系人上限
-   虚拟钱包与转账
-   动态（发布、点赞、评论、定位）
-   开发者模式与开发者联系人
-   内置底线内容规则（`lib/constants/ContentRules.ts`）
-   首次启动声明
-   面向本地 GGUF 模型的下载与导入界面

首次修改时间：2026 年 9 月。

## 授权

本仓库整体沿用上游的 **AGPL-3.0** 授权，协议全文见 [LICENSE](./LICENSE)。

依据 AGPL-3.0 第 5 条，本仓库对上游代码的修改已在此声明，并且完整源码公开在本仓库中。

如果你要再基于本仓库做分发或修改，你需要：

1. 保留本声明与 `LICENSE`；
2. 保留上游 ChatterUI 的作者署名；
3. 同样以 AGPL-3.0 公开你的完整源码；
4. 在你自己修改的文件中注明你的改动。

## 联系方式

如对署名或授权有疑问，请通过本仓库的 Issues 联系。

## 2026-09-28 明月·月璃修改版 0.11.0

基于 MMM123-Cloud/mingyue 0.10.29 修改。新增毛玻璃界面与月夜主题，修复流式解析、模型导入和配置、上下文预算、文件描述符生命周期、初始化和附件保存问题。完整修改说明见 docs/MoonGlass.md。修改版保持 AGPL-3.0 授权和原作者归属。

发布包重新编译 sqlite-vec v0.1.7-alpha.2，使其支持 16 KB ELF 对齐；保留上游源码与 MIT / Apache-2.0 双重许可，详见 vendor/sqlite-vec/。该库来源：https://github.com/asg017/sqlite-vec/releases/tag/v0.1.7-alpha.2 。

## 2026-09-29 浅色液体玻璃修改版 0.12.0

重设页面布局、同级导航、设置入口和月牙图标；新增 Android AGSL 背景折射材质；修复数据库快照与失败恢复、键盘滚动、分页及模型实际状态。对应源码、构建补丁与使用说明随交付提供，继续使用 AGPL-3.0。详情见 docs/LiquidGlass.md 与 docs/DesignSystem.md。
