// Read-only foreground macOS AX locator; no AXValue text, screenshots, clicks or key events.
import AppKit
import ApplicationServices
import Foundation

struct Target: Decodable { let mode: String?; let app: String?; let role: String?; let name: String? }
func reply(_ code: String, _ message: String) -> Never {
  let obj: [String:Any] = ["code": code, "error": message]
  if let data = try? JSONSerialization.data(withJSONObject: obj), let line = String(data: data, encoding: .utf8) { print(line) }
  exit(0)
}
func attribute(_ element: AXUIElement, _ key: CFString) -> CFTypeRef? {
  var value: CFTypeRef?
  return AXUIElementCopyAttributeValue(element, key, &value) == .success ? value : nil
}
func stringAttr(_ element: AXUIElement, _ key: CFString) -> String? { attribute(element, key) as? String }
func boolAttr(_ element: AXUIElement, _ key: CFString) -> Bool? { attribute(element, key) as? Bool }
func rect(_ element: AXUIElement) -> CGRect? {
  guard let p = attribute(element, kAXPositionAttribute as CFString),
        let s = attribute(element, kAXSizeAttribute as CFString),
        CFGetTypeID(p) == AXValueGetTypeID(), CFGetTypeID(s) == AXValueGetTypeID() else { return nil }
  var pt = CGPoint.zero, size = CGSize.zero
  guard AXValueGetValue(p as! AXValue, .cgPoint, &pt), AXValueGetValue(s as! AXValue, .cgSize, &size),
        size.width > 0, size.height > 0 else { return nil }
  return CGRect(origin: pt, size: size)
}
func hitIsInside(_ element: AXUIElement, _ bounds: CGRect) -> Bool {
  let system = AXUIElementCreateSystemWide()
  var found: AXUIElement?
  guard AXUIElementCopyElementAtPosition(system, Float(bounds.midX), Float(bounds.midY), &found) == .success,
        let hit = found else { return false }
  var item = hit
  for _ in 0..<16 {
    if CFEqual(item, element) { return true }
    guard let parent = attribute(item, kAXParentAttribute as CFString), CFGetTypeID(parent) == AXUIElementGetTypeID() else { return false }
    item = parent as! AXUIElement
  }
  return false
}
let input = FileHandle.standardInput.readDataToEndOfFile()
guard let target = try? JSONDecoder().decode(Target.self, from: input) else { reply("invalid_query", "Invalid input") }
let inspect = target.mode == "inspect"
guard inspect || (target.app != nil && target.role != nil && target.name != nil) else { reply("invalid_query", "Exact target required") }
guard AXIsProcessTrusted() else { reply("permission_denied", "Allow Accessibility access for the locator executable in System Settings") }
guard let app = NSWorkspace.shared.frontmostApplication, let appName = app.localizedName,
      inspect || appName.caseInsensitiveCompare(target.app!) == .orderedSame else {
  reply("app_not_frontmost", "The requested application must be the active foreground app")
}
let root = AXUIElementCreateApplication(app.processIdentifier)
AXUIElementSetMessagingTimeout(root, 2.0)
var queue: [(AXUIElement,Int)] = [(root,0)]
var inspected = 0
var candidates: [[String:Any]] = []
let observedAt = Int(Date().timeIntervalSince1970 * 1000)
let inspectRoles: Set<String> = ["button","menubaritem","menuitem","checkbox","radiobutton","popupbutton","tab","disclosuretriangle","link","switch","slider","splitbutton","tabitem"]
while !queue.isEmpty && inspected < 600 && candidates.count < (inspect ? 48 : 65) {
  let (element, depth) = queue.removeFirst(); inspected += 1
  if let role = stringAttr(element, kAXRoleAttribute as CFString) {
    let roleName = role.hasPrefix("AX") ? String(role.dropFirst(2)).lowercased() : role.lowercased()
    let name = stringAttr(element, kAXTitleAttribute as CFString) ?? stringAttr(element, kAXDescriptionAttribute as CFString) ?? ""
    let matches = inspect ? inspectRoles.contains(roleName) && !name.isEmpty && name.count <= 256 : roleName == target.role!.lowercased() && name == target.name!
    if matches, let b = rect(element) {
      candidates.append([
        "app":inspect ? appName : target.app!,"role":inspect ? roleName : target.role!,"name":name,
        "bounds":["x":Double(b.minX),"y":Double(b.minY),"width":Double(b.width),"height":Double(b.height)],
        "observedAt":observedAt,"enabled":boolAttr(element, kAXEnabledAttribute as CFString) == true,
        "visible":true,"occluded":!hitIsInside(element,b)
      ])
    }
  }
  if depth < 8, let children = attribute(element, kAXChildrenAttribute as CFString) as? [AXUIElement] {
    for child in children.prefix(120) { queue.append((child,depth+1)) }
  }
}
guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else { reply("app_changed", "Foreground app changed during observation; inspect again") }
let answer: [String:Any] = inspect ? ["app":appName,"candidates":candidates,"truncated": !queue.isEmpty] : ["candidates":candidates]
if let data = try? JSONSerialization.data(withJSONObject: answer), let line = String(data: data, encoding: .utf8) { print(line) }
