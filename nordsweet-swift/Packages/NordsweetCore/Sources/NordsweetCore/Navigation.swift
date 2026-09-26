import Foundation

public enum Navigation {
    private static func radians(_ value: Double) -> Double { value * .pi / 180 }
    public static func distanceNM(_ a: RoutePoint, _ b: RoutePoint) -> Double {
        let dLat = radians(b.lat - a.lat), dLon = radians(b.lon - a.lon)
        let h = pow(sin(dLat / 2), 2) + cos(radians(a.lat)) * cos(radians(b.lat)) * pow(sin(dLon / 2), 2)
        return 3440.065 * 2 * atan2(sqrt(max(0, min(1, h))), sqrt(max(0, 1 - h)))
    }
    public static func bearing(_ a: RoutePoint, _ b: RoutePoint) -> Double {
        let lon = radians(b.lon - a.lon)
        let y = sin(lon) * cos(radians(b.lat))
        let x = cos(radians(a.lat)) * sin(radians(b.lat)) - sin(radians(a.lat)) * cos(radians(b.lat)) * cos(lon)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }
    public static func wind(runwayHeading: Double, direction: Double, speed: Double) -> (headwind: Double, crosswind: Double) {
        let angle = radians(direction - runwayHeading)
        return (cos(angle) * speed, sin(angle) * speed)
    }
    public static func pressureAltitude(elevation: Double, qnh: Double) -> Double { elevation + (1013 - qnh) * 30 }
    public static func densityAltitude(pressureAltitude: Double, temperature: Double) -> Double { pressureAltitude + 120 * (temperature - (15 - 2 * pressureAltitude / 1000)) }

    /// Great-circle interpolation; profile points can coincide with route fixes without deleting either label.
    public static func interpolate(_ a: RoutePoint, _ b: RoutePoint, ratio: Double, code: String, altitude: Double) -> RoutePoint {
        let t = max(0, min(1, ratio)), d = distanceNM(a, b) / 3440.065
        guard d > 0.0000001, abs(sin(d)) > 0.0000001 else { return RoutePoint(code: code, lat: a.lat, lon: a.lon, altitudeFt: altitude) }
        let f = sin((1-t)*d)/sin(d), g = sin(t*d)/sin(d)
        let x = f*cos(radians(a.lat))*cos(radians(a.lon)) + g*cos(radians(b.lat))*cos(radians(b.lon))
        let y = f*cos(radians(a.lat))*sin(radians(a.lon)) + g*cos(radians(b.lat))*sin(radians(b.lon))
        let z = f*sin(radians(a.lat)) + g*sin(radians(b.lat))
        return RoutePoint(code: code, lat: atan2(z, sqrt(x*x+y*y))*180 / .pi, lon: atan2(y,x)*180 / .pi, altitudeFt: altitude)
    }

    public static func profile(points: [RoutePoint], altitude: Double, climbFtPerNM: Double, descentFtPerNM: Double) throws -> [RoutePoint] {
        guard points.count >= 2, points.allSatisfy(\.isValid), altitude.isFinite, altitude >= 0, climbFtPerNM.isFinite, climbFtPerNM > 0, descentFtPerNM.isFinite, descentFtPerNM > 0 else { throw FlightError.invalidData }
        let distances = zip(points, points.dropFirst()).map { distanceNM($0.0, $0.1) }
        let total = distances.reduce(0, +)
        guard total > 0 else { throw FlightError.invalidData }
        let departure = points[0].altitudeFt ?? 0, arrival = points[points.count-1].altitudeFt ?? 0
        let toc = max(0, altitude - departure) / climbFtPerNM
        let tod = total - max(0, altitude - arrival) / descentFtPerNM
        guard altitude >= max(departure, arrival), toc <= tod else { throw FlightError.outOfRange("Wybrana wysokość nie jest osiągalna przy tej trasie i zadanych gradientach wznoszenia/zniżania.") }
        let events = [(toc, "TOC"), (tod, "TOD")].filter { $0.0 > 0 && $0.0 < total }.sorted { $0.0 < $1.0 }
        var result = [points[0]], start = 0.0
        for index in distances.indices {
            let length = distances[index], end = start + length
            for event in events where event.0 > start && event.0 <= end && length > 0 {
                result.append(interpolate(points[index], points[index+1], ratio: (event.0-start)/length, code: event.1, altitude: altitude))
            }
            var next = points[index+1]
            next.altitudeFt = min(altitude, departure + end*climbFtPerNM, arrival + (total-end)*descentFtPerNM)
            result.append(next); start = end
        }
        return result
    }
}
