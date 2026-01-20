# dirtywork.top

## Overview / 项目简介
dirtywork.top is a personal toolbox built with Next.js. The `Work` section hosts practical tools (Translate, Refine, Transcribe) plus several product showcases.

dirtywork.top 是一个基于 Next.js 的个人工具箱网站，`Work` 页面包含可用工具（翻译、润色、转写）以及一些项目展示。

计划更新内容：Chat界面引用工作历史记录上下文，直接查询和理解工作记忆。工具底层逻辑可能考虑修改，以访谈/项目为单位使用工具（新建访谈、上传音频、使用工具Refine、Translate、Sumup、Notes...）

## Works Tools / Works 工具说明

### Translate / 翻译
English: Paste long text, click `Start` to stream translation, and use `Stop` to cancel. After completion, export as Markdown via `Export .md`. If logged in, results are auto-saved to history.
中文：粘贴长文本后点击 `Start` 开始流式翻译，`Stop` 可中止。完成后可用 `Export .md` 导出 Markdown。登录后会自动保存到历史记录。

### Refine / 润色
Paste a transcript, optionally add a Base System Prompt, then click `Refine`. You can `Resume` after a pause, or restart with the refresh button. Export the final output as Markdown. Logged-in users get auto-saved history.

粘贴对话/稿件，必要时填写 Base System Prompt，然后点击 `Refine`。中断后可 `Resume` 续跑，或用刷新按钮重新开始。完成后可导出 Markdown，登录后会自动保存历史。

### Transcribe / 转写
Provide a public audio URL, pick a language (en/ja/ko), and toggle speaker labels. Click `Start Transcribe` and wait for the result. You can rename speakers, switch between edit/preview, and copy the final text. Shared links from Google Drive/Dropbox/OneDrive are converted to direct links automatically.

填写公开音频 URL，选择语言（en/ja/ko），可选说话人识别。点击 `Start Transcribe` 后等待结果。支持说话人命名、编辑/预览切换与一键复制；常见网盘分享链接会自动转为直链。

### History / 历史
English: Sign in with GitHub on `/work/history` to view, rename, or delete saved Translate/Refine records.

在 `/work/history` 使用 GitHub 登录后可查看、改名或删除已保存的翻译/润色记录。

## Chat

简单的AI对话工具。