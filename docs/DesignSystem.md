# 浅色液体玻璃界面规范

用户指定浅色、简洁大方、液体玻璃，针对原生 Android 与手机本地推理。

采用系统字体；底色 #F6F8FC，正文 #15243A，强调色 #2D67B2，辅助浅蓝 #DFEAFE。8dp 间距节奏、20–24dp 页面边距；首页名称 30sp、标题 20–21sp、正文 14–16sp、元信息 12–13sp。首要操作至少 48dp。圆角 20 / 24 / 28 / 32dp，内外轮廓一致。文字保留系统缩放，说明和设置可滚动。

颜色由 `lib/theme/ThemeColor.ts` 提供，默认 `yueBaiLight`，保留自定义与可选深色主题。四个底部同级页面保存页面状态；聊天及详情页在根栈推进。首页按品牌、邀请、开始对话、模型状态、联系人建立层级。「我的」按外观、聊天、隐私、数据分组。

玻璃用于导航、输入和主要控件，正文采用白色表面和细轮廓。`GlassProvider` 提供静态共享背景；Android 13+ 的 RuntimeShader / RenderEffect 在 BlurView 背景层计算圆角距离场、边缘折射和方向高光，正文位于另一层。只随布局更新，无 JS 逐帧光学动画。异常退回普通模糊；Android 12 使用原生模糊，Android 11 以下使用半透明材质。减少透明度时使用实色。

品牌使用新玻璃月牙图标，提供完整图标与透明自适应前景。内部和启动画面使用透明版，Android 图标保留安全边距。SwiftUI / iOS 26 专有 API 仅作为设计原则参考。

已安装并阅读的 GitHub 技能：

- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)：移动界面、材质、排版、可访问性；其网页营销布局建议未用于应用。
- [Appllama App Design](https://github.com/Appllama/appllama-skills/tree/main/skills/appllama-app-design-skill)：原生 Expo、同级导航、点击区域、真实流程和键盘检查。
- [Liquid Glass Foundations / Best Practices](https://github.com/SohrabZ/liquid-glass-skills)：材质层与正文层分离、圆角、降低运动和透明度。

实现参考 [Android AGSL](https://developer.android.com/develop/ui/views/graphics/agsl)、[RenderEffect](https://developer.android.com/develop/ui/views/graphics/agsl/using-agsl) 和 [Expo BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/)。保留实际截图、操作记录与离线推理结果；模拟器性能不代表全部实体手机。
