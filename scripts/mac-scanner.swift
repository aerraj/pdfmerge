import AppKit
import Quartz
import ImageCaptureCore

// Native scanner picker and scan controls. Receives a private temporary directory.
final class Scanner: NSObject, NSApplicationDelegate, NSWindowDelegate, IKDeviceBrowserViewDelegate, IKScannerDeviceViewDelegate {
    var window: NSWindow!
    let view = IKScannerDeviceView(frame: NSRect(x: 230, y: 0, width: 720, height: 600))
    let picker = IKDeviceBrowserView(frame: NSRect(x: 0, y: 0, width: 230, height: 600))
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0,y: 0,width: 950,height: 600), styleMask: [.titled,.closable,.miniaturizable], backing: .buffered, defer: false)
        window.title = "pdfmerge — Select a scanner and scan one page"
        window.delegate = self
        picker.displaysLocalCameras = false
        picker.displaysNetworkCameras = false
        picker.displaysLocalScanners = true
        picker.displaysNetworkScanners = true
        picker.delegate = self
        view.delegate = self
        view.transferMode = .fileBased
        view.downloadsDirectory = URL(fileURLWithPath: CommandLine.arguments[1])
        view.displaysDownloadsDirectoryControl = false
        view.displaysPostProcessApplicationControl = false
        view.documentName = "scan"
        window.contentView!.addSubview(picker)
        window.contentView!.addSubview(view)
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    func deviceBrowserView(_ deviceBrowserView: IKDeviceBrowserView!, selectionDidChange device: ICDevice!) {
        view.scannerDevice = device as? ICScannerDevice
    }
    func scannerDeviceView(_ scannerDeviceView: IKScannerDeviceView!, didScanTo url: URL!, fileData data: Data!, error: Error!) {
        if let error = error { fail(error.localizedDescription); return }
        if let url = url { print(url.path); fflush(stdout); NSApp.terminate(nil) }
    }
    func scannerDeviceView(_ scannerDeviceView: IKScannerDeviceView!, didScanTo url: URL!, error: Error!) {
        self.scannerDeviceView(scannerDeviceView, didScanTo: url, fileData: nil, error: error)
    }
    func scannerDeviceView(_ scannerDeviceView: IKScannerDeviceView!, didEncounterError error: Error!) {
        if let error = error { fail(error.localizedDescription) }
    }
    func fail(_ message: String) {
        FileHandle.standardError.write(Data(message.utf8))
        exit(1)
    }
    func windowWillClose(_ notification: Notification) { fail("Scanning cancelled.") }
}
let application = NSApplication.shared
application.setActivationPolicy(.regular)
let scanner = Scanner()
application.delegate = scanner
application.run()
