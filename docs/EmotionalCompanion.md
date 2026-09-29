# 明月 0.13.0 · 情感陪伴层与记忆召回

这一版只动情感陪伴相关的部分，0.12.0 的液体玻璃界面、离线推理、数据库结构都没有改。

## 这一版改了什么

### 1. 情感陪伴层（新增）

小参数模型（0.6B–1.7B）在情感陪伴里最容易退化成模板：先道歉、再安慰、最后追问，每轮句式几乎一样。原因是本地小模型没有足够容量自己从对话里推出「该怎么读情绪、怎么接情绪」。

所以把这件事写成显式规则喂给模型：

- `lib/constants/EmotionalSupport.ts`
  - `EMOTIONAL_GUIDE`：8 条稳定规则，进系统提示词
  - `inferUserEmotion()`：按关键词打分判断 8 种语气（neutral / sad / anxious / angry / lonely / tired / happy / affectionate）
  - `buildEmotionDirective()`：每轮生成一句「这轮该怎么接」的提示

接入点在 `lib/engine/API/ContextBuilder.ts`：

- 稳定规则写进 `systemPrompt`（前缀区，KV 缓存可复用）
- 每轮那句提示写进 `volatilePrompt`（易变区，不会让前缀缓存失效）

全部是纯本地文本规则，不联网、不调任何 API。

### 2. 记忆按相关性召回（新增）

原来的 `Memories.forContext` 只按「重要度 + 时间」取前 N 条，注入时也不再重排。于是无论你在聊什么，塞进去的永远是那几条最重要的记忆，相关的内容反而排不进去。

现在改成「当前对话的相关度优先」：

- `lib/state/MemoryRecall.ts`
  - `extractTerms()`：英文取 3 字母以上的词，中文取二元组（bigram），并过滤掉纯虚词组成的二元组
  - `countTermHits()` / `scoreRelevance()` / `rankMemoriesForContext()`
  - 相关性优先，带召回冷却，避免同一条记忆连续霸榜
- `lib/engine/DataSources/index.ts`：候选池拿最近 6 条消息做查询

不需要嵌入模型，也不需要联网，手机上单次开销可以忽略。这个思路和 RikkaHub Plus（华灯）在语义检索之外保留的那条 lexical fallback 路径是一致的。

### 3. 修掉一处记忆被随机丢弃

`lib/state/Memories.ts` 的 `forContext` 里有一段按 id 哈希做随机丢弃的逻辑，它跑在排序之前，会把低重要度的记忆丢掉大约一半 —— 而低重要度那一段恰好就是「和当前话题相关但不算重要」的记忆所在。这段逻辑已删除，候选池放宽到 120 条，函数改成同步。

### 4. 随包模型更新

0.12.0 的完整包里装的是 `Qwen3-0.6B-Q4_K_M.gguf`（unsloth 源）。这一版换成：

- 模型：`mlabonne/Qwen3-0.6B-abliterated` 的 GGUF Q4_K_M
- 打包文件名：`mlabonne_Qwen3-0.6B-abliterated-Q4_K_M.gguf`
- 大小：396,704,704 字节
- SHA-256：`cacbf2f07c675bee319a210a22244ad4a8ba86f79daf67b7ede1da14ce8e6b99`
- 来源：`https://huggingface.co/bartowski/mlabonne_Qwen3-0.6B-abliterated-GGUF`
- 许可：Apache-2.0（Qwen3 原许可）

文件名里必须带 `abliterated`。`lib/state/ContentMode.ts` 的 `isAdultModelName()` 靠文件名判断内容模式，名字对不上的话 App 会走安全模式。应用内的模型下载列表（`app/screens/ModelManagerScreen/ModelNewMenu.tsx`）本来就是这几个 abliterated 条目，这一版只是让随包模型和下载列表保持一致。

## 构建

和 0.12.0 一样的流程，见 `docs/LiquidGlass.md`。补充一条硬性要求：**Windows 上必须把仓库放在短路径**，例如 `C:\m` 或 `C:\dev\mingyue`。

原因：`node_modules/cui-llama.rn/android/.cxx/.../CMakeFiles/rnllama_v8_2_dotprod_i8mm_hexagon_opencl.dir/...` 这条路径本身就接近 200 字符，放在 `C:\Users\<用户名>\Documents\GitHub\mingyue` 下会超过 260 字符上限。clang 能写这么长的文件（它走长路径 API），但 ninja 建目录时会失败：

```
ninja: error: mkdir(...): No such file or directory
```

即使系统已经打开 `LongPathsEnabled`，ninja 也不一定带 longPathAware 清单，所以只有把仓库挪短才稳。

`scripts/build-android.ps1` 的输出 APK 名现在读 `package.json` 的版本号，不再写死。

## 测试

```
node node_modules\typescript\bin\tsc --noEmit
node node_modules\jest\bin\jest.js
```

14 个测试套件、37 条用例通过，覆盖情绪判断和记忆召回排序。

## 已知限制

- 情绪判断是关键词打分，不是模型判断。宁可回落到 neutral，也不猜错方向后强行演。
- 这套规则是为 0.6B–1.7B 小模型调的。换成 7B 以上的模型，规则会显得啰嗦，可以关掉情感层。
