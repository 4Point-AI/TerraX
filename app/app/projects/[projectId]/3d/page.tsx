"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, PerspectiveCamera } from "@react-three/drei";
import { Box, RotateCcw } from "lucide-react";
import { AOI, FileRecord, SceneSpec } from "@/types";
import * as THREE from "three";

function DrillholePoints({ points }: { points: NonNullable<SceneSpec["drillholes"]>["collar"] }) {
  return (
    <group>
      {points.map((point, idx) => (
        <mesh key={idx} position={[point.x, point.z, point.y]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshStandardMaterial color="#ff6600" />
        </mesh>
      ))}
    </group>
  );
}

function AutoFitCamera({ points, fitKey }: { points: RenderPoint[]; fitKey: number }) {
  const { camera, controls } = useThree((state) => ({
    camera: state.camera,
    controls: state.controls as { target?: THREE.Vector3; update?: () => void } | undefined,
  }));

  useEffect(() => {
    if (!points.length) return;

    const box = new THREE.Box3();
    for (const p of points) {
      box.expandByPoint(new THREE.Vector3(p.x, p.z, p.y));
    }

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const center = sphere.center;
    const radius = Math.max(sphere.radius, 1);

    const fov = ((camera as THREE.PerspectiveCamera).fov || 60) * (Math.PI / 180);
    const distance = (radius * 1.6) / Math.tan(fov / 2);

    camera.position.set(center.x + distance, center.y + distance * 0.45, center.z + distance);
    camera.near = Math.max(0.1, distance / 1000);
    camera.far = Math.max(5000, distance * 20);
    camera.updateProjectionMatrix();

    if (controls?.target) {
      controls.target.set(center.x, center.y, center.z);
      controls.update?.();
    } else {
      camera.lookAt(center);
    }
  }, [fitKey, camera, controls]);

  return null;
}

function Scene({ sceneSpec }: { sceneSpec: SceneSpec | null }) {
  if (!sceneSpec) {
    return (
      <group>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[50, 50, 50]} />
          <meshStandardMaterial color="#444444" wireframe />
        </mesh>
      </group>
    );
  }

  return <group />;
}

interface InferredPoint {
  x: number;
  y: number;
  z: number;
  features: Record<string, number | null>;
}

interface RenderPoint extends InferredPoint {
  color: string;
}

interface AoiPoint {
  x: number;
  y: number;
  z: number;
  color: string;
}

interface InferenceResponse {
  columns: string[];
  numericColumns?: string[];
  inferencePromptContext?: string;
  totalPoints?: number;
  plottedPoints?: number;
  inferred: {
    x: string;
    y: string;
    z?: string | null;
  };
  featureColumns: string[];
  featureStats: Record<string, { min: number; max: number }>;
  points: InferredPoint[];
  sampleRows: Record<string, string>[];
}

type FeatureToggles = Record<string, boolean>;

function colorForValue(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return "#60a5fa";
  }
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = Math.round(59 + t * 196);
  const g = Math.round(130 + (1 - t) * 90);
  const b = Math.round(246 - t * 210);
  return `rgb(${r}, ${g}, ${b})`;
}

function CsvPoints({ points, onHover }: { points: RenderPoint[]; onHover: (point: RenderPoint | null) => void }) {
  return (
    <group>
      {points.map((point, idx) => (
        <mesh
          key={`csv-${idx}`}
          position={[point.x, point.z, point.y]}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHover(point);
          }}
          onPointerOut={() => onHover(null)}
        >
          <sphereGeometry args={[1.2, 8, 8]} />
          <meshStandardMaterial color={point.color || "#00ff00"} />
        </mesh>
      ))}
    </group>
  );
}

function AoiPoints({ points }: { points: AoiPoint[] }) {
  return (
    <group>
      {points.map((point, idx) => (
        <mesh key={`aoi-${idx}`} position={[point.x, point.z, point.y]}>
          <sphereGeometry args={[2, 10, 10]} />
          <meshStandardMaterial color={point.color} />
        </mesh>
      ))}
    </group>
  );
}

export default function ThreeDPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [cameraReset, setCameraReset] = useState(0);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [aois, setAois] = useState<AOI[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [inferLoading, setInferLoading] = useState(false);
  const [inferError, setInferError] = useState<string | null>(null);
  const [inference, setInference] = useState<InferenceResponse | null>(null);
  const [colorFeature, setColorFeature] = useState<string>("");
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({});
  const [axisX, setAxisX] = useState<string>("");
  const [axisY, setAxisY] = useState<string>("");
  const [axisZ, setAxisZ] = useState<string>("__none__");
  const [hoveredPoint, setHoveredPoint] = useState<RenderPoint | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadProjectData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      const { data: filesData } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId);

      const { data: aoisData } = await supabase
        .from("aoi")
        .select("*")
        .eq("project_id", projectId);

      const loadedFiles = filesData || [];
      setFiles(loadedFiles);
      setAois(aoisData || []);

      const csvFiles = loadedFiles.filter((file) => file.filename.toLowerCase().endsWith(".csv"));
      if (!selectedFileId && csvFiles.length > 0) {
        setSelectedFileId(csvFiles[0].id);
      }
    } catch (error) {
      console.error("Error loading project data:", error);
    }
  };

  const runParsing = async (useAxisOverrides = false) => {
    if (!selectedFileId) {
      setInferError("Select a CSV file first.");
      return;
    }

    setInferLoading(true);
    setInferError(null);
    try {
      const res = await fetch("/api/files/infer-3d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileId: selectedFileId,
          ...(useAxisOverrides
            ? {
                xColumn: axisX || undefined,
                yColumn: axisY || undefined,
                zColumn: axisZ === "__none__" ? null : axisZ,
              }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to infer 3D columns");

      const inferredData = data as InferenceResponse;
      setInference(inferredData);
      setAxisX(inferredData.inferred.x || "");
      setAxisY(inferredData.inferred.y || "");
      setAxisZ(inferredData.inferred.z || "__none__");

      const nextToggles: FeatureToggles = {};
      for (const feature of inferredData.featureColumns || []) {
        nextToggles[feature] = true;
      }
      setFeatureToggles(nextToggles);
      setColorFeature((prev) => {
        if (prev && inferredData.featureColumns.includes(prev)) return prev;
        return inferredData.featureColumns[0] || "";
      });
      setCameraReset((prev) => prev + 1);
    } catch (error: any) {
      setInference(null);
      setInferError(error.message || "Failed to infer 3D columns");
    } finally {
      setInferLoading(false);
    }
  };

  const enabledFeatureColumns = useMemo(() => {
    if (!inference) return [] as string[];
    return inference.featureColumns.filter((feature) => featureToggles[feature] ?? true);
  }, [inference, featureToggles]);

  const filteredPoints = useMemo<RenderPoint[]>(() => {
    if (!inference) return [];
    const csvPoints = enabledFeatureColumns.length === 0
      ? []
      : inference.points.filter((point) =>
          enabledFeatureColumns.some((feature) => {
            const value = point.features[feature];
            return typeof value === "number" && Number.isFinite(value);
          })
        );

    return csvPoints
      .map((point) => {
        let color = "#60a5fa";
        if (colorFeature && inference.featureStats[colorFeature]) {
          const value = point.features[colorFeature];
          if (typeof value === "number") {
            color = colorForValue(value, inference.featureStats[colorFeature].min, inference.featureStats[colorFeature].max);
          }
        }
        return {
          x: point.x,
          y: point.y,
          z: point.z,
          color,
          features: point.features,
        };
      });
  }, [inference, colorFeature, enabledFeatureColumns]);

  const plottedCsvPoints = useMemo<RenderPoint[]>(() => filteredPoints, [filteredPoints]);

  const aoiPoints = useMemo<AoiPoint[]>(() => {
    return (aois || [])
      .filter((aoi) => aoi.bbox)
      .map((aoi) => ({
        x: (((aoi.bbox.minLng || 0) + (aoi.bbox.maxLng || 0)) / 2) * 100,
        y: (((aoi.bbox.minLat || 0) + (aoi.bbox.maxLat || 0)) / 2) * 100,
        z: 0,
        color: "#f97316",
      }));
  }, [aois]);

  useEffect(() => {
    setHoveredPoint(null);
  }, [inference, enabledFeatureColumns, colorFeature]);

  useEffect(() => {
    if (!enabledFeatureColumns.length) {
      setColorFeature("");
      return;
    }
    const availableWithStats = enabledFeatureColumns.filter((feature) => !!inference?.featureStats?.[feature]);
    const nextFeature = availableWithStats[0] || enabledFeatureColumns[0];
    if (!enabledFeatureColumns.includes(colorFeature) || (colorFeature && !inference?.featureStats?.[colorFeature])) {
      setColorFeature(nextFeature || "");
    }
  }, [enabledFeatureColumns, colorFeature, inference]);

  const sceneSpec = useMemo<SceneSpec | null>(() => {
    if (!inference) return null;

    return {
      type: "3d",
      drillholes: {
        collar: plottedCsvPoints.map((point, index) => ({ id: `P-${index + 1}`, x: point.x, y: point.y, z: point.z })),
      },
      points: [...plottedCsvPoints, ...aoiPoints],
      bounds: { min: [-100, -100, -200], max: [100, 100, 100] },
    };
  }, [inference, plottedCsvPoints, aoiPoints]);

  return (
    <div className="flex h-full">
      {/* 3D Canvas */}
      <div className="flex-1 relative bg-black">
        <Canvas>
          <PerspectiveCamera
            key={cameraReset}
            makeDefault
            position={[150, 150, 150]}
            fov={60}
          />
          <OrbitControls makeDefault />
          
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <pointLight position={[-10, -10, -5]} intensity={0.5} />

          <Grid
            args={[200, 200]}
            cellSize={10}
            cellColor="#444444"
            sectionSize={50}
            sectionColor="#666666"
            fadeDistance={500}
            fadeStrength={1}
            position={[0, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />

          <Suspense fallback={null}>
            <Scene sceneSpec={sceneSpec} />
            <CsvPoints points={plottedCsvPoints} onHover={setHoveredPoint} />
            <AoiPoints points={aoiPoints} />
            <AutoFitCamera points={plottedCsvPoints} fitKey={cameraReset} />
          </Suspense>

          <axesHelper args={[100]} />
        </Canvas>

        <div className="absolute top-4 left-4">
          <button
            onClick={() => setCameraReset((prev) => prev + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10 text-xs text-white/80 hover:bg-black/80 hover:text-white transition-all duration-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset View
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-72 border-l border-border/50 bg-card/30 flex flex-col overflow-auto">
        <div className="p-4 space-y-3">
          {inferError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-[11px] px-3 py-2">
              {inferError}
            </div>
          )}

          {/* Scene Info */}
          <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold">Scene</h4>
            </div>
            {sceneSpec ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/20 p-2 text-center">
                  <p className="text-lg font-bold text-foreground">{inference?.plottedPoints ?? inference?.points.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Plotted CSV Points</p>
                </div>
                <div className="rounded-lg bg-muted/20 p-2 text-center">
                  <p className="text-lg font-bold text-foreground">{inference?.totalPoints ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Total Valid Points</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Run 3D Parsing to build a scene from your selected CSV.</p>
            )}
          </div>

          {/* Project Files */}
          {files.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2">
              <h4 className="text-xs font-semibold">CSV Files</h4>
              <div className="space-y-1">
                {files
                  .filter((file) => file.filename.toLowerCase().endsWith(".csv"))
                  .map((file) => (
                    <button
                      key={file.id}
                      onClick={() => {
                        setSelectedFileId(file.id);
                        setInference(null);
                        setInferError(null);
                        setColorFeature("");
                        setFeatureToggles({});
                      }}
                      className={`w-full text-left text-[11px] truncate px-2 py-1.5 rounded-md border transition-colors ${
                        selectedFileId === file.id
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-muted/10 border-border/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {file.filename}
                    </button>
                  ))}
                {files.filter((file) => file.filename.toLowerCase().endsWith(".csv")).length === 0 && (
                  <p className="text-[11px] text-muted-foreground">Upload a CSV to build a 3D scene.</p>
                )}
              </div>
              <button
                onClick={() => runParsing()}
                disabled={!selectedFileId || inferLoading}
                className="w-full h-8 rounded-md bg-primary/15 hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] text-primary border border-primary/20"
              >
                {inferLoading ? "Analyzing CSV..." : "Run 3D Parsing"}
              </button>
              <p className="text-[10px] text-muted-foreground/70">
                Infers XYZ + numeric features from the CSV head, then randomly plots up to 5,000 valid rows.
              </p>
            </div>
          )}

          {/* Inferred columns */}
          {inference && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2">
              <h4 className="text-xs font-semibold">Axes</h4>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={axisX}
                  onChange={(e) => setAxisX(e.target.value)}
                  className="h-8 rounded-md border border-border/40 bg-background/50 text-xs px-2"
                >
                  {(inference.numericColumns || []).map((col) => (
                    <option key={`x-${col}`} value={col}>X: {col}</option>
                  ))}
                </select>
                <select
                  value={axisY}
                  onChange={(e) => setAxisY(e.target.value)}
                  className="h-8 rounded-md border border-border/40 bg-background/50 text-xs px-2"
                >
                  {(inference.numericColumns || []).map((col) => (
                    <option key={`y-${col}`} value={col}>Y: {col}</option>
                  ))}
                </select>
                <select
                  value={axisZ}
                  onChange={(e) => setAxisZ(e.target.value)}
                  className="h-8 rounded-md border border-border/40 bg-background/50 text-xs px-2"
                >
                  <option value="__none__">Z: (default 0)</option>
                  {(inference.numericColumns || []).map((col) => (
                    <option key={`z-${col}`} value={col}>Z: {col}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => runParsing(true)}
                disabled={inferLoading || !axisX || !axisY || axisX === axisY}
                className="w-full h-8 rounded-md bg-muted/30 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] text-foreground border border-border/40"
              >
                Apply Axis Selection
              </button>
              <div className="text-[10px] text-muted-foreground/70 space-y-1">
                <p>Inferred: X={inference.inferred.x}, Y={inference.inferred.y}, Z={inference.inferred.z || "(default 0)"}</p>
                {inference.inferencePromptContext && <p>{inference.inferencePromptContext}</p>}
              </div>

              {enabledFeatureColumns.length > 0 && (
                <>
                  <label className="text-[11px] text-muted-foreground block mt-2">Color by Feature</label>
                  <select
                    value={colorFeature}
                    onChange={(e) => setColorFeature(e.target.value)}
                    className="w-full h-8 rounded-md border border-border/40 bg-background/50 text-xs px-2"
                  >
                    {enabledFeatureColumns.map((feature) => (
                      <option key={feature} value={feature}>{feature}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Colors map low-to-high values of the selected feature across currently visible points.
                  </p>
                  {colorFeature && !inference.featureStats[colorFeature] && (
                    <p className="text-[10px] text-amber-500/80 mt-1">
                      Selected feature has no numeric spread in visible points, so colors may look uniform.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {hoveredPoint && enabledFeatureColumns.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2">
              <h4 className="text-xs font-semibold">Hovered Point Values</h4>
              <div className="text-[10px] text-muted-foreground/80 grid grid-cols-3 gap-2">
                <span>X: {hoveredPoint.x.toFixed(2)}</span>
                <span>Y: {hoveredPoint.y.toFixed(2)}</span>
                <span>Z: {hoveredPoint.z.toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                {enabledFeatureColumns.map((feature) => {
                  const value = hoveredPoint.features[feature];
                  return (
                    <div key={`hover-${feature}`} className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span className="truncate pr-2">{feature}</span>
                      <span className="text-[10px] text-muted-foreground/80">
                        {typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "n/a"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature toggles */}
          {inference && inference.featureColumns.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-3">
              <h4 className="text-xs font-semibold">Feature Toggles</h4>
              {inference.featureColumns.map((feature) => {
                return (
                  <label key={feature} className="flex items-center gap-2.5 text-xs cursor-pointer group py-1 px-1 -mx-1 rounded-lg hover:bg-muted/20 transition-colors">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={featureToggles[feature] ?? true}
                        onChange={() => setFeatureToggles((prev) => ({ ...prev, [feature]: !(prev[feature] ?? true) }))}
                        className="sr-only peer"
                      />
                      <div className="w-7 h-4 rounded-full bg-muted/40 peer-checked:bg-primary/30 transition-colors" />
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-muted-foreground/50 peer-checked:bg-primary peer-checked:translate-x-3 transition-all" />
                    </div>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">{feature}</span>
                  </label>
                );
              })}
              <p className="text-[10px] text-muted-foreground/70">Enabled features also control which CSV points remain visible in the 3D plot.</p>
            </div>
          )}

          {inference && enabledFeatureColumns.length === 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5">
              <p className="text-[11px] text-muted-foreground">All features are disabled, so CSV points are hidden.</p>
            </div>
          )}

          {/* Feature stats */}
          {inference && enabledFeatureColumns.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2">
              <h4 className="text-xs font-semibold">Feature Ranges</h4>
              {enabledFeatureColumns.map((feature) => {
                const stats = inference.featureStats[feature];
                if (!stats) return null;
                return (
                  <div key={`stats-${feature}`} className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span className="truncate pr-2">{feature}</span>
                    <span className="text-[10px] text-muted-foreground/70">{stats.min.toFixed(2)} - {stats.max.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* AOIs */}
          {aois.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3.5 space-y-2">
              <h4 className="text-xs font-semibold">Areas of Interest ({aois.length})</h4>
              <div className="space-y-1">
                {aois.map((aoi) => (
                  <p key={aoi.id} className="text-[11px] text-muted-foreground truncate">{aoi.name}</p>
                ))}
              </div>
            </div>
          )}

          {inferLoading && <p className="text-[11px] text-primary">Analyzing CSV...</p>}

          <p className="text-[10px] text-muted-foreground/40 text-center pt-1">
            Rotate · Scroll to zoom · Right-click to pan
          </p>
        </div>
      </div>
    </div>
  );
}
