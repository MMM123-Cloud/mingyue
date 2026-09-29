# 明月·月璃 0.11.0

基于 https://github.com/mmblll/mingyue 的 0.10.29 源码改造，保留 React Native、Expo 和 cui-llama.rn 原生本地推理。不是网页套壳。

## 安装与离线使用

1. 将完整包解压到手机，安装 `MingYue-MoonGlass-0.11.0.apk`。支持 Android 7.0 及以上的 64 位设备；实际速度取决于手机的内存和处理器。
2. 打开应用 → 首页下方「模型」→ 右上角导入按钮 → 「手动选择 GGUF 模型」，选择包里的 `Qwen3-0.6B-Q4_K_M.gguf`。
3. 在模型列表中加载模型。首次尝试选「省电」预设，CPU 默认运行，GPU 默认关闭。
4. 模型就绪后点击首页卡片「开始对话」，或打开联系人聊天。首页设置菜单也保留「直接对话」入口。导入之后可关闭 Wi-Fi 和移动数据，继续对话；首次资源准备也不需要网络。

应用使用独立包名 `com.zjf20.mingyue.glass`，可与原版并存。原版聊天不会自动读取，需要先在原版导出备份，再在新版的设置中导入。导入文件前建议保留原始备份。

本地模型越大，需要的运行内存越多。0.6B 入门模型体积约 397 MB，能力有限；它适合验证离线流程与短对话。模型大小不是内存占用，加载还需要 KV 缓存及原生运行时空间。设备总内存 75% 的检查只是保守估算，不是可用内存保证。

API 模式仍需用户自己配置服务商和凭证。这个交付包没有放入任何 API Key，也没有进行付费 API 调用。

## 修复和界面

-   青色月夜主题、渐变背景、半透明卡片、少量原生背景模糊，统一聊天、动态、钱包和模型界面。
-   Android 12+ 使用 BlurTargetView / BlurView；更旧版本回退到半透明底色。聊天消息不会成为实时模糊源。
-   首页显示本地模型状态，增加聊天、动态、模型、我的四个入口；移除启动时强制弹出的开发者好友申请。
-   普通用户可访问数据备份和屏幕设置；钱包重置增加明确确认。
-   流式回复保留跨网络分块的 UTF-8 和 SSE / NDJSON 事件；网络异常正确触发失败回调；取消流会结束读取。
-   模型校验等待异步数据库操作完成；模型导入检查 GGUF 后缀、避免同名文件覆盖，失败后退出导入状态。
-   使用受限的实际运行配置，保留用户保存的上下文和批处理设置；实际上下文限制也传递给联系人聊天的构造器。
-   加载新模型或卸载时先停止当前生成；同一原生模型的生成互斥。关闭外部模型的文件描述符，避免重复加载造成泄漏。
-   KV 缓存只匹配连续的 token 前缀；修复缓存大小的单位计算。
-   直接对话按 token 预算裁剪发送的完整旧轮次，本地保留最近 160 条记录；增加取消按钮、50ms 合并显示更新、失败保留草稿。
-   修复附件复制未等待、token 统计首次测量返回零、启动默认数据初始化竞态、旧预设迁移未等待。
-   SQLite 外键同步启用；移除无法编译的 MMKV Java 反射补丁；补齐缺失的 tokenizer 资源。
-   明确模型页的入门建议，先展示小模型；强制 CPU 预设清除旧 GPU 设备列表。
-   模型加载按钮修复运算优先级，失败后恢复状态；预设改为「省电 / 均衡 / 长对话」，避免把大上下文直接标为性能更强。
-   自定义短格式颜色和已有透明度的颜色可正常用于毛玻璃；内置主题支持重新导入，删除自定义暗色主题时回退到正确默认值。
-   修复本地引擎资源生成脚本在中文 Windows 默认 GBK 编码下的异常，补丁由依赖安装自动应用。
-   发布构建限制 Gradle、Java 子进程和 Ninja 的并发与内存，减少普通 Windows 主机编译时的内存峰值。
-   将同版本 sqlite-vec 从保留的官方源码重新编译为 16 KB 对齐的 ARM64 / x86_64 原生库，解决预编译库仍使用 4 KB 对齐的问题。

## 源码与编译

推荐 Node 24、JDK 21、Python 3、Android SDK 36、NDK 27.1.12297006。Python 用于生成 OpenCL 资源。首次原生构建需要下载 Maven/Gradle/SDK 依赖。

Windows 在较短的目录（例如 `C:\dev\mingyue`）解压源码，以减少原生工具的 Windows 路径长度问题。运行：

```powershell
./scripts/build-android.ps1
```

输出位于 `dist/MingYue-MoonGlass-0.11.0.apk`。构建脚本会生成或复用 `.signing` 内的专用签名证书。要为本交付 APK 生成可覆盖安装的更新，将单独提供的签名备份里的 `.signing` 放回源码目录。不要将该目录加入公开仓库。

其他系统先设置 `ANDROID_HOME`，安装上述 SDK / NDK 和 Build Tools 36.0.0，然后执行：

```sh
npm ci
python3 scripts/prepare-release-apk.py --sdk "$ANDROID_HOME"
NODE_ENV=production APP_VARIANT=production npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64
```

随后使用 Android 的 apksigner 对 APK 重新签名。原生构建较大，建议为源码、依赖及中间产物预留至少 30 GB 空间。

## 来源与许可

本修改版沿用 AGPL-3.0，随包提供完整对应源码与修改说明。保留明月、ChatterUI 原作者声明及 LICENSE / NOTICE.md。补齐的 `llama3tokenizer.gguf` 来自 ChatterUI 的原始资源： https://github.com/Vali-98/ChatterUI/blob/master/assets/models/llama3tokenizer.gguf 。

入门模型由 Qwen 提供，Unsloth 转为 GGUF，Apache-2.0 授权。来源： https://huggingface.co/unsloth/Qwen3-0.6B-GGUF 。完整包内保留模型的 Apache 许可和来源记录。UI 参考 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill 中的 Glassmorphism 规范和原生 UI 检查清单。

16 KB 对齐修复使用 sqlite-vec v0.1.7-alpha.2 官方源码；来源、MIT / Apache 许可和编译方法均在源码的 `vendor/sqlite-vec/` 中。

## 验证范围

自动化测试覆盖流式中文和事件分块、模型参数边界、缓存前缀、长对话预算、钱包精度及主题导入。Android 发布构建、签名与模拟器检查的最终结果见随包 `验证报告.md`。

未覆盖所有实体手机、厂商 GPU 驱动和远程 API 服务商。iOS 安装包未构建；这个交付针对原项目的 Android 平台。
