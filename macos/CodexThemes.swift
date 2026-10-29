// Codex Themes launcher.
//
// Opens Codex (ChatGPT.app, bundle id com.openai.codex) with a localhost
// DevTools port, injects codex-themes.js into every Codex window over the
// Chrome DevTools Protocol, keeps doing so for new windows and reloads, and
// exits when Codex quits. Codex's bundle and code signature are never touched.

import AppKit
import Darwin

let codexBundleID = "com.openai.codex"
let portFlag = "--remote-debugging-port="

// MARK: - Logging

let logURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/CodexThemes.log")

func log(_ message: String) {
    let line = Data("\(ISO8601DateFormatter().string(from: Date())) \(message)\n".utf8)
    if let handle = try? FileHandle(forWritingTo: logURL) {
        handle.seekToEndOfFile()
        handle.write(line)
        try? handle.close()
    } else {
        try? line.write(to: logURL)
    }
}

// MARK: - Process helpers

/// Command-line arguments of another process owned by this user (sysctl KERN_PROCARGS2).
func arguments(of pid: pid_t) -> [String] {
    var mib: [Int32] = [CTL_KERN, KERN_PROCARGS2, pid]
    var size = 0
    guard sysctl(&mib, 3, nil, &size, nil, 0) == 0, size > MemoryLayout<Int32>.size else { return [] }
    var buffer = [UInt8](repeating: 0, count: size)
    guard sysctl(&mib, 3, &buffer, &size, nil, 0) == 0 else { return [] }
    let argc = Int(buffer.withUnsafeBytes { $0.load(as: Int32.self) })
    var index = MemoryLayout<Int32>.size
    while index < size && buffer[index] != 0 { index += 1 } // executable path
    while index < size && buffer[index] == 0 { index += 1 } // alignment padding
    var args: [String] = []
    while args.count < argc && index < size {
        let start = index
        while index < size && buffer[index] != 0 { index += 1 }
        args.append(String(decoding: buffer[start..<index], as: UTF8.self))
        index += 1
    }
    return args
}

func debugPort(of app: NSRunningApplication) -> Int? {
    arguments(of: app.processIdentifier).first { $0.hasPrefix(portFlag) }.flatMap { Int($0.dropFirst(portFlag.count)) }
}

/// An unused localhost port: bind to port 0, read back the assignment, release it.
func freePort() -> Int? {
    let fd = socket(AF_INET, SOCK_STREAM, 0)
    guard fd >= 0 else { return nil }
    defer { close(fd) }
    var addr = sockaddr_in()
    addr.sin_family = sa_family_t(AF_INET)
    addr.sin_addr.s_addr = inet_addr("127.0.0.1")
    var length = socklen_t(MemoryLayout<sockaddr_in>.size)
    let ok = withUnsafeMutablePointer(to: &addr) { pointer in
        pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, length) == 0 && getsockname(fd, $0, &length) == 0 }
    }
    return ok ? Int(UInt16(bigEndian: addr.sin_port)) : nil
}

/// Polls the DevTools HTTP endpoint until it reports the browser WebSocket URL.
func waitForEndpoint(port: Int, deadline: Date, completion: @escaping (URL?) -> Void) {
    let url = URL(string: "http://127.0.0.1:\(port)/json/version")!
    URLSession.shared.dataTask(with: url) { data, _, _ in
        let info = data.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
        let browserURL = (info?["webSocketDebuggerUrl"] as? String).flatMap(URL.init(string:))
        DispatchQueue.main.async {
            if let browserURL { return completion(browserURL) }
            if Date() > deadline { return completion(nil) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { waitForEndpoint(port: port, deadline: deadline, completion: completion) }
        }
    }.resume()
}

func waitForExit(_ app: NSRunningApplication, deadline: Date, completion: @escaping (Bool) -> Void) {
    if app.isTerminated { return completion(true) }
    if Date() > deadline { return completion(false) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { waitForExit(app, deadline: deadline, completion: completion) }
}

// MARK: - DevTools client

/// One browser-level CDP connection; attaches to each Codex page with flat sessions.
final class DevTools: NSObject {
    private let script: String
    private lazy var session = URLSession(configuration: .ephemeral, delegate: nil, delegateQueue: .main)
    private var socket: URLSessionWebSocketTask?
    private var nextID = 0
    private var getTargetsID = -1
    private var attached = Set<String>()
    var onDisconnect: (() -> Void)?

    init(script: String) {
        self.script = script
    }

    func connect(_ browserURL: URL) {
        let task = session.webSocketTask(with: browserURL)
        task.maximumMessageSize = 64 << 20
        socket = task
        task.resume()
        receive()
        send("Target.setDiscoverTargets", ["discover": true])
        getTargetsID = send("Target.getTargets")
    }

    @discardableResult
    private func send(_ method: String, _ params: [String: Any] = [:], session sessionID: String? = nil) -> Int {
        nextID += 1
        var message: [String: Any] = ["id": nextID, "method": method, "params": params]
        if let sessionID { message["sessionId"] = sessionID }
        guard let data = try? JSONSerialization.data(withJSONObject: message), let text = String(data: data, encoding: .utf8) else { return nextID }
        socket?.send(.string(text)) { error in
            if let error { log("send \(method) failed: \(error.localizedDescription)") }
        }
        return nextID
    }

    private func receive() {
        socket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(.string(let text)):
                self.handle(Data(text.utf8))
                self.receive()
            case .success(.data(let data)):
                self.handle(data)
                self.receive()
            case .success:
                self.receive()
            case .failure(let error):
                log("DevTools connection closed: \(error.localizedDescription)")
                self.socket = nil
                self.onDisconnect?()
            }
        }
    }

    private func handle(_ data: Data) {
        guard let message = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        if let id = message["id"] as? Int, id == getTargetsID {
            let infos = (message["result"] as? [String: Any])?["targetInfos"] as? [[String: Any]] ?? []
            infos.forEach(consider)
            return
        }
        guard let method = message["method"] as? String, let params = message["params"] as? [String: Any] else { return }
        switch method {
        case "Target.targetCreated", "Target.targetInfoChanged":
            if let info = params["targetInfo"] as? [String: Any] { consider(info) }
        case "Target.attachedToTarget":
            if let sessionID = params["sessionId"] as? String { inject(into: sessionID) }
        case "Target.targetDestroyed", "Target.detachedFromTarget":
            if let id = params["targetId"] as? String { attached.remove(id) }
        default:
            break
        }
    }

    /// Codex windows are app:// pages. Fresh windows are caught while still blank so the
    /// script is registered before Codex loads; the script itself skips utility windows.
    private func consider(_ info: [String: Any]) {
        guard info["type"] as? String == "page", let id = info["targetId"] as? String, !attached.contains(id) else { return }
        let url = info["url"] as? String ?? ""
        guard url.isEmpty || url == "about:blank" || url.hasPrefix("app://-/") else { return }
        attached.insert(id)
        log("attach \(url.isEmpty ? "(blank)" : url)")
        send("Target.attachToTarget", ["targetId": id, "flatten": true])
    }

    private func inject(into sessionID: String) {
        // Runs before Codex's own scripts on every later load of this window. Chromium only
        // installs new-document scripts for sessions with the Page domain enabled.
        send("Page.enable", session: sessionID)
        send("Page.addScriptToEvaluateOnNewDocument", ["source": script], session: sessionID)
        // …and now, in the document that is already open.
        send("Runtime.evaluate", ["expression": script], session: sessionID)
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var devtools: DevTools?
    private var codexPID: pid_t = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(appTerminated(_:)), name: NSWorkspace.didTerminateApplicationNotification, object: nil)
        start()
    }

    /// Clicking Codex Themes again (Dock, Spotlight) just brings Codex forward.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        runningCodex()?.activate()
        return false
    }

    @objc private func appTerminated(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              app.bundleIdentifier == codexBundleID, app.processIdentifier == codexPID else { return }
        log("Codex quit; exiting")
        NSApp.terminate(nil)
    }

    private func runningCodex() -> NSRunningApplication? {
        NSRunningApplication.runningApplications(withBundleIdentifier: codexBundleID).first { !$0.isTerminated }
    }

    private func start() {
        guard let scriptURL = Bundle.main.url(forResource: "codex-themes", withExtension: "js"),
              let script = try? String(contentsOf: scriptURL, encoding: .utf8) else {
            return fail("The theme bundle is missing from Codex Themes.app. Reinstall it with scripts/install-macos.sh.")
        }
        guard let codexURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: codexBundleID) else {
            return fail("Codex isn't installed (no app with bundle id \(codexBundleID)).")
        }
        guard let running = runningCodex() else { return launch(codexURL, script: script) }
        if let port = debugPort(of: running) {
            log("Codex already running on port \(port)")
            return attach(port: port, pid: running.processIdentifier, script: script)
        }
        guard confirmRestart() else { return NSApp.terminate(nil) }
        log("restarting Codex")
        running.terminate()
        waitForExit(running, deadline: Date().addingTimeInterval(30)) { [weak self] exited in
            guard exited else { return self?.fail("Codex didn't quit, so themes couldn't be turned on. Quit Codex and open Codex Themes again.") ?? () }
            self?.launch(codexURL, script: script)
        }
    }

    private func launch(_ codexURL: URL, script: String) {
        guard let port = freePort() else { return fail("No free local port for the DevTools connection.") }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.arguments = ["\(portFlag)\(port)"]
        configuration.activates = true
        NSWorkspace.shared.openApplication(at: codexURL, configuration: configuration) { [weak self] app, error in
            DispatchQueue.main.async {
                guard let app else { return self?.fail("Couldn't open Codex: \(error?.localizedDescription ?? "unknown error").") ?? () }
                log("launched Codex pid \(app.processIdentifier) on port \(port)")
                self?.attach(port: port, pid: app.processIdentifier, script: script)
            }
        }
    }

    private func attach(port: Int, pid: pid_t, script: String) {
        codexPID = pid
        waitForEndpoint(port: port, deadline: Date().addingTimeInterval(60)) { [weak self] browserURL in
            guard let self else { return }
            guard let browserURL else { return self.fail("Codex started, but its DevTools endpoint on port \(port) never answered.") }
            let devtools = DevTools(script: script)
            devtools.onDisconnect = { [weak self] in self?.reconnect(port: port, pid: pid, script: script) }
            devtools.connect(browserURL)
            self.devtools = devtools
            log("connected to \(browserURL.absoluteString)")
        }
    }

    /// The socket also drops when Codex quits; the terminate observer covers that case.
    private func reconnect(port: Int, pid: pid_t, script: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            guard let self else { return }
            guard self.runningCodex()?.processIdentifier == pid else { return NSApp.terminate(nil) }
            self.attach(port: port, pid: pid, script: script)
        }
    }

    private func confirmRestart() -> Bool {
        let alert = NSAlert()
        alert.messageText = "Restart Codex to turn on themes?"
        alert.informativeText = "Codex is open without the local connection Codex Themes uses to draw wallpapers. It will quit and reopen right away. If a task is running, Codex may ask you to confirm."
        alert.addButton(withTitle: "Restart Codex")
        alert.addButton(withTitle: "Cancel")
        NSApp.activate(ignoringOtherApps: true)
        return alert.runModal() == .alertFirstButtonReturn
    }

    private func fail(_ message: String) {
        log("error: \(message)")
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Codex Themes"
        alert.informativeText = message
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
