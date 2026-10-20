import {
  Deck,
  FlyToInterpolator,
  LinearInterpolator,
  WebMercatorViewport,
  type Layer,
  type MapViewState,
  type PickingInfo,
} from "@deck.gl/core";
import { cachedTerrainElevation } from "~/api/terrain";

export type LngLat = { lng: number; lat: number };
export type Point = { x: number; y: number };
export type Bounds = [[number, number], [number, number]];
type Target = Partial<
  Pick<MapViewState, "longitude" | "latitude" | "zoom" | "bearing">
>;

type Events = {
  move: undefined;
  moveend: undefined;
  resize: undefined;
  dragstart: undefined;
  click: { point: Point; lngLat: LngLat };
  mousemove: { point: Point; lngLat: LngLat };
};
type Listener<K extends keyof Events> = (event: Events[K]) => void;

const MAX_ZOOM = 22;
/** A view change is "ended" once it has been still this long; wheel zoom has no end event of its own. */
const SETTLE_MS = 150;
const PICK_RADIUS = 10;
/** A touchpad pinch arrives as ctrl+wheel events with tiny deltas (MapLibre scales them up 10x too). */
const PINCH_GAIN = 12;
/** A press that moves further than this is a drag, not a click. */
const CLICK_TOLERANCE_PX = 5;
const FLY = new FlyToInterpolator({ speed: 1.6 });
const EASE = new LinearInterpolator([
  "longitude",
  "latitude",
  "zoom",
  "bearing",
]);
// Following supplies the centre for every zoom frame; only zoom belongs to the transition.
const FOLLOW_ZOOM = new LinearInterpolator(["zoom"]);

/**
 * The map: a deck.gl `Deck` with a Web Mercator view (the OSM tiles and every overlay are layers).
 * It owns the camera and exposes the few calls the rest of the app needs (project, fit, follow, pick).
 */
export class DeckMap {
  private readonly deck: Deck;
  private view: MapViewState;
  private viewport: WebMercatorViewport | null = null;
  private readonly listeners = new Map<
    keyof Events,
    Set<(event: never) => void>
  >();
  private readonly observer: ResizeObserver;
  private settle = 0;
  private pressed: Point | null = null;
  private following = false;
  private touches = 0;
  private singleTouch: Point | null = null;
  private followTarget: {
    position: [number, number];
    bearing: number;
    anchor: [number, number];
  } | null = null;
  /** True while a gesture or its inertia is running. */
  interacting = false;
  private fitted: { bounds: Bounds; padding: number } | null;

  constructor(
    private readonly container: HTMLElement,
    options: { bounds: Bounds; padding: number; onLoad: () => void },
  ) {
    this.fitted = { bounds: options.bounds, padding: options.padding };
    this.view = {
      ...this.fit(options.bounds, { padding: options.padding }),
      bearing: 0,
      pitch: 0,
      minPitch: 0,
      maxPitch: 0,
      minZoom: 0,
      maxZoom: MAX_ZOOM,
    };
    this.deck = new Deck({
      parent: container as HTMLDivElement,
      style: { position: "absolute", left: "0", top: "0" },
      viewState: this.view,
      controller: {
        scrollZoom: { speed: 0.01, smooth: true },
        dragRotate: true,
        touchRotate: false,
        inertia: true,
      },
      // Everything is flat and drawn in layer order: depth testing would only hide coplanar layers.
      parameters: { depthCompare: "always", depthWriteEnabled: false },
      pickingRadius: PICK_RADIUS,
      getCursor: ({ isDragging, isHovering }) =>
        isDragging ? "grabbing" : isHovering ? "pointer" : "grab",
      onViewStateChange: ({ viewState, interactionState }) => {
        if (this.following && interactionState.isZooming && this.followTarget) {
          const target = this.followTarget;
          this.setView({
            ...this.anchoredView(
              { ...viewState, pitch: this.view.pitch },
              target.position,
              target.bearing,
              target.anchor,
            ),
            transitionInterpolator: FOLLOW_ZOOM,
          });
        } else this.setView(viewState);
      },
      onInteractionStateChange: (state) => {
        const was = this.interacting;
        this.interacting = [
          state.isDragging,
          state.isZooming,
          state.isRotating,
          state.inTransition,
        ].some(Boolean);
        if (was && !this.interacting) this.emit("moveend", undefined);
        if (state.isDragging && !state.isZooming && this.touches === 0)
          this.emit("dragstart", undefined);
      },
      onHover: (info) => {
        if (info.x < 0 || info.y < 0) return;
        this.emit("mousemove", this.at(info));
      },
      onLoad: options.onLoad,
    });
    // deck.gl's own click gesture must finish within 250 ms of the press, and it picks on the press:
    // the first pick compiles shaders, so a quick tap could be dropped. The browser's click is robust.
    container.addEventListener("wheel", this.onWheel, { capture: true });
    container.addEventListener("pointerdown", this.onPointerDown);
    container.addEventListener("touchstart", this.onTouchCount, {
      capture: true,
      passive: true,
    });
    container.addEventListener("touchend", this.onTouchCount, {
      capture: true,
      passive: true,
    });
    container.addEventListener("touchcancel", this.onTouchCount, {
      capture: true,
      passive: true,
    });
    container.addEventListener("touchmove", this.onTouchMove, {
      capture: true,
      passive: true,
    });
    container.addEventListener("click", this.onClick);
    this.observer = new ResizeObserver(() => {
      this.viewport = null;
      // Until the user moves the map, a late layout (embedded screens) still shows the whole country.
      if (this.fitted)
        this.setView(
          { ...this.view, ...this.fit(this.fitted.bounds, this.fitted) },
          true,
        );
      this.emit("resize", undefined);
      this.emit("move", undefined);
    });
    this.observer.observe(container);
  }

  // Runs before deck.gl reads the event, which takes `deltaY` as is.
  private readonly onWheel = (event: WheelEvent) => {
    if (event.ctrlKey)
      Object.defineProperty(event, "deltaY", {
        value: event.deltaY * PINCH_GAIN,
      });
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pressed = { x: event.clientX, y: event.clientY };
  };
  private readonly onTouchCount = (event: TouchEvent) => {
    this.touches = event.touches.length;
    const touch = event.touches[0];
    this.singleTouch =
      this.touches === 1 && touch
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  };
  private readonly onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (
      event.touches.length === 1 &&
      touch &&
      this.singleTouch &&
      Math.hypot(
        touch.clientX - this.singleTouch.x,
        touch.clientY - this.singleTouch.y,
      ) > CLICK_TOLERANCE_PX
    ) {
      this.following = false;
      this.singleTouch = null;
      this.emit("dragstart", undefined);
    }
  };
  setFollowing(enabled: boolean) {
    this.following = enabled;
  }

  private readonly onClick = (event: MouseEvent) => {
    if (event.target !== this.deck.getCanvas()) return;
    const { pressed } = this;
    if (
      pressed &&
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) >
        CLICK_TOLERANCE_PX
    )
      return;
    const rect = this.container.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    this.emit("click", { point, lngLat: this.unproject(point) });
  };

  on<K extends keyof Events>(event: K, listener: Listener<K>) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<K>) {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.listeners
      .get(event)
      ?.forEach((listener) => (listener as Listener<K>)(payload));
  }

  private at(info: PickingInfo) {
    const point = { x: info.x, y: info.y };
    return { point, lngLat: this.unproject(point) };
  }

  private setView(view: MapViewState, keepFit = false) {
    if (!keepFit) this.fitted = null;
    const height =
      (view.maxPitch ?? 0) > 0
        ? (cachedTerrainElevation({
            lat: view.latitude,
            lon: view.longitude,
          }) ??
          view.position?.[2] ??
          0)
        : 0;
    this.view = { ...view, position: [0, 0, height] };
    this.viewport = null;
    this.deck.setProps({ viewState: this.view });
    this.emit("move", undefined);
    clearTimeout(this.settle);
    this.settle = window.setTimeout(
      () => this.emit("moveend", undefined),
      SETTLE_MS,
    );
  }

  private get size() {
    return {
      width: this.container.clientWidth || 1,
      height: this.container.clientHeight || 1,
    };
  }

  private current() {
    return (this.viewport ??= new WebMercatorViewport({
      ...this.view,
      ...this.size,
    }));
  }

  project(position: [number, number]): Point {
    const height =
      (this.view.maxPitch ?? 0) > 0
        ? (cachedTerrainElevation({ lon: position[0], lat: position[1] }) ?? 0)
        : 0;
    const [x, y] = this.current().project([position[0], position[1], height]);
    return { x: x!, y: y! };
  }

  unproject(point: Point): LngLat {
    if ((this.view.maxPitch ?? 0) > 0) {
      const picked = this.deck.pickObject({
        ...point,
        layerIds: ["terrain"],
        unproject3D: true,
      });
      if (picked?.coordinate)
        return { lng: picked.coordinate[0]!, lat: picked.coordinate[1]! };
    }
    const [lng, lat] = this.current().unproject([point.x, point.y], {
      targetZ: this.view.position?.[2] ?? 0,
    });
    return { lng: lng!, lat: lat! };
  }

  getCenter(): LngLat & { elevationM: number } {
    return {
      lng: this.view.longitude,
      lat: this.view.latitude,
      elevationM: this.view.position?.[2] ?? 0,
    };
  }
  getZoom() {
    return this.view.zoom;
  }
  getBearing() {
    return this.view.bearing ?? 0;
  }
  setTerrain(enabled: boolean) {
    if ((this.view.maxPitch ?? 0) === (enabled ? 60 : 0)) return;
    this.deck.setProps({
      parameters: {
        depthCompare: enabled ? "less-equal" : "always",
        depthWriteEnabled: enabled,
      },
    });
    this.setView({
      ...this.view,
      pitch: enabled ? 45 : 0,
      maxPitch: enabled ? 60 : 0,
    });
  }
  terrainChanged() {
    if ((this.view.maxPitch ?? 0) > 0) {
      const height = cachedTerrainElevation({
        lat: this.view.latitude,
        lon: this.view.longitude,
      });
      if (
        height !== null &&
        Math.abs(height - (this.view.position?.[2] ?? 0)) > 1
      )
        this.setView(this.view);
      else this.emit("move", undefined);
    }
  }
  getSize() {
    return this.size;
  }
  /** West, south, east, north of the visible area. */
  getBounds() {
    return this.current().getBounds({ z: this.view.position?.[2] ?? 0 });
  }

  private fit(bounds: Bounds, options: { padding?: number; maxZoom?: number }) {
    const padding = options.padding ?? 0;
    // Not laid out yet (hidden, or the CSS is still loading): fit a typical screen, then refit on resize.
    const measured = this.size;
    const { width, height } =
      measured.width > 2 * padding + 1 && measured.height > 2 * padding + 1
        ? measured
        : { width: 800, height: 600 };
    const { longitude, latitude, zoom } = new WebMercatorViewport({
      width,
      height,
      longitude: 0,
      latitude: 0,
      zoom: 0,
    }).fitBounds(bounds, { padding, maxZoom: options.maxZoom });
    return { longitude, latitude, zoom };
  }

  jumpTo(target: Target) {
    this.setView({
      ...this.view,
      ...target,
      transitionDuration: 0,
    });
  }

  /** Animate to `target`: a fly-to for long hops (search), an ease for short ones. */
  animateTo(target: Target, durationMs: number, fly = false) {
    this.fitted = null;
    this.deck.setProps({
      viewState: {
        ...this.view,
        ...target,
        transitionDuration: durationMs,
        transitionInterpolator: fly ? FLY : EASE,
      },
    });
  }

  fitBounds(
    bounds: Bounds,
    options: {
      padding?: number;
      maxZoom?: number;
      bearing?: number;
      duration?: number;
    } = {},
  ) {
    const target: Target = this.fit(bounds, options);
    if (options.bearing !== undefined) target.bearing = options.bearing;
    if (options.duration === 0) this.jumpTo(target);
    else this.animateTo(target, options.duration ?? 400);
  }

  /**
   * Put `position` at `anchor` (0–1 of the width/height, from the top left) with the given bearing.
   * Replaces MapLibre's view padding, which would fight the pan gesture.
   */
  follow(
    position: [number, number],
    bearing: number,
    anchor: [number, number],
  ) {
    this.followTarget = { position, bearing, anchor };
    this.setView({
      ...this.anchoredView(this.view, position, bearing, anchor),
      transitionDuration: 0,
    });
  }

  private anchoredView(
    view: MapViewState,
    position: [number, number],
    bearing: number,
    anchor: [number, number],
  ): MapViewState {
    const { width, height } = this.size;
    const next = new WebMercatorViewport({
      ...view,
      ...this.size,
      bearing,
    });
    const pixel = [width * anchor[0], height * anchor[1]];
    const { longitude, latitude } =
      (view.maxPitch ?? 0) > 0
        ? next.panByPosition3D(
            [
              ...position,
              cachedTerrainElevation({ lon: position[0], lat: position[1] }) ??
                view.position?.[2] ??
                0,
            ],
            pixel,
          )
        : next.panByPosition(position, pixel);
    return {
      ...view,
      longitude: longitude ?? view.longitude,
      latitude: latitude ?? view.latitude,
      bearing,
    };
  }

  setLayers(layers: Layer[]) {
    this.deck.setProps({ layers });
  }

  /** The objects within `radius` px of a point on the given layers. */
  pick(point: Point, layerIds: string[], radius = PICK_RADIUS) {
    return this.deck
      .pickMultipleObjects({
        ...point,
        radius,
        layerIds:
          (this.view.maxPitch ?? 0) > 0
            ? layerIds.map((id) => `${id}-terrain`)
            : layerIds,
        depth: 8,
      })
      .filter((info) => info.object);
  }

  destroy() {
    this.container.removeEventListener("wheel", this.onWheel, true);
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    this.container.removeEventListener("touchstart", this.onTouchCount, true);
    this.container.removeEventListener("touchend", this.onTouchCount, true);
    this.container.removeEventListener("touchcancel", this.onTouchCount, true);
    this.container.removeEventListener("touchmove", this.onTouchMove, true);
    this.container.removeEventListener("click", this.onClick);
    clearTimeout(this.settle);
    this.observer.disconnect();
    this.deck.finalize();
  }
}
