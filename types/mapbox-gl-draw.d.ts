declare module '@mapbox/mapbox-gl-draw' {
  import { Map } from 'mapbox-gl';

  export default class MapboxDraw {
    constructor(options?: any);
    add(geojson: any): string[];
    delete(id: string): this;
    deleteAll(): this;
    set(featureCollection: any): string[];
    get(id: string): any;
    getAll(): any;
    getSelectedIds(): string[];
    getSelected(): any;
    getSelectedPoints(): any;
    changeMode(mode: string, options?: any): this;
    trash(): this;
    combineFeatures(): this;
    uncombineFeatures(): this;
    getMode(): string;
    onAdd(map: Map): HTMLElement;
    onRemove(map: Map): void;
  }
}
