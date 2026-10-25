# 自定义功能源码副本

本目录是当前分支相对 `upstream/main` 的三项自定义功能变更文件副本，保留原仓库相对路径；不含构建产物或 `node_modules`。文件内容与仓库中的对应文件一致，依赖的上游基础实现仍需结合原项目源码使用。

## 功能与来源

- Native Terminal Prompt Shortcuts：`src/shared/agent-prompt-shortcuts.ts`、`src/renderer/src/components/native-chat/`、`src/renderer/src/components/terminal-pane/TerminalAgentPromptShortcuts.tsx`、相关设置组件及其变更文件。提交：`36528b4e553`。
- CodeBuddy 支持：代理目录、状态/进程识别、slash commands、本地化及相关测试变更文件。提交：`9ee7a8d6dfa`。
- CodeBuddy SVG 图标：`resources/app-icons/codeBuddy.svg`、`src/renderer/src/components/status-bar/icons.tsx`。提交：`6c4d7cb5877`。


这份副本包含上述提交实际变更的文件，不是可独立构建的完整应用；未修改仓库原有源码。

## 后续集成上游更新

上游后续提交不会自动包含本目录中的自定义功能。更新上游时，应先在主仓库源码中集成上游，再将本目录中的自定义功能重新应用到更新后的源码；不要把 `newTool` 整目录覆盖到主仓库，也不要将本目录视为独立、完整的源码树。

建议按以下步骤处理：

1. 确认 `upstream` 指向 `stablyai/orca`，获取最新 `upstream/main`，并基于它更新集成分支。
2. 检查上游更新是否改动了本 README 列出的自定义功能文件及其依赖。上游重构或删除了相关接口、组件、类型、配置结构时，先将自定义功能适配到新结构，再继续集成。
3. 在更新后的主仓库中验证快捷提示词、CodeBuddy 识别与配置、CodeBuddy 图标，以及 CodeArts Agent 识别与配置和图标均正常；运行相关类型检查和测试。
4. 从更新后的主仓库重新复制自定义功能涉及的文件到 `newTool/`，保留原相对路径，并更新“功能与来源”中的文件说明及提交标识。
5. 对照主仓库与 `newTool/` 中的对应文件，确认副本已同步；保留上游自带而非自定义变更的依赖实现，不要因它们未出现在自定义提交中而删除。

如同步时发生冲突，应逐块判断并保留上游更新与自定义功能的必要语义；不能确定某项改动是否仍需要时，先停止并确认，不要直接丢弃任一侧内容。
