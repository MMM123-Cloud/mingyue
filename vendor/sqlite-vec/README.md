# sqlite-vec 16 KB 构建

源码来自 sqlite-vec v0.1.7-alpha.2 官方 amalgamation 发布：
https://github.com/asg017/sqlite-vec/releases/tag/v0.1.7-alpha.2

对应提交 bdc336d1cf2a2222b6227784bd30c6631603279b，与 Expo 57.0.3 自带 vec.so 同版本。
保留 LICENSE-MIT 和 LICENSE-APACHE；应用没有改变原来的向量库功能。

scripts/prepare-release-apk.py 使用 Android NDK 27.1.12297006，为两个 64 位 ABI 重编译，设置 ELF LOAD 段对齐为 16384。SQLite 扩展接口头文件来自已安装的 expo-sqlite vendor/sqlite3（3.50.3），生成时恢复公开的 sqlite3 名称，通过扩展 API 表调用原数据库。

默认模式在 Gradle 前更新 node_modules/expo-sqlite/android/vec/，由正常发布流程打包。--apk/--output 可修复一个已有 APK 并运行 zipalign；该输出必须重新签名。