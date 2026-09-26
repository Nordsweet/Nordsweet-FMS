import SwiftUI
import NordsweetCore

struct PerformanceView: View {
    @State private var weight = 1100.0
    @State private var elevation = 350.0
    @State private var qnh = 1013.0
    @State private var temperature = 15.0
    @State private var headwind = 0.0
    @State private var slope = 0.0
    @State private var tora = 1000.0
    @State private var paved = false
    @State private var table: PerformanceTable?
    @State private var loadError: String?
    private var pa: Double { Navigation.pressureAltitude(elevation:elevation,qnh:qnh) }
    private var result: Result<TakeoffResult,Error> {
        Result {
            guard let table else { throw FlightError.invalidData }
            guard qnh >= 800, qnh <= 1100, tora.isFinite, tora > 0 else { throw FlightError.outOfRange("Podaj poprawne QNH i dodatnią TORA.") }
            return try Performance.takeoff(table:table,weight:weight,pressureAltitude:pa,temperature:temperature,headwind:headwind,paved:paved,slope:slope)
        }
    }
    var body: some View {
        Form {
            Section("Tecnam P2006T · start") {
                NumberField(title:"Masa [kg]",value:$weight)
                NumberField(title:"Elewacja [ft]",value:$elevation)
                NumberField(title:"QNH [hPa]",value:$qnh)
                NumberField(title:"Temperatura [°C]",value:$temperature)
            }
            Section {
                NumberField(title:"Wiatr czołowy [kt]",value:$headwind)
                NumberField(title:"Nachylenie [%]",value:$slope)
                NumberField(title:"TORA [m]",value:$tora)
                Toggle("Nawierzchnia utwardzona",isOn:$paved)
            } header: { Text("Pas i wiatr") } footer: { Text("Ujemny wiatr oznacza wiatr tylny. Dodatnie nachylenie oznacza start pod górę. Pozostała nawierzchnia w tabelach: trawa.") }
            Section("Warunki") {
                LabeledContent("Pressure altitude",value:String(format:"%.0f ft",pa))
                LabeledContent("Density altitude",value:String(format:"%.0f ft",Navigation.densityAltitude(pressureAltitude:pa,temperature:temperature)))
            }
            Section("Wynik tabelaryczny") {
                if let loadError { Text(loadError).foregroundStyle(.orange) }
                else {
                    switch result {
                    case .success(let value):
                        metric("Rozbieg",value.groundRollM)
                        metric("Dystans do 50 ft",value.obstacle50ftM)
                        metric("TORA minus rozbieg",tora-value.groundRollM)
                        Text("Wynik uwzględnia konserwatywny odczyt tabeli z dotychczasowej aplikacji. Nie obejmuje dodatkowego współczynnika operacyjnego.").font(.footnote).foregroundStyle(.secondary)
                    case .failure(let error): Text(error.localizedDescription).foregroundStyle(.orange)
                    }
                }
            }
        }.navigationTitle("Osiągi")
        .task { do { table = try Catalog.load("p2006t-takeoff",as:PerformanceTable.self) } catch { loadError = error.localizedDescription } }
    }
    private func metric(_ label: String,_ value: Double) -> some View { LabeledContent(label,value:String(format:"%.0f m",value)) }
}
