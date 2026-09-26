import SwiftUI
import MapKit
import NordsweetCore

extension RoutePoint { var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude:lat,longitude:lon) } }

struct FlightMapView: View {
    @EnvironmentObject private var store: FlightStore
    @StateObject private var location = LocationService()
    @State private var camera: MapCameraPosition = .region(MKCoordinateRegion(center:CLLocationCoordinate2D(latitude:52.1,longitude:19.4),span:MKCoordinateSpan(latitudeDelta:6,longitudeDelta:8)))
    @State private var satellite = false
    var body: some View {
        Map(position:$camera,interactionModes:[.pan,.zoom,.rotate,.pitch]) {
            if let plan = store.selected {
                MapPolyline(coordinates:plan.points.map(\.coordinate)).stroke(.pink,lineWidth:3)
                ForEach(Array(plan.points.enumerated()),id:\.offset) { entry in
                    Annotation(entry.element.code,coordinate:entry.element.coordinate) {
                        let profile = ["TOC","TOD"].contains(entry.element.code)
                        Image(systemName:profile ? "diamond.fill" : "circle.fill")
                            .font(profile ? .body : .caption2).foregroundStyle(profile ? Color.cyan : Color.white)
                            .padding(4).background(.black.opacity(0.65),in:Circle())
                    }
                }
            }
            if location.active, let fix = location.fix {
                Annotation("Pozycja",coordinate:fix.coordinate) {
                    Image(systemName:"location.north.fill").font(.title2).foregroundStyle(.cyan).rotationEffect(.degrees(max(0,fix.course)))
                }
            }
        }
        .mapStyle(satellite ? .hybrid(elevation:.flat) : .standard(elevation:.flat,pointsOfInterest:.excludingAll))
        .mapControls { MapCompass(); MapScaleView() }
        .safeAreaInset(edge:.bottom) {
            VStack(spacing:8) {
                if let plan = store.selected {
                    HStack { Text(plan.name).font(.headline); Spacer(); Text("\(plan.distanceNM,specifier:"%.1f") NM") }
                    HStack { Text("\(plan.cruiseAltitudeFt,specifier:"%.0f") ft"); Spacer(); Text("ETE \(plan.timeMinutes,specifier:"%.0f") min · bez wiatru").foregroundStyle(.secondary) }.font(.subheadline)
                } else { Text("Zbuduj lub zaimportuj trasę w zakładce Trasa / Loty.").font(.subheadline) }
                HStack {
                    Button { location.toggle() } label: { Label(location.active ? "Wyłącz GPS" : "Włącz GPS",systemImage:"location") }
                    Spacer()
                    Button("Pozycja") { if let fix = location.fix { camera = .region(MKCoordinateRegion(center:fix.coordinate,span:MKCoordinateSpan(latitudeDelta:0.15,longitudeDelta:0.15))) } }.disabled(location.fix == nil)
                    Button("Trasa") { camera = .automatic }.disabled(store.selected == nil)
                }.buttonStyle(.bordered)
                Text(location.status).font(.caption).foregroundStyle(.secondary)
            }.padding().background(.regularMaterial)
        }
        .navigationTitle("Nordsweet").navigationBarTitleDisplayMode(.inline)
        .toolbar { Button { satellite.toggle() } label: { Image(systemName:"square.3.layers.3d") }.accessibilityLabel("Zmień podkład mapy") }
        .onChange(of:store.selected?.id) { _,_ in camera = .automatic }
    }
}
