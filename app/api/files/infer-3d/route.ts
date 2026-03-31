import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Papa from "papaparse";
import { GoogleGenerativeAI } from "@google/generative-ai";

type InferredPoint = {
  x: number;
  y: number;
  z: number;
  features: Record<string, number | null>;
};

const AI_HEAD_ROWS = 10;
const MAX_RENDER_POINTS = 5000;

function pickColumn(columns: string[], aliases: string[], skip = new Set<string>()) {
  const normalized = columns.map((col) => ({ original: col, lower: col.toLowerCase() }));
  for (const alias of aliases) {
    const exact = normalized.find((col) => col.lower === alias && !skip.has(col.original));
    if (exact) return exact.original;
  }
  for (const alias of aliases) {
    const partial = normalized.find((col) => col.lower.includes(alias) && !skip.has(col.original));
    if (partial) return partial.original;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

async function inferWithGemini(columns: string[], rows: Record<string, string>[]) {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
You are analyzing geological mining exploration data from a CSV head.
Infer the best columns for 3D plotting so we can map all drill/sample points.
Return strict JSON only with this shape:
{
  "x": "columnName",
  "y": "columnName",
  "z": "columnName or null",
  "features": ["numericFeature1", "numericFeature2"]
}

Rules:
- x and y must be from columns list and should represent spatial coordinates (easting/northing, lon/lat, x/y) if possible.
- z should be elevation, RL, reduced level, or depth-like numeric column when present, else null.
- features must be numeric mining/geology attributes (grades, assays, geochem, lith numeric encodings, density, etc.) and should exclude x/y/z.
- keep features max 8 items.

Columns:
${JSON.stringify(columns)}

Sample rows:
${JSON.stringify(rows.slice(0, 30), null, 2)}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json\s*/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(clean) as { x?: string; y?: string; z?: string | null; features?: string[] };

    if (!parsed?.x || !parsed?.y) return null;

    return {
      x: parsed.x,
      y: parsed.y,
      z: parsed.z ?? null,
      features: Array.isArray(parsed.features) ? parsed.features : [],
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId, projectId, xColumn, yColumn, zColumn } = await request.json();
    if (!fileId || !projectId) {
      return NextResponse.json({ error: "fileId and projectId are required" }, { status: 400 });
    }

    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, project_id, filename, storage_path")
      .eq("id", fileId)
      .eq("project_id", projectId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const lowerFilename = (file.filename || "").toLowerCase();
    if (!lowerFilename.endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are supported for 3D inference" }, { status: 400 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(file.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
    }

    const text = await fileData.text();
    const parseResult = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const columns = (parseResult.meta.fields || []).filter(Boolean);
    const rows = (parseResult.data || []).filter((row) =>
      Object.values(row || {}).some((v) => v !== null && v !== undefined && String(v).trim() !== "")
    );
    const aiRows = rows.slice(0, AI_HEAD_ROWS);

    if (columns.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: "CSV appears empty or missing headers" }, { status: 400 });
    }

    const numericColumns = columns.filter((col) => {
      let numericCount = 0;
      let nonEmptyCount = 0;
      for (const row of rows) {
        const raw = row[col];
        if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
          nonEmptyCount += 1;
          if (toNumber(raw) !== null) numericCount += 1;
        }
      }
      return nonEmptyCount > 0 && numericCount / nonEmptyCount >= 0.65;
    });

    if (numericColumns.length < 2) {
      return NextResponse.json({ error: "Could not infer at least 2 numeric coordinate columns" }, { status: 400 });
    }

    const aiInference = await inferWithGemini(columns, aiRows);

    const used = new Set<string>();
    const xCol = xColumn && numericColumns.includes(xColumn)
      ? xColumn
      : aiInference?.x && numericColumns.includes(aiInference.x)
      ? aiInference.x
      : pickColumn(numericColumns, ["x", "easting", "east", "longitude", "lon", "lng", "utm_e"], used) || numericColumns[0];
    used.add(xCol);

    const yCol = yColumn && numericColumns.includes(yColumn) && yColumn !== xCol
      ? yColumn
      : aiInference?.y && numericColumns.includes(aiInference.y) && aiInference.y !== xCol
      ? aiInference.y
      : pickColumn(numericColumns, ["y", "northing", "north", "latitude", "lat", "utm_n"], used) || numericColumns.find((c) => c !== xCol) || numericColumns[1];
    used.add(yCol);

    const zCol = zColumn === null
      ? null
      : zColumn && numericColumns.includes(zColumn) && zColumn !== xCol && zColumn !== yCol
      ? zColumn
      : aiInference?.z && numericColumns.includes(aiInference.z) && aiInference.z !== xCol && aiInference.z !== yCol
      ? aiInference.z
      : pickColumn(numericColumns, ["z", "elevation", "elev", "rl", "depth", "from", "to"], used);
    if (zCol) used.add(zCol);

    const aiFeatures = (aiInference?.features || []).filter((feature) =>
      numericColumns.includes(feature) && feature !== xCol && feature !== yCol && feature !== zCol
    );
    const featureColumns = (aiFeatures.length > 0
      ? aiFeatures
      : numericColumns.filter((c) => c !== xCol && c !== yCol && c !== zCol)
    ).slice(0, 8);

    const points: InferredPoint[] = [];
    let totalValidPoints = 0;
    for (const row of rows) {
      const x = toNumber(row[xCol]);
      const y = toNumber(row[yCol]);
      const z = zCol ? toNumber(row[zCol]) : 0;
      if (x === null || y === null) continue;

      const features: Record<string, number | null> = {};
      for (const f of featureColumns) {
        features[f] = toNumber(row[f]);
      }

      totalValidPoints += 1;
      const point = { x, y, z: z ?? 0, features };
      if (points.length < MAX_RENDER_POINTS) {
        points.push(point);
      } else {
        const replaceAt = Math.floor(Math.random() * totalValidPoints);
        if (replaceAt < MAX_RENDER_POINTS) points[replaceAt] = point;
      }
    }

    const featureStats: Record<string, { min: number; max: number }> = {};
    for (const feature of featureColumns) {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      let hasValue = false;

      for (const point of points) {
        const v = point.features[feature];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        hasValue = true;
        if (v < min) min = v;
        if (v > max) max = v;
      }

      if (hasValue) {
        featureStats[feature] = { min, max };
      }
    }

    return NextResponse.json({
      columns,
      numericColumns,
      inferred: {
        x: xCol,
        y: yCol,
        z: zCol,
      },
      inferencePromptContext: `Analyzed CSV head (${AI_HEAD_ROWS} rows) to infer X, Y, Z coordinates and numeric feature columns.`,
      featureColumns,
      featureStats,
      points,
      totalPoints: totalValidPoints,
      plottedPoints: points.length,
      sampleRows: rows.slice(0, 20),
    });
  } catch (error: any) {
    console.error("3D inference error:", error);
    return NextResponse.json({ error: error.message || "Failed to infer 3D columns" }, { status: 500 });
  }
}
