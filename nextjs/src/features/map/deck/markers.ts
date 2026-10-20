import { type DeckMap } from "./deck-map";

type Marker = {
  element: HTMLElement;
  lon: number;
  lat: number;
  interactive?: boolean;
};

/**
 * DOM labels pinned to coordinates (the route's waypoints): real buttons, so they take keyboard
 * focus and screen-reader names, which a drawn layer cannot offer.
 */
export class MarkerLayer {
  private readonly root = document.createElement("div");
  private markers: Marker[] = [];
  private readonly place = () => {
    for (const { element, lon, lat } of this.markers) {
      const { x, y } = this.map.project([lon, lat]);
      // Left-middle of the label sits on the point, lifted 11 px.
      element.style.transform = `translate(${x}px, ${y - 11}px) translateY(-50%)`;
    }
  };

  constructor(
    private readonly map: DeckMap,
    parent: HTMLElement,
  ) {
    Object.assign(this.root.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      pointerEvents: "none",
    });
    parent.append(this.root);
    map.on("move", this.place);
  }

  set(markers: Marker[]) {
    this.root.replaceChildren();
    this.markers = markers;
    for (const { element, interactive } of markers) {
      Object.assign(element.style, {
        position: "absolute",
        left: "0",
        top: "0",
        pointerEvents: interactive === false ? "none" : "auto",
      });
      this.root.append(element);
    }
    this.place();
  }

  setVisible(visible: boolean) {
    this.root.style.display = visible ? "" : "none";
  }

  destroy() {
    this.map.off("move", this.place);
    this.root.remove();
  }
}
