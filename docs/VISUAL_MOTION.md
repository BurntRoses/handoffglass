# 桌面标记与动效

桌面覆盖层、外观页和试验台共用 `src/desktop/overlay-renderer.mjs` 与 `marks.css`。SVG、系统字体和 CSS 全部在本地运行，不需要逐帧工具调用。

## 按用途选标记

| 用途 | 标记 | 模板 |
| --- | --- | --- |
| 压暗背景、聚焦区域 | `spotlight`、`glow`、`box`、`bracket` | `focus`、`region`、`inspect`、`bracket` |
| 指向按钮或小图标 | `arrow`、`dot`、`ripple`、`halo`、`cursor`、`crosshair` | `point`、`beacon`、`verify` |
| 圈选与手绘 | `ring`、`double_ring`、`scribble` | `sketch` |
| 文字与行标记 | `highlight`、`underline`、`strike` | `highlight` |
| 步骤与视觉反馈 | `badge`、`check`、`cross` | `sequence`、`acknowledge`、`exclude`、`caution` |

`check` 和 `acknowledge` 只呈现视觉反馈，不会把任务标记为成功。结果仍须独立核实。`strike` 和 `cross` 表示忽略或排除，不代替用户决定。默认每次操作只用一个主标记。

## 出现、停留、收起

| 字段 | 取值 | 表现 |
| --- | --- | --- |
| `effect` | `draw` | 逐笔描绘，随后出现说明 |
| | `fade` | 整体渐显，适合区域柔光 |
| | `pop` | 从 92% 轻微放大到原尺寸，适合点位与反馈 |
| | `pulse` | 描绘后轻柔强调 |
| | `flow` | 描绘后沿轮廓流动一小段短线 |
| | `still` | 完整静态显示 |
| `exit` | `fade` | 180 ms 渐隐 |
| | `retract` | 180 ms 收笔并渐隐 |
| | `shrink` | 缩至 94% 并渐隐，圆心保持在目标位置 |

`delayMs` 为 0–5000，`durationMs` 为 200–4000。默认描绘 760 ms，手绘 1050 ms，渐显 300 ms，轻弹 360 ms。`sequence` 每步错开 420 ms；长行使用四角框避免扁长圈线。

连续会话中，用户提交完成报告后，桌面等待渲染器收起标记再隐藏覆盖窗口。结束动画从当前实际透明度和笔迹进度继续；快速呈现新步骤会撤销旧的清理计时器。覆盖窗口仍然不接收鼠标、不夺取焦点。停止、暂停、目标失效、权限变化和断线立即清除，不用退出动画保留失效坐标。纯场景 patch 中的移除同样立即生效。

渲染器内部 `animateExit:true` 仅供已知的正常收起使用，不是 Agent 的场景参数。桌面清空确认带渲染序号，过期确认不能隐藏刚出现的新标记；300 ms 兜底限制无响应窗口的保留时间。

## 遮罩与质感

`spotlight.maskStyle` 支持 `soft`（默认 4 DIP 羽化、32% 暗度）、`crisp`（清晰边缘、32% 暗度）和 `deep`（羽化、56% 暗度）。多个目标共用一层遮罩，取较深暗度，不叠加压暗；每个目标保留自己的边缘处理。孔洞完整透明，与轮廓 `opacity` 分开，避免目标被一起压暗。

`minimal` 使用精细轮廓；`luminous` 增加暗色衬边和柔光，便于在深浅界面上辨认；`handdrawn` 使用两次不同的开放笔迹。手绘曲线是确定性的，跟随时不会随机抖动。`glow` 只为区域铺柔光，不压暗整屏。

`motion:off`、`effect:still` 和系统减少动态效果关闭相应动画。`motion:off` 或系统减少动态效果下，收起同步完成。强制颜色模式隐藏遮罩、柔光和衬边，轮廓改用系统强调色。用户保存的风格和动态设置优先于 Agent 提示。

标记 ID 应稳定：相同快照复用节点，目标移动重建几何并保留原播放时间。目标失效后恢复重新描绘。每个 SVG 的资源 ID 独立，预览之间不串用蒙版。说明卡仍采用有限候选布局；密集目标应减少标签。

## 预览与检查

- App「外观」：五类用途、19 种标记、出现与停留、收起、三种遮罩；样式库只影响预览。
- `npm run gallery`：实际渲染器、可点击演示界面、19 格笔触集和 Agent 调用示例。
- `npm run test:motion`：隔离 Electron 中采样渐显、轻弹、描绘、三种退出进度、立即清除和系统减少动态效果，输出 `.tmp/overlay-motion`。
- `npm run test:visual -- --output=.tmp/visual-qa`：真实 MCP 与覆盖窗口，检查跟随、焦点、用户报告后的可见退出及核实闭环。
- `npm run test:release-ui`：外观库分组、收起/恢复、语言、偏好保存与其他 App 流程。

这些检查不代替 Windows 桌面和物理外接屏验收。详见 [桌面验收](DESKTOP_QA.md)。
