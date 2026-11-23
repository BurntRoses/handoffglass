# 在 Codex 中使用

需要你操作电脑时，Codex 在屏幕上指引你，等待你完成，再继续任务。

## 安装

发给 Codex：

```text
请安装 https://github.com/BurntRoses/handoffglass
```

Codex 按[安装指南](INSTALL_AGENT.md)安装[原生插件](CODEX_PLUGIN.md)。已有独立 HandoffGlass MCP 连接时，先移除旧连接。

## 使用

直接说：

```text
教我清空废纸篓。
```

Codex 会按步骤指引你。需要你操作时，桌面会突出当前目标。你完成操作后，Codex 检查原应用的结果，再继续任务。

在 macOS 14 或更新系统，如果目标应用支持截图，可以请 Codex 根据截图定位。在 HandoffGlass 点「分享截图」后，Codex 会收到只含目标应用的一张画面。你也可以在确认窗口取消。详见[截图定位](HOST_OBSERVATION.md#截图定位)。

<details>
<summary>手动连接与排查</summary>

1. 打开 HandoffGlass，进入「连接」，选择 Codex。
2. 点「连接」。它会合并 MCP 配置并安装引导技能，保留其他设置。源码安装也可运行 `node scripts/install-host.mjs codex --apply`。
3. 重启 Codex，让它重新读取 MCP。升级已有安装时，也重启 HandoffGlass。

在「帮助」检查本地服务。重载 Codex 后，调用一个 HandoffGlass 工具，并在「最近连接」查看请求记录。需要圈出原生控件时，在「帮助」允许定位，并完成 macOS 辅助功能授权；无法定位时仍可使用文字引导。

Codex MCP 配置字段参见 [OpenAI 官方文档](https://developers.openai.com/codex/mcp/)；实际本机路径以应用生成的配置为准。

Codex 应自己查看当前界面、指示下一步、等待你操作，再检查原应用。屏幕提示只保留当前一步。控件查看有范围限制，无法独立核验时应如实说明。涉及删除、授权或登录时，由你在原应用中操作。

</details>
