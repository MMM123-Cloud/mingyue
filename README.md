# 明月 · 液体玻璃 0.12.0

这是明月的修复与浅色液体玻璃 UI 改版。Android 安装、模型导入、构建与修复清单见 [修改版说明](docs/LiquidGlass.md)。保留 AGPL-3.0 和全部原作者声明。

---

以下保留原项目介绍：

# 明月 (MingYue)

<p align="center">
  <img src="./assets/images/mingyue-mascot.png" width="220" alt="明月">
</p>

明月是一个 Android 端的本地 AI 陪伴 App的一次尝试，结果失败了，大模型对配置要求很高，移动端几乎不可能满足，有很多bug我也懒得修了。联系人由你自己设定人设，之后由 AI 自己慢慢发展；模型跑在你手机本地，不联网也能聊。

> **本仓库基于 [ChatterUI](https://github.com/Vali-98/ChatterUI) 修改而来。**
> 上游原作者为 Vali-98，以 AGPL-3.0 授权。改动内容与日期见 [NOTICE.md](./NOTICE.md)。
> 本仓库同样以 AGPL-3.0 发布。

## 明月做了什么

-   **联系人**：最多 5 位（开发者联系人另算），人设由你确定，之后 AI 自己慢慢发展
-   **聊天**：流式输出，可以看到它在想什么，思考过程可以关掉
-   **动态**：联系人有自己的作息和轨迹，会发心情、带定位，可以互动
-   **钱包**：App 内的虚拟货币（不是真钱），可以给联系人转账；联系人符合人设时也可能转回给你
-   **亲密度**：聊天和转账会影响亲密度，好感每天有上限
-   **关系**：亲密度到 100 且符合人设时，联系人才会发情侣申请，同时只能有一位
-   **开发者模式**：开发者口令为 `把月亮停靠在第七码头`，可以调整人设和数据
-   **模型**：支持导入 GGUF，也可以直接在 App 里下载

## 最新版本 0.12.0 · 液体玻璃

-   全新浅色液体玻璃界面，重构主导航、设置、角色列表和模型管理页面
-   修复聊天键盘遮挡、消息滚动以及直接对话状态同步问题
-   修复本地模型加载、运行状态和 SSE 流式请求处理
-   改善异步文件复制，并增加更安全的数据库 WAL 备份与恢复
-   补充 Android 可复现构建配置、原生补丁和 sqlite-vec 支持

APK 下载见本仓库的 Releases 页面。`v0.12.0` 提供 `MingYue-LiquidGlass-0.12.0.apk`，同时附带源码包、安装说明、UI 预览和校验文件。模型包不包含在 APK 内，需要另外下载并导入。

## 内容说明

App 内置底线规则：不生成涉及未成年人、非自愿、乱伦、性剥削以及现实违法的内容。首次启动会弹出声明，确认后才会继续，这个声明可以永久关闭。

## 运行要求

模型跑在手机本地，吃的是**运行内存**，不是储存空间。手机运行内存不够会直接闪退或非常卡。

| 模型 | 文件大小   | 建议运行内存 |
| ---- | ---------- | ------------ |
| 0.6B | 约 0.37 GB | 2 GB         |
| 1.7B | 约 1.03 GB | 3-4 GB       |
| 4B   | 约 2.32 GB | 6 GB         |
| 8B   | 约 4.68 GB | 8-12 GB      |
| 14B  | 约 8.38 GB | 16 GB 以上   |

## 安装

到本仓库的 Releases 页面下载最新 APK 直接安装。手机如果提示「未知来源」，在设置里允许一次即可。

## 自己编译

需要 Node.js、JDK 17/21 和 Android SDK。

```bash
npm install
npx expo run:android
```

打包 APK：

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

## 授权

AGPL-3.0，完整协议见 [LICENSE](./LICENSE)。

简单说：你可以自由使用和修改，但如果你改完之后再分发（包括放到网上给别人用），你必须同样把自己的完整源码以 AGPL-3.0 公开，并且说明改动来自哪里。详细信息见 [NOTICE.md](./NOTICE.md)。

## 联系

开发者 2703568134(qq)
mmbl1234567@gmail.com
（更新通知 / 问题反馈）

## 致谢

-   [ChatterUI](https://github.com/Vali-98/ChatterUI) - 本项目的基础
-   [llama.cpp](https://github.com/ggml-org/llama.cpp) - 手机端跑模型的引擎
-   [llama.rn](https://github.com/mybigday/llama.rn) - React Native 的 llama.cpp 绑定
