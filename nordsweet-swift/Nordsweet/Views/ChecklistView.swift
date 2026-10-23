import SwiftUI
import NordsweetCore

private struct ChecklistAircraft: Decodable, Identifiable {
    let id,type,name: String
    let checklists: [Checklist]
    struct Checklist: Decodable, Identifiable {
        let id,name: String
        let sections: [ChecklistSection]
    }
    struct ChecklistSection: Decodable, Identifiable {
        let id,title: String
        let items: [Item]
    }
    struct Item: Decodable { let action: String; let expected: String? }
}
struct ChecklistView: View {
    @State private var aircraft: [ChecklistAircraft] = []
    @State private var selected = ""
    @State private var error: String?
    @State private var resetting = false
    @AppStorage("nordsweet.checklist.checked.v1") private var checkedJSON = "[]"
    private var checked: Set<String> { Set((try? JSONDecoder().decode([String].self,from:Data(checkedJSON.utf8))) ?? []) }
    var body: some View {
        List {
            Picker("Samolot",selection:$selected) { ForEach(aircraft) { Text($0.name).tag($0.id) } }
            if let error { Text(error).foregroundStyle(.orange) }
            if let profile = aircraft.first(where:{$0.id == selected}) {
                ForEach(profile.checklists) { checklist in
                    Section(checklist.name) {
                        ForEach(checklist.sections) { section in
                            if !section.title.isEmpty { Text(section.title).font(.subheadline).foregroundStyle(.secondary) }
                            ForEach(Array(section.items.enumerated()),id:\.offset) { row in
                                let key = "\(profile.id)/\(checklist.id)/\(section.id)/\(row.offset)"
                                Button { toggle(key) } label: {
                                    HStack {
                                        Image(systemName:checked.contains(key) ? "checkmark.circle.fill" : "circle").foregroundStyle(checked.contains(key) ? Color.cyan : Color.secondary)
                                        VStack(alignment:.leading) { Text(row.element.action).foregroundStyle(.primary); if let expected = row.element.expected { Text(expected).font(.caption).foregroundStyle(.secondary) } }
                                    }
                                }.accessibilityLabel(row.element.action).accessibilityValue(checked.contains(key) ? "Wykonane" : "Niewykonane")
                            }
                        }
                    }
                }
            }
        }.navigationTitle("Checklisty")
        .toolbar { Button("Reset") { resetting = true } }
        .confirmationDialog("Wyczyścić zaznaczenia tego samolotu?",isPresented:$resetting) {
            Button("Wyczyść",role:.destructive) { save(checked.filter{!$0.hasPrefix(selected+"/")}) }
        }
        .task { do { aircraft = try Catalog.load("checklists",as:[ChecklistAircraft].self); selected = aircraft.first?.id ?? "" } catch { self.error = error.localizedDescription } }
    }
    private func toggle(_ key: String) { var next = checked; if next.contains(key) { next.remove(key) } else { next.insert(key) }; save(next) }
    private func save(_ values: Set<String>) { if let data = try? JSONEncoder().encode(values.sorted()), let string = String(data:data,encoding:.utf8) { checkedJSON = string } }
}
