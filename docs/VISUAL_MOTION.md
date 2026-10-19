# 本地描绘与引导动效

生产渲染器 `src/desktop/overlay-renderer.mjs` 与 `overlay.css` 同时用于 Electron 和视觉试验台。全部使用本地 SVG、系统字体和 CSS；逐帧动画无需 Agent 调用或新增运行依赖。

| 参数 | 效果 |
|---|---|
| `visualStyle:minimal` | 精细轮廓，去除阴影、外围光线 |
| `visualStyle:luminous` | 轻柔边光、少量阴影、深色说明卡 |
| `visualStyle:handdrawn` | 开放的贝塞尔笔迹、两次不同的圈画、双笔下划线 |
| `effect:draw` | 起笔、描绘、箭头尖与说明依次出现 |
| `effect:flow` | 描绘后沿路径流动的短线提示 |
| `effect:pulse` | 描绘后轻柔强调；光环可向外扩散 |
| `effect:still` | 当前标记立即完整显示 |

`delayMs` 为 0–5000，`durationMs` 为 200–4000；作用于单个 annotation。缺省描绘时长为 760 ms，手绘为 1050 ms。`sequence` 模板每步错开 420 ms，角标再延后 180 ms；宽高比超过 5 的长行改用四角框，避免扁长圈线包裹整行。这是视觉编排，实际步骤完成与推进仍由 Agent 根据应用状态决定。

`motion:off` 或系统 `prefers-reduced-motion:reduce` 会关闭动画，显示完整笔迹，并移除流动短线。`gentle` 使用轻微呼吸，`expressive` 使用较快的流动和光环扩散。用户保存的本地风格与动态设置优先于 Agent 提示。

所有描边使用 `pathLength=1`，避免固定像素长度导致小标记等待、大标记突然出现。渲染器按会话、图层、标记 ID 缓存 SVG 节点：相同快照复用节点；位置或尺寸变化时重建几何并保留原播放时间。目标消失时清空缓存，可靠恢复后重新描绘。更换会话或标记 ID 可以重新播放。标记 ID 应保持稳定。

聚焦使用单个共享蒙版和 4 DIP 羽化边缘，多个目标共用透明区域，避免叠加压暗。每个 SVG 的资源 ID 独立，多个预览不会串用蒙版。说明卡尝试上、下、右、左四个位置，避让目标和先前说明；拥挤画面下是有限候选策略，并不保证任意密集布局完全无重叠。

运行 `npm run gallery` 比较 13 种笔触、三种质感、四种过程及顺序编排；运行 `npm run visual:trial` 进入真实 MCP 与桌面覆盖层试用。`npm run test:visual -- --output=.tmp/visual-qa` 在真实 Electron 中验证动画进度、节点复用、移动、减少动态效果、焦点与交接。输出仅包含专用测试窗口及覆盖层的合成截图，不捕获其他应用。

详见 [Agent 试用](AGENT_VISUAL_TRIAL.md) 与 [macOS 视觉验收](qa/2026-10-20-visual.md)。Windows 渲染与物理外接显示器仍须后续实机验收。
