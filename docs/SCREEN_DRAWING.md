# 屏幕标注

0.20.0。绘制、修改和清除共用 `screen_mark`，立即返回，桌面按本地时钟显示与清除。绘制不启动任务等待，也不调用模型。

## Agent 调用

```js
// 简单画圈：无需先读取屏幕或显示器。
screen_mark({shape:"ring"})
// 聚焦、指向与编号，一次提交。
screen_mark({sequence:true,marks:[
  {shape:"spotlight",placement:"left",width:400,height:240,label:"查看此区域"},
  {shape:"arrow",placement:"right",direction:"left",label:"从这里开始"}
]})
// 使用返回的 id 和 revision；修改保持原显示时限。
screen_mark({action:"update",id,expectedRevision:revision,color:"#75b9ff"})
screen_mark({action:"clear",id,expectedRevision:revision})
```

支持 19 种标记、九个屏幕位置、批注、线宽、虚线、四向箭头与最多八处组合。默认在主屏幕绘制，可指定 `displayId`。位置和尺寸按实际显示器计算；用户明确提供的坐标使用全局 DIP。应用控件仍通过实际观察定位。

返回编号、版本、标记数量、到期时间、`nextAction:"done"` 和本地耗时，不重复发送场景。`revision_conflict` 返回当前版本，`not_found` 不泄露其他 Agent 的标记。引导正在进行时返回 `busy`。

## 桌面操作

在“外观”选择标记，展开“尺寸与批注”调整笔触、位置、方向和说明，点击“在屏幕试画”。显示期间可原地更新或清除，到期自动释放。预览与屏幕使用同一个 SVG 渲染器。外观保存与临时试画各自提交，不相互覆盖。

按钮、选择组与展开区沿用 [界面处方](../DESIGN.md) 的 shadcn 原生 DOM 适配：完整表面选中、独立键盘焦点、可反向中断的展开动效、收起时焦点返回与 inert、减少动态偏好。虚线使用静态几何与渐显，避免描绘动画覆盖线型。

## 执行与速度

绘制直接走 MCP → 常驻 Broker → 本地推送 → SVG；更新复用场景和标记编号，不启动额外进程。目标跟随与任务事件仍由桌面独立处理。需要留在屏幕上的任务使用 `execution:"parked"`；返回 `yield_to_user` 后结束当前聊天回合。用户回到聊天后由 Agent attach、观察并核验。Codex 插件不能自行唤醒已经结束的模型回合。

本地响应基准与桌面检查记录见 [0.20 标注验收](qa/2026-11-12-drawing.md)。
