import SwiftUI
import UniformTypeIdentifiers
import NordsweetCore

struct RootView: View {
    @EnvironmentObject private var store: FlightStore
    var body: some View {
        TabView {
            NavigationStack { FlightMapView() }.tabItem { Label("Mapa",systemImage:"map") }
            NavigationStack { PlannerView() }.tabItem { Label("Trasa",systemImage:"point.topleft.down.to.point.bottomright.curvepath") }
            NavigationStack { PerformanceView() }.tabItem { Label("Osiągi",systemImage:"gauge.with.dots.needle.67percent") }
            NavigationStack { ChecklistView() }.tabItem { Label("Checklisty",systemImage:"checklist") }
            NavigationStack { LibraryView() }.tabItem { Label("Loty",systemImage:"folder") }
        }
        .alert("Nordsweet",isPresented:Binding(get:{store.error != nil},set:{if !$0 {store.error = nil}})) {
            Button("OK",role:.cancel){store.error = nil}
        } message: { Text(store.error ?? "") }
    }
}

struct NumberField: View {
    let title: String
    @Binding var value: Double
    var body: some View {
        HStack { Text(title); Spacer(); TextField(title,value:$value,format:.number).multilineTextAlignment(.trailing).keyboardType(.numbersAndPunctuation).frame(maxWidth:125) }
    }
}

struct FlightFile: FileDocument {
    static var readableContentTypes: [UTType] { [.json,.xml,.data] }
    var data: Data
    init(data: Data = Data()) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw FlightError.invalidData }; self.data = data
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents:data) }
}

struct LibraryView: View {
    @EnvironmentObject private var store: FlightStore
    @State private var importing = false
    @State private var exporting = false
    @State private var document = FlightFile()
    @State private var contentType: UTType = .json
    var body: some View {
        List {
            if let selected = store.selected {
                Section("Aktywna trasa") {
                    Text(selected.name).font(.headline)
                    Button("Zapisz na urządzeniu",systemImage:"square.and.arrow.down") { store.saveSelected() }
                    Button("Eksportuj JSON") { export(selected,gpx:false) }
                    Button("Eksportuj GPX") { export(selected,gpx:true) }
                }
            }
            Section("Zapisane loty") {
                ForEach(store.flights) { flight in
                    Button { store.selected = flight } label: {
                        VStack(alignment:.leading) { Text(flight.name); Text("\(flight.distanceNM,specifier:"%.1f") NM · \(flight.savedAt.formatted(date:.abbreviated,time:.shortened))").font(.caption).foregroundStyle(.secondary) }
                    }
                }.onDelete(perform:store.delete)
                if store.flights.isEmpty { Text("Zapisz trasę albo zaimportuj plik NORD, JSON lub GPX.").foregroundStyle(.secondary) }
            }
        }
        .navigationTitle("Loty")
        .toolbar { Button("Import",systemImage:"square.and.arrow.down") { importing = true } }
        .fileImporter(isPresented:$importing,allowedContentTypes:[.json,.xml,.data]) { result in
            switch result { case .success(let url): store.importFlight(url); case .failure(let error): store.error = error.localizedDescription }
        }
        .fileExporter(isPresented:$exporting,document:document,contentType:contentType,defaultFilename:contentType == .xml ? "Nordsweet.gpx" : "Nordsweet.json") { result in
            if case .failure(let error) = result { store.error = error.localizedDescription }
        }
    }
    private func export(_ plan: FlightPlan,gpx: Bool) {
        do { document = FlightFile(data:try gpx ? FlightCodec.gpx(plan) : FlightCodec.encode(plan)); contentType = gpx ? .xml : .json; exporting = true }
        catch { store.error = error.localizedDescription }
    }
}
