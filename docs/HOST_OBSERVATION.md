# 宿主观察与本地绘制

0.21 将默认链路分成两段：宿主用已授权工具观察界面并确定目标，HandoffGlass 接收结构化区域，完成坐标映射、绘制、动画和本地事件记录。HandoffGlass 不调用模型、不截图、不代为操作原应用。

## 原有开销

- Skill 将真实应用目标优先送入 `ui_inspect`，宿主已有截图也重复走 AX/UIA。原生定位权限缺失会中断本来可执行的绘制。
- `capability_manifest` 同时探测原生 helper 权限，发现能力也可能启动不必要的进程。
- 绘制只提供中心点与尺寸，截图像素、裁剪、缩放和全局 DIP 的换算留给模型。
- Codex 为所有 HandoffGlass 工具调用运行前后 Hooks，并在每次模型请求执行脚本。简单绘制也承担生命周期开销。
- 工具同时暴露原生查找、完整图层树与宿主观察路径，模型需要选择并重复读较大的参数结构。

## 新默认链路

```text
已有宿主观察 ── bounds / frame ──→ screen_mark ──→ 常驻 Broker → SSE → SVG
       │                              │
       └─ 需要用户操作时 → session_start(parked) → 返回聊天
                          用户返回 → 宿主核验 → session_verify / session_present
```

有可靠观察时，只调用一次绘制。简单装饰按 placement 一次绘制。无需先请求 manifest、定位、权限或等待。原生定位独立保留在 full 工具目录（`npm run plugin:codex:install -- --tool-profile=full`），用于明确需要且已获授权的原生观察、目标跟随。

## 区域契约

`bounds:{x,y,width,height}` 是左上角矩形。无 frame 时使用全局 DIP，支持负坐标、贴边目标和相邻屏幕。不会将精确区域悄悄缩小到旧版尺寸上限。

有 frame 时 bounds 为该图像内的像素区域。`frame:{width,height,bounds}` 分别给出图像实际像素尺寸及其覆盖的全局 DIP 范围。截图裁剪后的范围必须同步调整；工具按 x/y 两轴分别换算，不自行假设缩放或 DPI。

图像 frame 必须位于单个显示器；不同 DPI 的多屏分别提交 frame，或由宿主提供实测全局 DIP。区域越界、跨屏图像映射不明确、可选 capturedAt 超过 30 秒、可选 layoutSignature 不匹配均返回明确错误。这里验证映射与时效，目标语义由宿主观察负责。

固定标记默认 20 秒清除；窗口移动后由宿主重新观察并 update，不能声称自动跟随。显示器布局变化清除临时标记、隐藏固定任务场景；重新呈现仍是原步骤，用户报告仍须独立核验。

参数示例见随包 [工具契约](../skills/visual-handoff/references/tool-contracts.md)。

## 发现与生命周期

Codex 插件设置 `HANDOFFGLASS_TOOL_PROFILE=host`：17 个工具，呈现和更新只提供宿主区域所需的结构。`full` 默认用于现有独立 MCP，保留 19 个工具、原生定位、图层和旧坐标参数；旧工具别名仍由独立开关控制。

初始化的短规则直接说明职责和快路径。manifest 不再探测原生权限；设置原生定位时才调用 permission_status。App 也将原生权限标为可选，不再表示绘制依赖它。

新插件安装默认 `light`（Skills + MCP），不带命令 Hooks。需要生命周期阶段同步、中断处理及一次接续提醒时，可显式 `--lifecycle=enhanced`。增强模式只匹配 session 工具，绘制不触发前后 Hooks；移除每次模型请求和重复初始化的 Hook。已有安装保留生命周期选择；切换模式按自有文件清单事务更新，不编辑宿主信任记录。

```sh
npm run plugin:codex:install -- --lifecycle=light
npm run plugin:codex:install -- --lifecycle=enhanced
```

## 宿主边界

宿主是否能观察目标取决于当前工具和权限。此次 Computer Use 实际拒绝访问 Codex 自身窗口；HandoffGlass 不能使这个受保护目标变为可观察，也不能换一个截图或原生接口绕过限制。允许的观察结果、用户提供的截图及对应可靠映射仍可用于绘制。

Codex 官方说明：[Computer Use](https://learn.chatgpt.com/docs/computer-use)、[插件构成](https://developers.openai.com/plugins/build/plugins)、[Hooks](https://learn.chatgpt.com/docs/hooks)。宿主的观察权限与本插件原生定位权限分别管理；后台 Hook 无法唤醒空闲模型回合。

## 验证

- `test/observed-region.test.mjs`：裁剪/缩放、负坐标、多 DPI、跨屏和空隙、时效、布局变更，以及原生服务拒绝时绘制到核验的完整 Broker 路径。
- `node scripts/mcp-smoke.mjs --host`：真实 MCP 客户端的发现、区域呈现/更新、所有权、游标和核验；full / legacy 保留原有检查。
- `npm run test:runtime-ui`：真实 Electron 绘制及独立测试窗口图像到蒙版的映射；不访问 Codex 窗口。
- `npm run bench:context -- --tools`：实际初始化与工具目录字节数；模型推理时间单独归宿主。
