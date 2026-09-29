# 明月 · 液体玻璃 0.12.0

原生 Android 修改版，基于 MMM123-Cloud/mingyue 0.10.29，保留 React Native / Expo / cui-llama.rn 本地推理与 AGPL-3.0 许可。

## 安装及断网使用

1. 解压完整包，安装 `MingYue-LiquidGlass-0.12.0.apk`。支持 Android 7.0+ 的 ARM64 手机及 x86_64 设备。
2. 底部「模型」→ 右上角文件加号 →「手动选择 GGUF 模型」，选择随包 `Qwen3-0.6B-Q4_K_M.gguf`。
3. 点击「加载」。建议先用「省电」预设，CPU 运行，GPU 默认关闭。
4. 返回「对话」→「开始对话」。首次启动、导入及本地聊天均可断网。模型约 397 MB，运行需要额外内存，适合入门短对话。

包名仍为 `com.zjf20.mingyue.glass`，签名与 0.11.0 相同，可覆盖升级保留数据，也可以与原版共存。原版数据需先导出，再到新版「我的」→「数据与备份」导入。导入先验证文件、备份当前数据库，应用失败会尝试自动恢复。

数据库快照包含联系人和角色聊天；直接对话在聊天页右上角可另行导出文本。模型文件、头像和附件等独立媒体文件、应用设置、动态及虚拟钱包状态不属于数据库快照，迁移时请另行保留。API 模式需自行配置服务商和凭证，仍需网络。交付包无 API Key。

Android 10+ 导出到下载目录；Android 7–9 使用系统文件夹选择器保存，取消后不会显示导出成功。导入会等待文件完整复制后才验证，避免异步复制未完成便打开数据库。

## 新界面和修复

- 月白底色、冷蓝强调色、系统字体、更多留白；对话 / 动态 / 模型 / 我的为四个独立 Tab，设置改为分组入口。
- 「我的」→「模型与连接」切换本地 / API 模式并管理连接；启用开发者模式后，高级工具仍可从设置进入。
- 全新玻璃月牙图标，包含完整图标与透明 Android 自适应前景，启动画面使用同一标识。
- 导航、输入和主要控件使用玻璃材质。Android 13+ 原生 AGSL 折射与边缘高光，Android 12 保留模糊，更旧设备使用半透明材质。正文不参与折射，无持续背景动画。
- 旧内置默认主题迁移到浅色，保留自定义主题和系统主题偏好。
- 修复键盘出现后最新聊天消息离开视野，使用实际导航高度并区分手动/程序滚动；增加对话导出、清空确认、失败提示。
- 模型状态使用真实加载标记，GPU 未实际启用时运行配置报告 CPU；模型说明随列表滚动，操作至少 48dp。
- 联系人分页不会因返回列表顶部而卡住，切换筛选后恢复初始分页。
- 数据库初始化与本地身份验证在所有页面打开前执行，直接链接进入模型或设置页也受保护。
- 使用 SQLite 快照导出，包含 WAL 最新提交。文件校验及恢复备份成功前不改动当前库，取消先删除原库的导入方式，操作互斥。
- 中文、空格与百分号文件名在导出时正确转换为原生路径；直接对话文本与数据库快照都能保存到下载目录。
- Android 向量扩展保留 `libvec.so` 库名，在应用启动与临时备份连接中等待加载，避免原库名无法解析及未处理的加载异常。
- 默认角色、头像复制、角色克隆及聊天背景导入会等待文件复制完成；复制失败不会提前报告成功。首次默认角色创建失败时保留下次启动重试机会。
- 保留上一版的中文流式解析、模型校验、上下文裁剪、取消生成、配置上限、文件描述符与缓存修复，详见 `MoonGlass.md`。

## 源码与复现

完整对应源码见 `MingYue-LiquidGlass-0.12.0-source.zip`。建议 Node 24、JDK 21、Python 3、Android SDK / Build Tools 36、NDK 27.1.12297006。Windows 解压到短路径，如 `C:\dev\mingyue`，预留至少 30 GB：

```powershell
./scripts/build-android.ps1
```

输出 `dist/MingYue-LiquidGlass-0.12.0.apk`。脚本执行依赖安装、补丁、16 KB sqlite-vec 编译、Expo 生成、原生构建与签名。可设置 `MINGYUE_APP_BUILD_DIRECTORY` 为另一个短的绝对目录，存放应用中间产物。

其他系统：

```sh
npm ci
python3 scripts/prepare-release-apk.py --sdk "$ANDROID_HOME"
NODE_ENV=production APP_VARIANT=production npx expo prebuild --platform android --no-install --no-clean
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```

随后使用 apksigner 签名。更新本包需复用单独提供的签名备份，把 `.signing` 放回项目根目录；备份含私钥和密码，不能上传 GitHub。公共源码和完整包不含私钥。

`patches/expo-blur+57.0.3.patch` 保留原生玻璃实现；`package.json` 的 `expo.autolinking.android.buildFromSource` 指定 `expo-blur` 从源码构建，避免 Expo 的预编译 AAR 跳过改动。React Native Gradle 补丁修复 Windows 跨盘路径。`vendor/sqlite-vec` 保留同版本官方源码、许可证与 16 KB 对齐方法。应用沿用 AGPL-3.0，模型来自 [Unsloth Qwen3-0.6B-GGUF](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF)，Apache-2.0，随包保留原作者及各项许可。

实际验证见包内「验证报告.md」。未覆盖全部实体手机及厂商 GPU，未构建 iOS 安装包。设计规范及 GitHub 技能见 `DesignSystem.md`。
