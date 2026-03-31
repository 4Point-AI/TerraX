"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Layers, Square, Trash2, Pencil, MapPin, Minus, Type, X } from "lucide-react";
import Map, { NavigationControl, Source, Layer } from "react-map-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { AOI, FileRecord } from "@/types";

export default function MapPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const mapRef = useRef<any>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [viewport, setViewport] = useState({
    longitude: -115.0,
    latitude: 40.0,
    zoom: 6,
  });
  const [aois, setAois] = useState<AOI[]>([]);
  const [selectedAoi, setSelectedAoi] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<{id: string; type: string; name: string; geojson: any}[]>([]);
  const [annotationMode, setAnnotationMode] = useState<string | null>(null);
  const [lineStart, setLineStart] = useState<{ lng: number; lat: number } | null>(null);
  const [linePreviewPoint, setLinePreviewPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [drawMode, setDrawMode] = useState<string>("simple_select");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadAOIs();
    loadFiles();
  }, [projectId]);

  const handleMapLoad = () => {
    if (mapRef.current && !drawRef.current) {
      const map = mapRef.current.getMap();
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: "simple_select",
      });
      map.addControl(draw);
      drawRef.current = draw;

      map.on("draw.create", handleDrawCreate);
      map.on("draw.update", handleDrawUpdate);
      map.on("draw.modechange", () => {
        const mode = draw.getMode?.() || "simple_select";
        setDrawMode(mode);
      });
    }
  };

  const handleMapMouseMove = (e: any) => {
    if (annotationMode === "line" && lineStart) {
      const { lng, lat } = e.lngLat;
      setLinePreviewPoint({ lng, lat });
    }
  };

  const handleMapClick = (e: any) => {
    const draw = drawRef.current;
    const drawMode = draw?.getMode?.();
    if (drawMode && String(drawMode).startsWith("draw_")) return;

    if (!annotationMode) return;
    const { lng, lat } = e.lngLat;

    if (annotationMode === "point") {
      const name = prompt("Name this marker:", `Marker ${annotations.length + 1}`) || `Marker ${annotations.length + 1}`;
      setAnnotations((prev) => [...prev, {
        id: crypto.randomUUID(),
        type: "point",
        name,
        geojson: { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { name } },
      }]);
      setAnnotationMode(null);
    } else if (annotationMode === "label") {
      const name = prompt("Enter label text:", `Label ${annotations.length + 1}`) || `Label ${annotations.length + 1}`;
      setAnnotations((prev) => [...prev, {
        id: crypto.randomUUID(),
        type: "label",
        name,
        geojson: { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { name } },
      }]);
      setAnnotationMode(null);
    } else if (annotationMode === "line") {
      if (!lineStart) {
        setLineStart({ lng, lat });
        setLinePreviewPoint({ lng, lat });
        return;
      }

      const name = prompt("Name this fault line:", `Fault ${annotations.length + 1}`) || `Fault ${annotations.length + 1}`;
      setAnnotations((prev) => [...prev, {
        id: crypto.randomUUID(),
        type: "line",
        name,
        geojson: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[lineStart.lng, lineStart.lat], [lng, lat]] },
          properties: { name },
        },
      }]);
      setLineStart(null);
      setLinePreviewPoint(null);
      setAnnotationMode(null);
    }
  };

  const loadAOIs = async () => {
    try {
      const { data, error } = await supabase
        .from("aoi")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAois(data || []);
    } catch (error) {
      console.error("Error loading AOIs:", error);
    }
  };

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const handleDrawCreate = async (e: any) => {
    const feature = e.features[0];
    const name = prompt("Name this area of interest:");
    if (!name) {
      drawRef.current?.delete(feature.id);
      return;
    }

    try {
      const bounds = feature.geometry.coordinates[0];
      const lngs = bounds.map((coord: number[]) => coord[0]);
      const lats = bounds.map((coord: number[]) => coord[1]);
      const bbox = {
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
      };

      const { error } = await supabase.from("aoi").insert({
        project_id: projectId,
        name,
        geojson: feature,
        bbox,
      });

      if (error) throw error;

      await loadAOIs();
      drawRef.current?.delete(feature.id);
    } catch (error: any) {
      setError(error.message || "Failed to save AOI");
    }
  };

  const handleDrawUpdate = async (e: any) => {
    console.log("AOI updated", e);
  };

  const handleDeleteAoi = async (aoiId: string) => {
    if (!confirm("Delete this area of interest?")) return;

    try {
      const { error } = await supabase.from("aoi").delete().eq("id", aoiId);

      if (error) throw error;

      await loadAOIs();
    } catch (error: any) {
      setError(error.message || "Failed to delete AOI");
    }
  };

  const handleAskAI = async (aoiId: string) => {
    const aoi = aois.find((a) => a.id === aoiId);
    if (!aoi) return;

    const message = `Analyze the area of interest "${aoi.name}" with bounds: ${JSON.stringify(aoi.bbox)}. What geological features should I focus on?`;
    
    window.location.href = `/app/projects/${projectId}/chat?message=${encodeURIComponent(message)}`;
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          {...viewport}
          onMove={(evt) => setViewport(evt.viewState)}
          onClick={handleMapClick}
          onMouseMove={handleMapMouseMove}
          onLoad={handleMapLoad}
          cursor={annotationMode || String(drawMode).startsWith("draw_") ? "crosshair" : "grab"}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        >
          <NavigationControl position="top-right" />

          {/* Annotation layers */}
          {annotations.filter((a) => a.type === "line").map((ann) => (
            <Source key={ann.id} id={`ann-${ann.id}`} type="geojson" data={ann.geojson}>
              <Layer
                id={`ann-line-${ann.id}`}
                type="line"
                paint={{
                  "line-color": "#ef4444",
                  "line-width": 2.5,
                  "line-dasharray": [4, 2],
                }}
              />
            </Source>
          ))}

          {annotationMode === "line" && lineStart && linePreviewPoint && (
            <Source
              id="line-preview"
              type="geojson"
              data={{
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: [[lineStart.lng, lineStart.lat], [linePreviewPoint.lng, linePreviewPoint.lat]],
                },
                properties: {},
              }}
            >
              <Layer
                id="line-preview-layer"
                type="line"
                paint={{
                  "line-color": "#f97316",
                  "line-width": 2,
                  "line-dasharray": [2, 2],
                }}
              />
            </Source>
          )}
          {annotations.filter((a) => a.type === "point").map((ann) => (
            <Source key={ann.id} id={`ann-${ann.id}`} type="geojson" data={ann.geojson}>
              <Layer
                id={`ann-point-${ann.id}`}
                type="circle"
                paint={{
                  "circle-radius": 6,
                  "circle-color": "#ff6600",
                  "circle-stroke-width": 2,
                  "circle-stroke-color": "#ffffff",
                }}
              />
            </Source>
          ))}
          {annotations.filter((a) => a.type === "label").map((ann) => (
            <Source key={ann.id} id={`ann-${ann.id}`} type="geojson" data={ann.geojson}>
              <Layer
                id={`ann-label-${ann.id}`}
                type="symbol"
                layout={{
                  "text-field": ann.name,
                  "text-size": 12,
                  "text-anchor": "top",
                  "text-offset": [0, 0.5],
                }}
                paint={{
                  "text-color": "#ffffff",
                  "text-halo-color": "#000000",
                  "text-halo-width": 1,
                }}
              />
            </Source>
          ))}

          {aois.map((aoi) => (
            <Source key={aoi.id} id={aoi.id} type="geojson" data={aoi.geojson}>
              <Layer
                id={`${aoi.id}-fill`}
                type="fill"
                paint={{
                  "fill-color": "#ff6600",
                  "fill-opacity": selectedAoi === aoi.id ? 0.3 : 0.1,
                }}
              />
              <Layer
                id={`${aoi.id}-outline`}
                type="line"
                paint={{
                  "line-color": "#ff6600",
                  "line-width": 2,
                }}
              />
            </Source>
          ))}
        </Map>

        <div className="absolute top-4 left-4 flex gap-2">
          <button
            onClick={() => {
              const draw = drawRef.current;
              if (draw) {
                setAnnotationMode(null);
                setLineStart(null);
                setLinePreviewPoint(null);
                draw.changeMode("draw_polygon");
                setDrawMode("draw_polygon");
              } else {
                setError("Map drawing tool is still loading. Please try again in a second.");
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm border text-xs transition-all duration-200 ${
              String(drawMode).startsWith("draw_")
                ? "bg-primary/80 border-primary/50 text-white"
                : "bg-black/60 border-white/10 text-white/80 hover:bg-black/80 hover:text-white"
            }`}
          >
            <Square className="h-3.5 w-3.5" />
            Draw AOI
          </button>
          <button
            onClick={() => {
              drawRef.current?.changeMode("simple_select");
              setDrawMode("simple_select");
              const nextMode = annotationMode === "line" ? null : "line";
              setAnnotationMode(nextMode);
              if (nextMode !== "line") {
                setLineStart(null);
                setLinePreviewPoint(null);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm border text-xs transition-all duration-200 ${
              annotationMode === "line"
                ? "bg-primary/80 border-primary/50 text-white"
                : "bg-black/60 border-white/10 text-white/80 hover:bg-black/80 hover:text-white"
            }`}
          >
            <Minus className="h-3.5 w-3.5" />
            Fault Line
          </button>
          <button
            onClick={() => {
              drawRef.current?.changeMode("simple_select");
              setDrawMode("simple_select");
              const nextMode = annotationMode === "point" ? null : "point";
              setAnnotationMode(nextMode);
              setLineStart(null);
              setLinePreviewPoint(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm border text-xs transition-all duration-200 ${
              annotationMode === "point"
                ? "bg-primary/80 border-primary/50 text-white"
                : "bg-black/60 border-white/10 text-white/80 hover:bg-black/80 hover:text-white"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            Marker
          </button>
          <button
            onClick={() => {
              drawRef.current?.changeMode("simple_select");
              setDrawMode("simple_select");
              const nextMode = annotationMode === "label" ? null : "label";
              setAnnotationMode(nextMode);
              setLineStart(null);
              setLinePreviewPoint(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm border text-xs transition-all duration-200 ${
              annotationMode === "label"
                ? "bg-primary/80 border-primary/50 text-white"
                : "bg-black/60 border-white/10 text-white/80 hover:bg-black/80 hover:text-white"
            }`}
          >
            <Type className="h-3.5 w-3.5" />
            Label
          </button>

          {annotationMode && (
            <div className="px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-sm border border-white/10 text-[11px] text-white/90">
              {annotationMode === "line"
                ? lineStart
                  ? "Click end point to place fault line"
                  : "Click start point for fault line"
                : annotationMode === "point"
                ? "Click map to place marker"
                : "Click map to place label"}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-72 border-l border-border/50 bg-card/30 flex flex-col overflow-auto">
        <div className="p-4 space-y-3">
          {error && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline opacity-70">dismiss</button>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2">
              <h4 className="text-xs font-semibold">Files ({files.length})</h4>
              <div className="space-y-1">
                {files.map((file) => (
                  <p key={file.id} className="text-[11px] text-muted-foreground truncate">
                    {file.filename} <span className="text-muted-foreground/40">({file.file_kind})</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Annotations */}
          {annotations.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                <h4 className="text-xs font-semibold">Annotations ({annotations.length})</h4>
              </div>
              <div className="space-y-1">
                {annotations.map((ann) => (
                  <div key={ann.id} className="group flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      {ann.type === "line" && <Minus className="h-3 w-3 text-red-400 shrink-0" />}
                      {ann.type === "point" && <MapPin className="h-3 w-3 text-primary shrink-0" />}
                      {ann.type === "label" && <Type className="h-3 w-3 text-blue-400 shrink-0" />}
                      <span className="text-[11px] truncate">{ann.name}</span>
                    </div>
                    <button
                      onClick={() => setAnnotations((prev) => prev.filter((a) => a.id !== ann.id))}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AOIs */}
          <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold">Areas of Interest</h4>
            </div>

            {aois.length > 0 ? (
              <div className="space-y-1.5">
                {aois.map((aoi) => (
                  <div
                    key={aoi.id}
                    className={`group rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                      selectedAoi === aoi.id
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-muted/10 border border-transparent hover:bg-muted/20"
                    }`}
                    onClick={() => setSelectedAoi(aoi.id === selectedAoi ? null : aoi.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{aoi.name}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {aoi.bbox && (
                            <>
                              {Math.abs(aoi.bbox.maxLng - aoi.bbox.minLng).toFixed(3)}° × {Math.abs(aoi.bbox.maxLat - aoi.bbox.minLat).toFixed(3)}°
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAoi(aoi.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      className="w-full mt-2 h-7 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleAskAI(aoi.id); }}
                    >
                      Ask AI about this AOI
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-xl bg-muted/20 flex items-center justify-center mx-auto mb-2">
                  <Layers className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">No areas defined yet</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  Click &ldquo;Draw AOI&rdquo; to create one
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
