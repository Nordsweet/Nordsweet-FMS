import Foundation
import Combine
import CoreLocation
import NordsweetCore

@MainActor
final class FlightStore: ObservableObject {
    @Published var airports: [Airport] = []
    @Published var waypoints: [RoutePoint] = []
    @Published var flights: [FlightPlan] = []
    @Published var selected: FlightPlan?
    @Published var error: String?
    @Published var departure = "EPBC"
    @Published var destination = "EPPO"
    @Published var via = ""
    @Published var altitude = 4000.0
    @Published var speed = 100.0
    @Published var climb = 450.0
    @Published var descent = 467.39384615384614
    private let saveURL: URL
    init() {
        let directory = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("Nordsweet",isDirectory:true)
        saveURL = directory.appendingPathComponent("flights.json")
        do {
            try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
            airports = try Catalog.airports().sorted{$0.icao < $1.icao}
            waypoints = try Catalog.waypoints()
            if FileManager.default.fileExists(atPath:saveURL.path) {
                flights = try JSONDecoder().decode([FlightPlan].self,from:Data(contentsOf:saveURL))
                for flight in flights { try flight.validate() }
                selected = flights.first
            }
        } catch { self.error = error.localizedDescription }
    }
    func buildPlan() {
        do {
            let dep = departure.trimmingCharacters(in:.whitespacesAndNewlines).uppercased(), dest = destination.trimmingCharacters(in:.whitespacesAndNewlines).uppercased()
            guard let a = airports.first(where:{$0.icao.uppercased() == dep}) else { throw FlightError.unknownPoint(dep) }
            guard let b = airports.first(where:{$0.icao.uppercased() == dest}) else { throw FlightError.unknownPoint(dest) }
            let tokens = via.uppercased().split(whereSeparator:{$0.isWhitespace || $0 == ","}).map(String.init).filter{$0 != "DCT"}
            let middle = try tokens.map { code -> RoutePoint in
                if let point = waypoints.first(where:{$0.code == code}) { return point }
                if let airport = airports.first(where:{$0.icao == code}) { return airport.point }
                throw FlightError.unknownPoint(code)
            }
            let points = try Navigation.profile(points:[a.point]+middle+[b.point],altitude:altitude,climbFtPerNM:climb,descentFtPerNM:descent)
            let plan = FlightPlan(name:"\(a.icao) → \(b.icao)",points:points,cruiseAltitudeFt:altitude,cruiseSpeedKt:speed)
            try plan.validate(); selected = plan
        } catch { self.error = error.localizedDescription }
    }
    func saveSelected() {
        guard var plan = selected else { return }
        do {
            try plan.validate(); plan.savedAt = Date()
            var updated = flights.filter{$0.id != plan.id}; updated.insert(plan,at:0)
            try persist(updated); flights = updated; selected = plan
        } catch { self.error = error.localizedDescription }
    }
    func delete(_ offsets: IndexSet) {
        var updated = flights
        for index in offsets.sorted(by:>) { updated.remove(at:index) }
        do { try persist(updated); flights = updated } catch { self.error = error.localizedDescription }
    }
    func importFlight(_ url: URL) {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let size = try url.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0
            guard size <= 10_000_000 else { throw FlightError.invalidData }
            selected = try FlightCodec.decode(Data(contentsOf:url)); saveSelected()
        } catch { self.error = error.localizedDescription }
    }
    private func persist(_ value: [FlightPlan]) throws {
        try JSONEncoder().encode(value).write(to:saveURL,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
    }
}

final class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var fix: CLLocation?
    @Published var status = "GPS wyłączony"
    @Published var active = false
    private let manager = CLLocationManager()
    override init() {
        super.init(); manager.delegate = self; manager.desiredAccuracy = kCLLocationAccuracyBest; manager.distanceFilter = 5
    }
    func toggle() {
        if active { manager.stopUpdatingLocation(); active = false; status = "GPS wyłączony"; return }
        active = true
        if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
        updateAuthorization()
    }
    private func updateAuthorization() {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            if active { manager.startUpdatingLocation(); status = "Oczekiwanie na pozycję…" }
        case .denied, .restricted: active = false; status = "Włącz dostęp do lokalizacji w Ustawieniach iOS."
        default: status = "Oczekiwanie na zgodę na lokalizację…"
        }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { updateAuthorization() }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last, location.horizontalAccuracy >= 0 else { return }
        fix = location; status = "GPS ±\(Int(location.horizontalAccuracy)) m"
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { status = error.localizedDescription }
}
