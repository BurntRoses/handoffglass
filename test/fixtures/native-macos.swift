// Disposable, harmless AppKit target for the real Accessibility regression.
import AppKit
import Foundation

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let window = NSWindow(contentRect: NSRect(x: 220, y: 340, width: 540, height: 300),
  styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
window.title = "HandoffGlass · Native QA"
let button = NSButton(title: "Locate target", target: nil, action: nil)
button.frame = NSRect(x: 150, y: 130, width: 200, height: 48)
button.bezelStyle = .rounded
window.contentView!.addSubview(button)
let label = NSTextField(labelWithString: "Native QA · please keep this window in front for 20 seconds")
label.frame = NSRect(x: 20, y: 240, width: 500, height: 32)
window.contentView!.addSubview(label)

func activate() {
  window.makeKeyAndOrderFront(nil)
  app.activate(ignoringOtherApps: true)
}
func report(_ phase: String) {
  // Independent view geometry, not the locator's AX frame. AppKit's rounded
  // button accessibility frame may include an extra 1 DIP border on each side.
  let global = window.convertToScreen(button.convert(button.bounds, to: nil))
  let top = NSScreen.screens.first!.frame.maxY
  let payload: [String: Any] = ["phase": phase, "bounds": ["x": global.minX,
    "y": top - global.maxY, "width": global.width, "height": global.height]]
  let data = try! JSONSerialization.data(withJSONObject: payload)
  print(String(data: data, encoding: .utf8)!)
  fflush(stdout)
}
activate()
DispatchQueue.main.asyncAfter(deadline: .now() + 1) { report("initial") }
DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
  window.setFrameOrigin(NSPoint(x: 340, y: 280)); activate(); report("moved")
}
DispatchQueue.main.asyncAfter(deadline: .now() + 8) { window.orderOut(nil); report("hidden") }
DispatchQueue.main.asyncAfter(deadline: .now() + 11) { activate(); report("restored") }
DispatchQueue.main.asyncAfter(deadline: .now() + 14) {
  button.setFrameSize(NSSize(width: 240, height: 54)); activate(); report("resized")
}
DispatchQueue.main.asyncAfter(deadline: .now() + 18) { app.terminate(nil) }
app.run()
