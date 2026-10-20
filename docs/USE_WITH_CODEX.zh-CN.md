# 在 Codex 中使用

需要你操作电脑时，Codex 在屏幕上指引你，等待你完成，再继续任务。

## 安装

发给 Codex：

```text
请安装 https://github.com/BurntRoses/handoffglass
```

安装与接入由 Codex 按[项目内的要求](INSTALL_AGENT.md)完成。

## 使用

直接说：

```text
教我清空废纸篓。
```

Codex 自己安排步骤。执行其他任务时，需要你亲手操作的地方也可以交接。

<details>
<summary>手动连接与排查</summary>

1. 打开 HandoffGlass，进入「连接」，选择 Codex。
2. 点「连接」。它会合并 MCP 配置并安装引导技能，保留其他设置。源码安装也可运行 `node scripts/install-host.mjs codex --apply`。
3. 重启 Codex，让它重新读取 MCP。升级已有安装时，也重启 HandoffGlass。

「帮助」中的连接检查只检测本地服务；Codex 成功调用工具后，「最近连接」才会出现请求记录。需要圈出原生控件时，在「帮助」允许定位，并完成 macOS 辅助功能授权；无法定位时仍可使用文字引导。

Codex MCP 配置字段参见 [OpenAI 官方文档](https://developers.openai.com/codex/mcp/)；实际本机路径以应用生成的配置为准。

Codex 应自己查看当前界面、指示下一步、等待你操作，再检查原应用。屏幕提示只保留当前一步。控件查看有范围限制，无法独立核验时应如实说明。软件不点击、不截屏、不删除文件；涉及删除、授权或登录时，由你在原应用中决定。

</details>
