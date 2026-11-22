import AppKit
import ScreenCaptureKit

func report(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value) {
        FileHandle.standardOutput.write(data)
    }
}

@available(macOS 14.0, *)
func capture(_ bundleID: String, displayID: UInt32?) async throws -> [String: Any] {
    guard CGPreflightScreenCaptureAccess() else { return ["error": "screen_permission_required"] }
    let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
    let windows = content.windows.filter { $0.owningApplication?.bundleIdentifier.lowercased() == bundleID.lowercased() }
    let displays = content.displays.filter { displayID == nil || $0.displayID == displayID }
    let candidates = displays.compactMap { display -> (SCDisplay, CGFloat)? in
        let visible = windows.filter { display.frame.intersects($0.frame) }
        guard !visible.isEmpty else { return nil }
        let area = visible.map { window -> CGFloat in
            let overlap = display.frame.intersection(window.frame)
            return overlap.width * overlap.height
        }.max() ?? 0
        return (display, area)
    }
    guard let application = windows.first?.owningApplication,
          let (display, _) = candidates.max(by: { $0.1 < $1.1 }) else {
        return ["error": "capture_target_not_visible"]
    }
    // An allow-list filter keeps unrelated apps and the desktop out of the image.
    let filter = SCContentFilter(display: display, including: [application], exceptingWindows: [])
    filter.includeMenuBar = false
    let config = SCStreamConfiguration()
    let frame = display.frame
    let pixelsPerPoint = min(CGFloat(filter.pointPixelScale), 1920 / max(frame.width, frame.height))
    // Keep the display origin even when only one app contributes pixels.
    config.sourceRect = CGRect(origin: .zero, size: frame.size)
    config.width = max(1, Int((frame.width * pixelsPerPoint).rounded()))
    config.height = max(1, Int((frame.height * pixelsPerPoint).rounded()))
    config.scalesToFit = true
    config.showsCursor = false
    let capturedAt = Int64(Date().timeIntervalSince1970 * 1000)
    let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
    let bitmap = NSBitmapImageRep(cgImage: image)
    guard let bytes = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.82]) else {
        return ["error": "capture_failed"]
    }
    return ["data": bytes.base64EncodedString(), "displayId": String(display.displayID),
            "width": image.width, "height": image.height, "capturedAt": capturedAt,
            "bounds": ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]]
}

let args = CommandLine.arguments
let nameOnly = args.dropFirst().first == "--application-name"
let id = args.dropFirst(nameOnly ? 2 : 1).first ?? ""
let lower = id.lowercased()
if id.isEmpty || lower.hasPrefix("com.openai.") || ["dev.handoffglass.desktop", "com.tencent.workbuddy.mac"].contains(lower) {
    report(["error": "protected_application"])
} else if nameOnly {
    let workspace = NSWorkspace.shared
    let runningName = workspace.runningApplications.first(where: { $0.bundleIdentifier?.lowercased() == lower })?.localizedName
    let installedURL = workspace.urlForApplication(withBundleIdentifier: id)
    let installedName = installedURL.map { FileManager.default.displayName(atPath: $0.path) }
    report(["name": runningName ?? installedName ?? id])
} else if #available(macOS 14.0, *) {
    do { report(try await capture(id, displayID: args.count > 2 ? UInt32(args[2]) : nil)) }
    catch { report(["error": "capture_failed"]) }
} else {
    report(["error": "capture_unsupported"])
}
