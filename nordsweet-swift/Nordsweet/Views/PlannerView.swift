import SwiftUI
import Charts
import NordsweetCore

struct PlannerView: View {
    @EnvironmentObject private var store: FlightStore
    @State private var airportTarget: AirportTarget?
    enum AirportTarget: String, Identifiable { case departure,destination; var id: String { rawValue } }
    var body: some View {
        Form {
            Section("Trasa") {
                Button { airportTarget = .departure } label: { LabeledContent("Odlot",value:store.departure) }
                Button { airportTarget = .destination } label: { LabeledContent("Przylot",value:store.destination) }
                TextField("Punkty pośrednie, np. DCT ABAKU",text:$store.via).textInputAutocapitalization(.characters).autocorrectionDisabled()
                NumberField(title:"Wysokość [ft]",value:$store.altitude)
                NumberField(title:"Prędkość [kt]",value:$store.speed)
            }
            Section {
                NumberField(title:"Wznoszenie [ft/NM]",value:$store.climb)
                NumberField(title:"Zniżanie [ft/NM]",value:$store.descent)
            } header: { Text("Profil planistyczny") } footer: { Text("Podaj gradienty dla planowanego lotu. Ta wersja nie wyznacza ich automatycznie z osiągów samolotu ani nie rozwija SID/STAR i dróg lotniczych.") }
            Button("Wyznacz trasę i TOC/TOD") { store.buildPlan() }.font(.headline)
            if let plan = store.selected {
                Section(plan.name) {
                    LabeledContent("Dystans",value:String(format:"%.1f NM",plan.distanceNM))
                    LabeledContent("ETE bez wiatru",value:String(format:"%.0f min",plan.timeMinutes))
                    Chart(profileSamples(plan),id:\.index) { sample in
                        LineMark(x:.value("NM",sample.distance),y:.value("ft",sample.altitude)).foregroundStyle(.cyan)
                        if ["TOC","TOD"].contains(sample.code) { PointMark(x:.value("NM",sample.distance),y:.value("ft",sample.altitude)).annotation { Text(sample.code).font(.caption2) } }
                    }.frame(height:180)
                    ForEach(Array(plan.points.enumerated()),id:\.offset) { row in LabeledContent(row.element.code,value:row.element.altitudeFt.map{String(format:"%.0f ft",$0)} ?? "—") }
                    Button("Zapisz lot") { store.saveSelected() }
                }
            }
        }.navigationTitle("Plan lotu")
        .sheet(item:$airportTarget) { target in
            AirportPicker(airports:store.airports) { airport in
                if target == .departure { store.departure = airport.icao } else { store.destination = airport.icao }; airportTarget = nil
            }
        }
    }
    struct Sample { let index: Int; let distance,altitude: Double; let code: String }
    private func profileSamples(_ plan: FlightPlan) -> [Sample] {
        var distance = 0.0
        return plan.points.enumerated().map { index,point in
            if index > 0 { distance += Navigation.distanceNM(plan.points[index-1],point) }
            return Sample(index:index,distance:distance,altitude:point.altitudeFt ?? plan.cruiseAltitudeFt,code:point.code)
        }
    }
}
struct AirportPicker: View {
    let airports: [Airport]; let select: (Airport)->Void
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List(airports.filter{query.isEmpty || $0.icao.localizedCaseInsensitiveContains(query) || $0.name.localizedCaseInsensitiveContains(query)}) { airport in
                Button { select(airport) } label: { VStack(alignment:.leading) { Text(airport.icao).font(.headline); Text(airport.name).foregroundStyle(.secondary) } }
            }.searchable(text:$query).navigationTitle("Lotnisko").toolbar { Button("Zamknij") { dismiss() } }
        }
    }
}
