// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "NordsweetCore", platforms: [.iOS(.v17), .macOS(.v13)], products: [.library(name: "NordsweetCore", targets: ["NordsweetCore"])], targets: [
    .target(name: "NordsweetCore", resources: [.process("Resources")]),
    .testTarget(name: "NordsweetCoreTests", dependencies: ["NordsweetCore"], resources: [.process("Fixtures")])
])
