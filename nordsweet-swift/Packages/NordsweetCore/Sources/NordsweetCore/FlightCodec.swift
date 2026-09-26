import Foundation
#if canImport(FoundationXML)
import FoundationXML
#endif

public enum FlightCodec {
    public static func encode(_ plan: FlightPlan) throws -> Data {
        try plan.validate()
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; encoder.dateEncodingStrategy = .iso8601
        return try encoder.encode(plan)
    }
    public static func decode(_ data: Data) throws -> FlightPlan {
        guard data.count <= 10_000_000 else { throw FlightError.invalidData }
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        if let plan = try? decoder.decode(FlightPlan.self,from:data) { try plan.validate(); return plan }
        if let object = try? JSONSerialization.jsonObject(with:data) as? [String:Any], let route = object["route"] as? [String:Any], let plan = route["plan"] as? [String:Any], let rows = plan["points"] as? [[String:Any]] {
            func number(_ value: Any?) -> Double? {
                if let v = value as? NSNumber { return v.doubleValue }
                if let v = value as? String { return Double(v) }
                return nil
            }
            let points = try rows.map { row -> RoutePoint in
                guard let lat = number(row["lat"]), let lon = number(row["lon"]) else { throw FlightError.invalidData }
                return RoutePoint(code: (row["id"] as? String) ?? "PT", name: (row["name"] as? String) ?? "", lat: lat, lon: lon, altitudeFt: number(row["altitudeFt"]))
            }
            let result = FlightPlan(name: (route["name"] as? String) ?? "Import", points: points, cruiseAltitudeFt: number(plan["altitudeFt"]) ?? 0, cruiseSpeedKt: number(plan["cruiseSpeedKt"]) ?? 100)
            try result.validate(); return result
        }
        let delegate = GPXReader(), parser = XMLParser(data:data)
        parser.shouldResolveExternalEntities = false; parser.delegate = delegate
        guard parser.parse(), !delegate.invalid, delegate.points.count >= 2 else { throw FlightError.invalidData }
        let result = FlightPlan(name:"Import GPX",points:delegate.points,cruiseAltitudeFt:delegate.points.compactMap(\.altitudeFt).max() ?? 0,cruiseSpeedKt:100)
        try result.validate(); return result
    }
    public static func gpx(_ plan: FlightPlan) throws -> Data {
        try plan.validate()
        func escape(_ text: String) -> String { text.replacingOccurrences(of:"&",with:"&amp;").replacingOccurrences(of:"<",with:"&lt;").replacingOccurrences(of:">",with:"&gt;").replacingOccurrences(of:"\"",with:"&quot;") }
        let rows = plan.points.map { point in
            "<rtept lat=\"\(point.lat)\" lon=\"\(point.lon)\"><name>\(escape(point.code))</name>" + (point.altitudeFt.map { "<ele>\($0 * 0.3048)</ele>" } ?? "") + "</rtept>"
        }.joined(separator:"\n")
        return Data("<?xml version=\"1.0\" encoding=\"UTF-8\"?><gpx version=\"1.1\" creator=\"Nordsweet\" xmlns=\"http://www.topografix.com/GPX/1/1\"><rte><name>\(escape(plan.name))</name>\(rows)</rte></gpx>".utf8)
    }
}
private final class GPXReader: NSObject, XMLParserDelegate {
    var points: [RoutePoint] = [], invalid = false
    private var point: RoutePoint?, text = "", segments = 0
    func parser(_ parser: XMLParser, didStartElement element: String, namespaceURI: String?, qualifiedName: String?, attributes: [String:String]) {
        text = ""
        if element == "trkseg" { segments += 1; if segments > 1 { invalid = true } }
        if ["rtept","trkpt"].contains(element) {
            guard let lat = Double(attributes["lat"] ?? ""), let lon = Double(attributes["lon"] ?? ""), points.count < 10000 else { invalid = true; parser.abortParsing(); return }
            point = RoutePoint(code:"PT\(points.count+1)",lat:lat,lon:lon)
        }
    }
    func parser(_ parser: XMLParser, foundCharacters string: String) { text += string }
    func parser(_ parser: XMLParser, didEndElement element: String, namespaceURI: String?, qualifiedName: String?) {
        if element == "name", point != nil { point?.code = text.trimmingCharacters(in:.whitespacesAndNewlines) }
        if element == "ele", let meters = Double(text.trimmingCharacters(in:.whitespacesAndNewlines)) { point?.altitudeFt = meters / 0.3048 }
        if ["rtept","trkpt"].contains(element), let value = point { points.append(value); point = nil }
        text = ""
    }
}
