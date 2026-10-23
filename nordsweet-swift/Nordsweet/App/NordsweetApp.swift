import SwiftUI

@main
struct NordsweetApp: App {
    @StateObject private var store = FlightStore()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store).tint(.cyan).preferredColorScheme(.dark)
        }
    }
}
