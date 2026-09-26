import XCTest
import Foundation
@testable import NordsweetCore

final class CoreTests: XCTestCase {
    func testTakeoffMatchesExistingJavaScript() throws {
        struct Fixture: Decodable { let weight,altitude,temperature,headwind,slope,groundRollM,obstacle50ftM: Double; let paved: Bool }
        let fixtures = try JSONDecoder().decode([Fixture].self,from:Data(contentsOf:Bundle.module.url(forResource:"takeoff-oracle",withExtension:"json")!))
        let table = try Catalog.load("p2006t-takeoff",as:PerformanceTable.self)
        for f in fixtures {
            let result = try Performance.takeoff(table:table,weight:f.weight,pressureAltitude:f.altitude,temperature:f.temperature,headwind:f.headwind,paved:f.paved,slope:f.slope)
            XCTAssertEqual(result.groundRollM,f.groundRollM,accuracy:0.000001)
            XCTAssertEqual(result.obstacle50ftM,f.obstacle50ftM,accuracy:0.000001)
        }
    }
    func testAirportsAndDistances() throws {
        let airports = try Catalog.airports()
        let a = try XCTUnwrap(airports.first{$0.icao == "EPBC"}), b = try XCTUnwrap(airports.first{$0.icao == "EPPO"})
        XCTAssertEqual(Navigation.distanceNM(a.point,b.point),149.94,accuracy:0.1)
        let points = try Navigation.profile(points:[a.point,b.point],altitude:4000,climbFtPerNM:450,descentFtPerNM:467.39)
        XCTAssertEqual(points.filter{$0.code == "TOC"}.count,1)
        XCTAssertEqual(points.filter{$0.code == "TOD"}.count,1)
    }
    func testInfeasibleProfileFails() {
        XCTAssertThrowsError(try Navigation.profile(points:[RoutePoint(code:"A",lat:52,lon:20),RoutePoint(code:"B",lat:52,lon:20.01)],altitude:10000,climbFtPerNM:100,descentFtPerNM:100))
    }
    func testTOCAtExistingWaypointIsNotLost() throws {
        let a = RoutePoint(code:"A",lat:52,lon:20,altitudeFt:0)
        let fix = RoutePoint(code:"FIX",lat:52,lon:20.2)
        let b = RoutePoint(code:"B",lat:52,lon:23,altitudeFt:0)
        let gradient = 4000 / Navigation.distanceNM(a,fix)
        let points = try Navigation.profile(points:[a,fix,b],altitude:4000,climbFtPerNM:gradient,descentFtPerNM:450)
        XCTAssertEqual(points.filter{$0.code == "TOC"}.count,1)
        XCTAssertEqual(points.filter{$0.code == "FIX"}.count,1)
        let toc = try XCTUnwrap(points.first{$0.code == "TOC"})
        XCTAssertEqual(toc.lat,fix.lat,accuracy:0.000001)
        XCTAssertEqual(toc.lon,fix.lon,accuracy:0.000001)
    }
    func testLegacyNordImportPreservesTOCAndAltitudes() throws {
        let data = Data(#"{"format":"nordsweet.flight","route":{"name":"Example","plan":{"altitudeFt":4000,"cruiseSpeedKt":100,"points":[{"id":"A","lat":52,"lon":20,"altitudeFt":350},{"id":"TOC","lat":52.1,"lon":20.1,"altitudeFt":4000},{"id":"B","lat":53,"lon":21,"altitudeFt":300}]}}}"#.utf8)
        let plan = try FlightCodec.decode(data)
        XCTAssertEqual(plan.points.map(\.code),["A","TOC","B"])
        XCTAssertEqual(plan.points[1].altitudeFt,4000)
    }
    func testFlightRoundTripAndInvalidCoordinates() throws {
        let plan = FlightPlan(name:"A & B",points:[RoutePoint(code:"A",lat:52,lon:20,altitudeFt:300),RoutePoint(code:"B",lat:53,lon:21,altitudeFt:1000)],cruiseAltitudeFt:4000,cruiseSpeedKt:100)
        let native = try FlightCodec.decode(FlightCodec.encode(plan))
        XCTAssertEqual(native.points,plan.points)
        let gpx = try FlightCodec.decode(FlightCodec.gpx(plan))
        XCTAssertEqual(gpx.points.count,2)
        XCTAssertEqual(try XCTUnwrap(gpx.points[0].altitudeFt),300,accuracy:0.001)
        var bad = plan; bad.points[0].lat = 91
        XCTAssertThrowsError(try bad.validate())
    }
}
