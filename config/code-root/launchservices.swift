// launchservices.swift - the two LaunchServices operations setup-code-root.sh needs.
//
//   swift launchservices.swift app-path <bundle-id>
//     Print the installed app's path. Unlike AppleScript's `path to application
//     id`, this does not launch the app.
//   swift launchservices.swift set-default <app> <extension>...
//     Make <app> the default for each extension's content type, then re-read the
//     handler and exit non-zero naming every extension that does not resolve to
//     <app>: the API reports success even when LaunchServices ignores the
//     preference (it does for an app under /tmp). [LAW:verifiable-goals]
import AppKit
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write("launchservices: \(message)\n".data(using: .utf8)!)
  exit(1)
}

func appPath(_ bundleID: String) {
  guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
    fail("no app with bundle id \(bundleID) is installed")
  }
  print(url.path)
}

func setDefault(app: URL, extensions: [String]) {
  let types = extensions.map { ext -> (String, UTType) in
    guard let type = UTType(filenameExtension: ext) else { fail("no content type for .\(ext)") }
    return (ext, type)
  }
  let group = DispatchGroup()
  var errors: [String] = []
  for (ext, type) in types {
    group.enter()
    NSWorkspace.shared.setDefaultApplication(at: app, toOpen: type) { error in
      DispatchQueue.main.async {
        if let error { errors.append(".\(ext) (\(type.identifier)): \(error.localizedDescription)") }
        group.leave()
      }
    }
  }
  // The completion handlers hop to the main queue, so spin the run loop until they all land.
  while group.wait(timeout: .now()) == .timedOut {
    RunLoop.main.run(until: Date().addingTimeInterval(0.05))
  }
  let target = app.resolvingSymlinksInPath().path
  for (ext, type) in types {
    let actual = NSWorkspace.shared.urlForApplication(toOpen: type)?.resolvingSymlinksInPath().path ?? "nothing"
    if actual != target { errors.append(".\(ext) (\(type.identifier)) opens with \(actual)") }
  }
  if !errors.isEmpty { fail("not the default for:\n  " + errors.joined(separator: "\n  ")) }
  // A default belongs to the content type, so report every extension whose type was claimed, not just the ones
  // asked for. A tag alone isn't enough: com.microsoft.typescript carries "ts", but .ts resolves to MPEG-2 video.
  let claimedTypes = Set(types.map { $0.1 })
  let claimed = Set(types.flatMap { $0.1.tags[.filenameExtension] ?? [] })
    .filter { UTType(filenameExtension: $0).map(claimedTypes.contains) ?? false }.sorted()
  print("\(app.lastPathComponent) opens \(claimed.count) extensions: " + claimed.map { ".\($0)" }.joined(separator: " "))
}

let args = Array(CommandLine.arguments.dropFirst())
switch (args.first, args.count) {
case ("app-path", 2): appPath(args[1])
case ("set-default", 3...): setDefault(app: URL(fileURLWithPath: args[1]), extensions: Array(args[2...]))
default: fail("usage: app-path <bundle-id> | set-default <app> <extension>...")
}
