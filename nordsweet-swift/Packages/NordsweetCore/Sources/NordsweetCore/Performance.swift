import Foundation

public struct PerformanceTable: Decodable {
    public let weightsKg: [String: WeightTable]
    public struct WeightTable: Decodable {
        let pressureAltitudesFt: [Double]
        let temperaturesC: [Double]
        let isaReference: ISA
        let distanceM: Distances
        struct ISA: Decodable { let groundRollM: [Double]; let obstacle50ftM: [Double] }
        struct Distances: Decodable { let groundRoll: [[Double]]; let obstacle50ft: [[Double]] }
    }
}
public struct TakeoffResult {
    public let groundRollM: Double
    public let obstacle50ftM: Double
    public let interpolatedGroundRollM: Double
    public let interpolatedObstacle50ftM: Double
}
public enum Performance {
    private static func bracket(_ values: [Double], _ target: Double) -> (Int, Int, Double) {
        if target <= values[0] { return (0,0,0) }
        let last = values.count-1
        if target >= values[last] { return (last,last,0) }
        for i in 0..<last where target >= values[i] && target <= values[i+1] { return (i,i+1,(target-values[i])/(values[i+1]-values[i])) }
        return (last,last,0)
    }
    private static func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a+(b-a)*t }
    private static func ceiling(_ values: [Double], _ target: Double) -> Int { values.firstIndex(where: {$0 >= target}) ?? values.count-1 }
    private static func points(_ table: PerformanceTable.WeightTable, _ row: Int, _ obstacle: Bool) -> [(Double,Double)] {
        let values = obstacle ? table.distanceM.obstacle50ft[row] : table.distanceM.groundRoll[row]
        let isa = obstacle ? table.isaReference.obstacle50ftM[row] : table.isaReference.groundRollM[row]
        var points = Array(zip(table.temperaturesC,values))
        // JS sorts stably; ISA sits between column 1 and column 2 when temperatures tie.
        points.insert((15-2*table.pressureAltitudesFt[row]/1000,isa),at:2)
        return points.enumerated().sorted { $0.element.0 == $1.element.0 ? $0.offset < $1.offset : $0.element.0 < $1.element.0 }.map(\.element)
    }
    private static func metric(_ table: PerformanceTable.WeightTable, _ altitude: Double, _ temperature: Double, _ obstacle: Bool, conservative: Bool) -> Double {
        if conservative {
            let row = ceiling(table.pressureAltitudesFt,altitude), p = points(table,row,obstacle)
            return p[ceiling(p.map(\.0),temperature)].1
        }
        let (lo,hi,t) = bracket(table.pressureAltitudesFt,altitude)
        func value(_ row: Int) -> Double {
            let p = points(table,row,obstacle), (a,b,r) = bracket(p.map(\.0),temperature)
            return lerp(p[a].1,p[b].1,r)
        }
        return lerp(value(lo),value(hi),t)
    }
    /// Ports the existing P2006T JS implementation, including the conservative table guard.
    public static func takeoff(table: PerformanceTable, weight: Double, pressureAltitude: Double, temperature: Double, headwind: Double, paved: Bool, slope: Double) throws -> TakeoffResult {
        let weights = table.weightsKg.keys.compactMap(Double.init).sorted()
        guard !weights.isEmpty, [weight,pressureAltitude,temperature,headwind,slope].allSatisfy(\.isFinite) else { throw FlightError.invalidData }
        func at(_ i: Int) -> PerformanceTable.WeightTable { table.weightsKg[String(Int(weights[i]))]! }
        let first = at(0)
        guard weight >= weights[0], weight <= weights.last!, pressureAltitude >= first.pressureAltitudesFt[0], pressureAltitude <= first.pressureAltitudesFt.last!, temperature >= first.temperaturesC[0], temperature <= first.temperaturesC.last! else { throw FlightError.outOfRange("Parametry poza zakresem tabel P2006T. Wynik nie jest ekstrapolowany.") }
        let (lo,hi,t) = bracket(weights,weight), upper = at(ceiling(weights,weight))
        func corrected(_ distance: Double, _ obstacle: Bool) -> Double {
            var value = distance + (headwind > 0 ? -2.5*headwind : -10*headwind)
            if !obstacle { if paved { value *= 0.94 }; value *= 1+max(0,slope)*0.05 }
            return max(0,value)
        }
        func results(_ obstacle: Bool) -> (Double,Double) {
            let interpolated = corrected(lerp(metric(at(lo),pressureAltitude,temperature,obstacle,conservative:false),metric(at(hi),pressureAltitude,temperature,obstacle,conservative:false),t),obstacle)
            let conservative = corrected(metric(upper,pressureAltitude,temperature,obstacle,conservative:true),obstacle)
            return (max(interpolated,conservative),interpolated)
        }
        let ground = results(false), obstacle = results(true)
        return TakeoffResult(groundRollM:ground.0,obstacle50ftM:obstacle.0,interpolatedGroundRollM:ground.1,interpolatedObstacle50ftM:obstacle.1)
    }
}
