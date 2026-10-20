# 在 Codex 中使用

HandoffGlass 是 Codex 的屏幕交接工具：Codex 判断任务需要你操作电脑时，自行选择定位、指示、等待和继续。它不替你点击，也不把一张截图当成完成证明。

## 连接

1. 打开 HandoffGlass，进入「连接」，选择 Codex。
2. 点「连接」。它会合并 MCP 配置并安装引导技能，保留其他设置。源码安装也可运行 `node scripts/install-host.mjs codex --apply`。
3. 重启 Codex，让它重新读取 MCP。升级已有安装时，也重启 HandoffGlass。

「帮助」中的连接检查只检测本地服务；Codex 成功调用工具后，「最近连接」才会出现请求记录。需要圈出原生控件时，在「帮助」允许定位，并完成 macOS 辅助功能授权；无法定位时仍可使用文字引导。

Codex MCP 配置字段参见 [OpenAI 官方文档](https://developers.openai.com/codex/mcp/)；实际本机路径以应用生成的配置为准。

## 日常使用

安装完成后，不需要告诉 Codex 工具名、坐标或操作顺序。直接说：

```text
教我清空废纸篓。
```

若尚未安装，可先说：

```text
请根据 https://github.com/BurntRoses/handoffglass 的 codex/release-interface 分支安装 HandoffGlass 并接入本机 Codex，然后教我清空废纸篓。
```

Codex 应自己查看当前界面、指示下一步、等待你操作，再检查原应用。屏幕提示只保留当前一步。控件查看有范围限制，无法独立核验时应如实说明。软件不点击、不截屏、不删除文件；涉及删除、授权或登录时，由你在原应用中决定。
