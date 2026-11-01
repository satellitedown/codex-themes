// Codex Themes helper.
//
// Keeps Codex (in ChatGPT.app, bundle id com.openai.codex) themed however it is
// opened. Codex only accepts a DevTools connection when it starts with
// --remote-debugging-port, so the helper opens Codex with a localhost port, and
// when Codex starts without one (Dock, Spotlight, login, its own relaunch after
// an update) it quits that fresh instance and reopens it with one. It injects
// codex-themes.js into every Codex window over the Chrome DevTools Protocol and
// keeps doing so for new windows and reloads.
//
// The helper has no Dock icon, keeps running after Codex quits, and writes a
// LaunchAgent so it starts again at login. Codex's bundle and code signature are
// never touched.

import AppKit
import Darwin

let codexBundleID = "com.openai.codex"
let portFlag = "--remote-debugging-port="
let agentLabel = "dev.codexthemes.agent"
/// Passed by the LaunchAgent at login: watch for Codex without opening it.
let agentFlag = "--agent"
/// Posted by a second copy of the app (opened while the helper runs) to the running helper.
let openRequest = Notification.Name("dev.codexthemes.open")
/// More fresh Codex restarts than this within the window means Codex isn't keeping the
/// port (for example, it relaunches itself without it), so the helper stops trying.
let restartLimit = 3
let restartWindow: TimeInterval = 60

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

// MARK: - Login item

/// Writes the LaunchAgent that starts the helper at login, pointing at this copy of
/// the app (rewritten when the app moves). launchd reads it at the next login; in
/// this session the helper is already running.
func registerLoginItem() {
    let bundlePath = Bundle.main.bundlePath
    guard let executable = Bundle.main.executablePath else { return }
    if bundlePath.contains("/AppTranslocation/") {
        log("running from a translocated copy; not registering the login item")
        return
    }
    let url = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents/\(agentLabel).plist")
    let plist: NSDictionary = [
        "Label": agentLabel,
        "ProgramArguments": [executable, agentFlag],
        "RunAtLoad": true,
        "KeepAlive": ["SuccessfulExit": false],
        "LimitLoadToSessionType": "Aqua",
        // Lists it as "Codex Themes" in System Settings → General → Login Items.
        "AssociatedBundleIdentifiers": [Bundle.main.bundleIdentifier ?? "dev.codexthemes.launcher"],
    ]
    let existing = (try? Data(contentsOf: url)).flatMap { try? PropertyListSerialization.propertyList(from: $0, format: nil) as? NSDictionary }
    if existing == plist { return }
    do {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0).write(to: url, options: .atomic)
        log("registered login item \(url.path)")
    } catch {
        log("couldn't register login item: \(error.localizedDescription)")
    }
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

    func disconnect() {
        onDisconnect = nil
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        session.invalidateAndCancel()
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

// MARK: - Helper

final class Helper: NSObject, NSApplicationDelegate {
    private let launchedAtLogin = CommandLine.arguments.contains(agentFlag)
    private var script = ""
    private var devtools: DevTools?
    private var attachedPID: pid_t = 0
    /// Codex processes already handled, so each new one is considered exactly once.
    private var seen = Set<pid_t>()
    private var restarts: [Date] = []
    private var appsObservation: NSKeyValueObservation?
    private var prompting = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        if handOffToRunningHelper() { return }
        guard let scriptURL = Bundle.main.url(forResource: "codex-themes", withExtension: "js"),
              let script = try? String(contentsOf: scriptURL, encoding: .utf8) else {
            alert("The theme bundle is missing from Codex Themes.app. Reinstall Codex Themes from github.com/satellitedown/codex-themes.")
            return NSApp.terminate(nil)
        }
        self.script = script
        log(launchedAtLogin ? "helper started at login" : "helper started")
        if Bundle.main.bundlePath.contains("/AppTranslocation/") {
            alert("Move Codex Themes to the Applications folder and open it from there, so it can start at login.")
        }
        registerLoginItem()
        DistributedNotificationCenter.default().addObserver(self, selector: #selector(openRequested(_:)), name: openRequest, object: nil, suspensionBehavior: .deliverImmediately)
        // Codex instances running now are handled below; the observer handles every later one.
        seen = Set(codexApps().map(\.processIdentifier))
        appsObservation = NSWorkspace.shared.observe(\.runningApplications) { [weak self] _, _ in
            self?.runningAppsChanged()
        }
        if launchedAtLogin { adoptRunningCodex() } else { openCodex() }
    }

    /// Opening Codex Themes again (Finder, Spotlight) while it runs opens Codex.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openCodex()
        return false
    }

    @objc private func openRequested(_ notification: Notification) {
        openCodex()
    }

    /// One helper per user: a second copy hands "open Codex" to the running one and quits.
    private func handOffToRunningHelper() -> Bool {
        let me = ProcessInfo.processInfo.processIdentifier
        guard let bundleID = Bundle.main.bundleIdentifier,
              NSRunningApplication.runningApplications(withBundleIdentifier: bundleID).contains(where: { $0.processIdentifier != me && !$0.isTerminated })
        else { return false }
        if !launchedAtLogin {
            DistributedNotificationCenter.default().postNotificationName(openRequest, object: nil, userInfo: nil, deliverImmediately: true)
        }
        log("helper already running; \(launchedAtLogin ? "exiting" : "asked it to open Codex")")
        NSApp.terminate(nil)
        return true
    }

    private func codexApps() -> [NSRunningApplication] {
        NSRunningApplication.runningApplications(withBundleIdentifier: codexBundleID).filter { !$0.isTerminated }
    }

    /// Runs whenever any app starts or quits.
    private func runningAppsChanged() {
        let apps = codexApps()
        let alive = Set(apps.map(\.processIdentifier))
        seen.formIntersection(alive)
        if attachedPID != 0 && !alive.contains(attachedPID) { codexQuit() }
        for app in apps where seen.insert(app.processIdentifier).inserted { codexStarted(app) }
    }

    private func codexStarted(_ app: NSRunningApplication) {
        if let port = debugPort(of: app) { return attach(port: port, pid: app.processIdentifier) }
        // Opened some other way: Dock, Spotlight, login, or Codex relaunching itself after
        // an update. It has only just started, so reopening it with the port loses nothing.
        reopenWithPort(app)
    }

    /// Quits a Codex that has only just started and opens it again with the DevTools port.
    private func reopenWithPort(_ app: NSRunningApplication) {
        let now = Date()
        restarts = restarts.filter { now.timeIntervalSince($0) < restartWindow }
        guard restarts.count < restartLimit else {
            return log("Codex keeps starting without the DevTools port; leaving pid \(app.processIdentifier) alone")
        }
        restarts.append(now)
        log("Codex pid \(app.processIdentifier) started without the DevTools port; reopening it with one")
        // A signal rather than a quit event: it works before Codex has finished launching.
        kill(app.processIdentifier, SIGTERM)
        waitForExit(app, deadline: now.addingTimeInterval(10)) { [weak self] exited in
            if !exited { app.forceTerminate() }
            waitForExit(app, deadline: Date().addingTimeInterval(5)) { exited in
                guard exited else { return log("Codex pid \(app.processIdentifier) didn't quit") }
                self?.launchCodex()
            }
        }
    }

    /// Opening Codex Themes opens Codex with its wallpaper.
    private func openCodex() {
        guard let app = codexApps().first else { return launchCodex() }
        if let port = debugPort(of: app) {
            attach(port: port, pid: app.processIdentifier)
            app.activate()
            return
        }
        guard !prompting else { return }
        prompting = true
        let restart = confirmRestart()
        prompting = false
        guard restart else { return }
        log("restarting Codex pid \(app.processIdentifier)")
        app.terminate()
        waitForExit(app, deadline: Date().addingTimeInterval(30)) { [weak self] exited in
            guard exited else { return self?.alert("Codex didn't quit, so it has no wallpaper yet. Quit Codex and open it again.") ?? () }
            self?.launchCodex()
        }
    }

    /// At login: theme a Codex that is already running, when that loses no work.
    private func adoptRunningCodex() {
        guard let app = codexApps().first else { return }
        if let port = debugPort(of: app) { return attach(port: port, pid: app.processIdentifier) }
        if let launched = app.launchDate, Date().timeIntervalSince(launched) < 30 {
            reopenWithPort(app) // started with the session, e.g. as a login item
        } else {
            log("Codex pid \(app.processIdentifier) is running without the DevTools port; it gets a wallpaper the next time it starts")
        }
    }

    private func launchCodex() {
        guard let codexURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: codexBundleID) else {
            return alert("Codex isn't installed. Get the ChatGPT desktop app, which includes Codex, from chatgpt.com/features/desktop.")
        }
        guard let port = freePort() else { return alert("No free local port for the DevTools connection.") }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.arguments = ["\(portFlag)\(port)"]
        configuration.activates = true
        NSWorkspace.shared.openApplication(at: codexURL, configuration: configuration) { [weak self] app, error in
            DispatchQueue.main.async {
                guard let self else { return }
                guard let app else { return self.alert("Couldn't open Codex: \(error?.localizedDescription ?? "unknown error").") }
                log("launched Codex pid \(app.processIdentifier) on port \(port)")
                // The app observer may not have seen it yet.
                if self.seen.insert(app.processIdentifier).inserted { self.codexStarted(app) }
            }
        }
    }

    private func attach(port: Int, pid: pid_t) {
        guard attachedPID != pid else { return }
        devtools?.disconnect()
        devtools = nil
        attachedPID = pid
        connect(port: port, pid: pid)
    }

    private func connect(port: Int, pid: pid_t) {
        waitForEndpoint(port: port, deadline: Date().addingTimeInterval(60)) { [weak self] browserURL in
            guard let self, self.attachedPID == pid else { return }
            guard let browserURL else {
                if self.codexApps().contains(where: { $0.processIdentifier == pid }) {
                    self.alert("Codex started, but its DevTools endpoint on port \(port) never answered, so it has no wallpaper.")
                }
                return
            }
            self.devtools?.disconnect()
            let devtools = DevTools(script: self.script)
            devtools.onDisconnect = { [weak self] in self?.connectionDropped(port: port, pid: pid) }
            devtools.connect(browserURL)
            self.devtools = devtools
            log("connected to \(browserURL.absoluteString)")
        }
    }

    /// The socket also drops when Codex quits; runningAppsChanged handles that case.
    private func connectionDropped(port: Int, pid: pid_t) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            guard let self, self.attachedPID == pid, self.codexApps().contains(where: { $0.processIdentifier == pid }) else { return }
            self.connect(port: port, pid: pid)
        }
    }

    private func codexQuit() {
        log("Codex quit; waiting for it to start again")
        attachedPID = 0
        devtools?.disconnect()
        devtools = nil
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

    private func alert(_ message: String) {
        log("error: \(message)")
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Codex Themes"
        alert.informativeText = message
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }
}

let app = NSApplication.shared
let helper = Helper()
app.delegate = helper
app.setActivationPolicy(.accessory)
app.run()
