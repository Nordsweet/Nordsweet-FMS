import Foundation

public struct Airport: Codable, Identifiable, Hashable {
    public var id: String { icao }
    public let icao: String
    public let name: String
    public let elevation: Double?
    public let lat: Double
    public let lon: Double
    public var point: RoutePoint { RoutePoint(code: icao, name: name, lat: lat, lon: lon, altitudeFt: elevation) }
}

public struct RoutePoint: Codable, Equatable {
    public var code: String
    public var name: String
    public var lat: Double
    public var lon: Double
    public var altitudeFt: Double?
    public init(code: String, name: String = "", lat: Double, lon: Double, altitudeFt: Double? = nil) {
        self.code = code; self.name = name; self.lat = lat; self.lon = lon; self.altitudeFt = altitudeFt
    }
    public var isValid: Bool { lat.isFinite && lon.isFinite && (-90...90).contains(lat) && (-180...180).contains(lon) && (altitudeFt?.isFinite ?? true) }
}

public struct FlightPlan: Codable, Identifiable {
    public var id: UUID
    public var name: String
    public var points: [RoutePoint]
    public var cruiseAltitudeFt: Double
    public var cruiseSpeedKt: Double
    public var savedAt: Date
    public init(name: String, points: [RoutePoint], cruiseAltitudeFt: Double, cruiseSpeedKt: Double) {
        id = UUID(); self.name = name; self.points = points; self.cruiseAltitudeFt = cruiseAltitudeFt; self.cruiseSpeedKt = cruiseSpeedKt; savedAt = Date()
    }
    public var distanceNM: Double { zip(points, points.dropFirst()).reduce(0) { $0 + Navigation.distanceNM($1.0, $1.1) } }
    public var timeMinutes: Double { cruiseSpeedKt > 0 ? distanceNM / cruiseSpeedKt * 60 : 0 }
    public func validate() throws {
        guard points.count >= 2, points.count <= 10000, points.allSatisfy(\.isValid), cruiseAltitudeFt.isFinite, cruiseAltitudeFt >= 0, cruiseSpeedKt.isFinite, cruiseSpeedKt > 0 else { throw FlightError.invalidData }
    }
}

public enum FlightError: LocalizedError {
    case invalidData, unknownPoint(String), outOfRange(String)
    public var errorDescription: String? {
        switch self {
        case .invalidData: return "Nieprawidłowe dane lotu. Wymagane są co najmniej dwa punkty i poprawne współrzędne."
        case .unknownPoint(let code): return "Nie znaleziono punktu: \(code)."
        case .outOfRange(let message): return message
        }
    }
}

public enum Catalog {
    public static func load<T: Decodable>(_ name: String, as type: T.Type) throws -> T {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json") else { throw FlightError.invalidData }
        return try JSONDecoder().decode(type, from: Data(contentsOf: url))
    }
    public static func airports() throws -> [Airport] { try load("airports", as: [Airport].self) }
    public static func waypoints() throws -> [RoutePoint] { try load("waypoints", as: [RoutePoint].self) }
}
