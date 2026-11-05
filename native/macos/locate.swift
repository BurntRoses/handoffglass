// Read-only foreground macOS AX helper. Newline JSON requests share one process.
// Values, screenshots, clicks and key events are never read or generated.
import AppKit
import ApplicationServices
import Foundation

struct Scope: Decodable { let processId: Int32; let windowId: String }
struct Target: Decodable {
  let mode: String?; let app: String?; let role: String?; let name: String?
  let nativeRef: String?; let scope: Scope?
}
struct LookupError: Error { let code: String; let message: String }
func fail(_ code: String, _ message: String) throws -> Never { throw LookupError(code:code,message:message) }
func output(_ object: [String:Any]) {
  if let data=try? JSONSerialization.data(withJSONObject:object) {
    FileHandle.standardOutput.write(data);FileHandle.standardOutput.write(Data([10]))
  }
}
func attribute(_ element: AXUIElement, _ key: CFString) -> CFTypeRef? {
  var value: CFTypeRef?
  return AXUIElementCopyAttributeValue(element,key,&value) == .success ? value : nil
}
func elementAttr(_ element: AXUIElement, _ key: CFString) -> AXUIElement? {
  guard let value=attribute(element,key),CFGetTypeID(value)==AXUIElementGetTypeID() else {return nil}
  return (value as! AXUIElement)
}
func stringAttr(_ element: AXUIElement, _ key: CFString) -> String? {attribute(element,key) as? String}
func boolAttr(_ element: AXUIElement, _ key: CFString) -> Bool? {attribute(element,key) as? Bool}
func rect(_ element: AXUIElement) -> CGRect? {
  guard let p=attribute(element,kAXPositionAttribute as CFString),let s=attribute(element,kAXSizeAttribute as CFString),
    CFGetTypeID(p)==AXValueGetTypeID(),CFGetTypeID(s)==AXValueGetTypeID() else {return nil}
  var pt=CGPoint.zero,size=CGSize.zero
  guard AXValueGetValue(p as! AXValue,.cgPoint,&pt),AXValueGetValue(s as! AXValue,.cgSize,&size),size.width>0,size.height>0 else {return nil}
  return CGRect(origin:pt,size:size)
}
func hitIsInside(_ element: AXUIElement,_ bounds: CGRect) -> Bool {
  var found: AXUIElement?
  guard AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(),Float(bounds.midX),Float(bounds.midY),&found) == .success,let hit=found else {return false}
  var item=hit
  for _ in 0..<16 {
    if CFEqual(item,element){return true}
    guard let parent=elementAttr(item,kAXParentAttribute as CFString) else {return false};item=parent
  }
  return false
}
struct CachedControl {
  let element: AXUIElement; let processId: Int32; let windowId: String
  let app: String; let role: String; let name: String
}
var cache: [String:CachedControl]=[:]
var destroyedRefs: [String:CachedControl]=[:]
var observer: AXObserver?
var observerPID: Int32=0
var observesChanges=false
func installObserver(_ pid: Int32,_ application: AXUIElement) {
  if observerPID==pid && observer != nil {return}
  if let old=observer {CFRunLoopRemoveSource(CFRunLoopGetMain(),AXObserverGetRunLoopSource(old),.defaultMode)}
  observer=nil;observerPID=pid;observesChanges=false;cache.removeAll();destroyedRefs.removeAll()
  var next: AXObserver?
  let result=AXObserverCreate(pid,{ _,element,notification,_ in
    var event:[String:Any]=["event":"native_change","processId":observerPID]
    if let found=cache.first(where:{CFEqual($0.value.element,element)}) {
      event["nativeRef"]=found.key
      if notification as String == kAXUIElementDestroyedNotification as String {
        if destroyedRefs.count>=96 {destroyedRefs.removeAll()}
        destroyedRefs[found.key]=found.value;cache.removeValue(forKey:found.key)
      }
    }
    output(event)
  },&next)
  guard result == .success,let current=next else {return}
  observer=current
  CFRunLoopAddSource(CFRunLoopGetMain(),AXObserverGetRunLoopSource(current),.defaultMode)
  for name in [kAXFocusedWindowChangedNotification,kAXFocusedUIElementChangedNotification,kAXWindowCreatedNotification] {
    if AXObserverAddNotification(current,application,name as CFString,nil) == .success {observesChanges=true}
  }
}
func remember(_ element: AXUIElement,_ pid: Int32,_ windowId: String,_ app: String,_ role: String,_ name: String) -> String {
  if let existing=cache.first(where:{ $0.value.processId==pid && $0.value.windowId==windowId && CFEqual($0.value.element,element) }) {return existing.key}
  if cache.count>=96 {cache.removeAll()}
  let token=UUID().uuidString.lowercased()
  cache[token]=CachedControl(element:element,processId:pid,windowId:windowId,app:app,role:role,name:name)
  if let current=observer {
    for notification in [kAXMovedNotification,kAXResizedNotification,kAXUIElementDestroyedNotification] {
      if AXObserverAddNotification(current,element,notification as CFString,nil) == .success {observesChanges=true}
    }
  }
  return token
}
func candidate(_ element: AXUIElement,_ pid: Int32,_ windowId: String,_ app: String,_ role: String,_ name: String,_ nativeRef: String?=nil) -> [String:Any]? {
  guard let bounds=rect(element) else {return nil}
  let token=nativeRef ?? remember(element,pid,windowId,app,role,name)
  return ["app":app,"role":role,"name":name,"nativeRef":token,"scope":["processId":pid,"windowId":windowId],
    "bounds":["x":Double(bounds.minX),"y":Double(bounds.minY),"width":Double(bounds.width),"height":Double(bounds.height)],
    "observedAt":Int(Date().timeIntervalSince1970*1000),"enabled":boolAttr(element,kAXEnabledAttribute as CFString)==true,
    "visible":true,"occluded":!hitIsInside(element,bounds)]
}
func process(_ target: Target) throws -> [String:Any] {
  if target.mode=="status" {return ["osPermission":AXIsProcessTrusted() ? "granted":"denied","available":true,"nativeEvents":observesChanges]}
  let inspect=target.mode=="inspect"
  guard inspect || (target.app != nil && target.role != nil && target.name != nil) else {try fail("invalid_query","Exact target required")}
  guard AXIsProcessTrusted() else {cache.removeAll();try fail("permission_denied","Allow Accessibility access for the locator executable in System Settings")}
  guard let app=NSWorkspace.shared.frontmostApplication,let appName=app.localizedName,
    inspect || appName.caseInsensitiveCompare(target.app!) == .orderedSame else {try fail("app_not_frontmost","The requested application must be in front")}
  let pid=app.processIdentifier,root=AXUIElementCreateApplication(pid)
  AXUIElementSetMessagingTimeout(root,0.6)
  let window=elementAttr(root,kAXFocusedWindowAttribute as CFString)
  let windowId=String(window.map{CFHash($0)} ?? 0)
  if let scope=target.scope,scope.processId != pid || scope.windowId != windowId {try fail("target_scope_changed","The target window changed; observe it again")}
  installObserver(pid,root)
  if let token=target.nativeRef {
    if let gone=destroyedRefs[token],gone.processId==pid,gone.windowId==windowId,gone.name==target.name!,gone.role==target.role! {
      return ["candidates":[],"truncated":false,"nativeEvents":observesChanges]
    }
    guard let saved=cache[token],saved.processId==pid,saved.windowId==windowId else {try fail("target_ref_expired","The native control reference expired; observe it again")}
    let currentRole=stringAttr(saved.element,kAXRoleAttribute as CFString)?.replacingOccurrences(of:"AX",with:"").lowercased()
    let currentName=stringAttr(saved.element,kAXTitleAttribute as CFString) ?? stringAttr(saved.element,kAXDescriptionAttribute as CFString)
    guard currentRole==saved.role.lowercased(),currentName==saved.name,saved.role==target.role!,saved.name==target.name! else {
      cache.removeValue(forKey:token);try fail("target_ref_expired","The native control changed; observe it again")
    }
    guard let hit=candidate(saved.element,pid,windowId,target.app!,target.role!,target.name!,token) else {try fail("target_not_found","The referenced control is no longer present")}
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else {try fail("app_changed","Foreground changed during observation")}
    return ["candidates":[hit],"truncated":false,"nativeEvents":observesChanges]
  }
  var queue:[(AXUIElement,Int)]=[(root,0)],index=0,candidates:[[String:Any]]=[]
  let inspectRoles:Set<String>=["button","menubaritem","menuitem","checkbox","radiobutton","popupbutton","tab","disclosuretriangle","link","switch","slider","splitbutton","tabitem"]
  var cutBranch=false
  while index<queue.count && index<600 && candidates.count<(inspect ? 48:65) {
    let (element,depth)=queue[index];index+=1
    if let rawRole=stringAttr(element,kAXRoleAttribute as CFString) {
      let role=rawRole.hasPrefix("AX") ? String(rawRole.dropFirst(2)).lowercased():rawRole.lowercased()
      let name=stringAttr(element,kAXTitleAttribute as CFString) ?? stringAttr(element,kAXDescriptionAttribute as CFString) ?? ""
      let matches=inspect ? inspectRoles.contains(role) && !name.isEmpty && name.count<=256 : role==target.role!.lowercased() && name==target.name!
      if matches,let hit=candidate(element,pid,windowId,inspect ? appName:target.app!,inspect ? role:target.role!,name) {candidates.append(hit)}
    }
    if let children=attribute(element,kAXChildrenAttribute as CFString) as? [AXUIElement],!children.isEmpty {
      if depth<8 {
        if children.count>120 {cutBranch=true}
        for child in children.prefix(120){queue.append((child,depth+1))}
      } else {cutBranch=true}
    }
  }
  guard NSWorkspace.shared.frontmostApplication?.processIdentifier==pid else {try fail("app_changed","Foreground changed during observation; inspect again")}
  var answer:[String:Any]=["candidates":candidates,"truncated":cutBranch || index<queue.count,"nativeEvents":observesChanges]
  if inspect {answer["app"]=appName}
  return answer
}
// Stdin is consumed off the main run loop so AXObserver notifications can arrive
// between requests. Both request processing and notification output run on main.
var inputBuffer=Data()
FileHandle.standardInput.readabilityHandler={ handle in
  let data=handle.availableData
  DispatchQueue.main.async {
    if data.isEmpty {exit(0)}
    inputBuffer.append(data)
    if inputBuffer.count>8192 {output(["error":"Input too large","code":"invalid_query"]);exit(1)}
    while let newline=inputBuffer.firstIndex(of:10) {
      let line=Data(inputBuffer[..<newline]);inputBuffer.removeSubrange(...newline)
      autoreleasepool {
        do {
          guard let target=try? JSONDecoder().decode(Target.self,from:line) else {try fail("invalid_query","Invalid input")}
          output(try process(target))
        } catch let error as LookupError {output(["code":error.code,"error":error.message])}
          catch {output(["code":"native_error","error":"Native lookup failed"])}
      }
    }
  }
}
RunLoop.main.run()
