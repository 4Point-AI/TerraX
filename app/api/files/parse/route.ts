import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Papa from "papaparse";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    // Get file record
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(file.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
    }

    let parsedSummary: any = null;
    const lowerFilename = (file.filename || "").toLowerCase();

    if (file.file_kind === "drill_csv" || lowerFilename.endsWith(".csv")) {
      parsedSummary = await parseCSV(fileData, file.filename);
    } else if (file.file_kind === "pdf" || lowerFilename.endsWith(".pdf")) {
      parsedSummary = await parsePDF(fileData, file.filename);
    } else if (lowerFilename.endsWith(".json")) {
      parsedSummary = await parseJSON(fileData, file.filename);
    } else if (lowerFilename.endsWith(".txt") || lowerFilename.endsWith(".xyz") || lowerFilename.endsWith(".las")) {
      parsedSummary = await parseText(fileData, file.filename);
    } else {
      parsedSummary = {
        type: "binary",
        filename: file.filename,
        size_bytes: file.size_bytes,
        file_kind: file.file_kind,
        summary: `Binary file: ${file.filename} (${file.file_kind}, ${Math.round(file.size_bytes / 1024)}KB). Content cannot be parsed directly.`,
      };
    }

    // Store parsed summary in the files table.
    // Do not coerce update response to a single row, because some RLS setups do not
    // return updated rows even when the update succeeds (which causes PGRST116).
    const { error: updateError } = await supabase
      .from("files")
      .update({ parsed_summary: parsedSummary })
      .eq("id", fileId);

    if (updateError) {
      console.error("Failed to update parsed_summary:", updateError);
      return NextResponse.json(
        { error: `Parsed file but failed to save summary: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Best-effort readback for confirmation when SELECT is allowed by policy.
    const { data: updatedFile } = await supabase
      .from("files")
      .select("id, parsed_summary")
      .eq("id", fileId)
      .maybeSingle();

    if (updatedFile && !updatedFile.parsed_summary) {
      return NextResponse.json(
        { error: "Parsed file but parsed summary was not persisted. Check files table RLS update policy." },
        { status: 500 }
      );
    }

    return NextResponse.json({ parsedSummary: updatedFile?.parsed_summary ?? parsedSummary });
  } catch (error: any) {
    console.error("File parse error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse file" },
      { status: 500 }
    );
  }
}

async function parseCSV(blob: Blob, filename: string) {
  const text = await blob.text();
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    preview: 1000, // Parse first 1000 rows for summary
  });

  const headers = result.meta.fields || [];
  const totalRows = text.split("\n").length - 1; // Approximate
  const sampleRows = result.data.slice(0, 5) as Record<string, string>[];

  // Compute column statistics
  const columnStats: Record<string, any> = {};
  for (const col of headers) {
    const values = (result.data as Record<string, string>[])
      .map((row) => row[col])
      .filter((v) => v != null && v !== "");

    const numericValues = values
      .map((v) => parseFloat(v))
      .filter((v) => !isNaN(v));

    if (numericValues.length > values.length * 0.5) {
      // Mostly numeric column
      columnStats[col] = {
        type: "numeric",
        count: numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        nulls: values.length - numericValues.length,
        sample: numericValues.slice(0, 5),
      };
    } else {
      // Text/categorical column
      const uniqueVals = [...new Set(values)];
      columnStats[col] = {
        type: "text",
        count: values.length,
        unique: uniqueVals.length,
        nulls: (result.data as Record<string, string>[]).length - values.length,
        sample: uniqueVals.slice(0, 10),
      };
    }
  }

  // Detect if this looks like drillhole data
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const isDrillhole =
    lowerHeaders.some((h) => h.includes("hole") || h.includes("drill") || h.includes("bhid")) &&
    (lowerHeaders.some((h) => h.includes("from") || h.includes("depth")) ||
     lowerHeaders.some((h) => h.includes("east") || h.includes("north") || h.includes("x") || h.includes("y")));

  const hasCoordinates =
    lowerHeaders.some((h) => h.includes("east") || h === "x" || h.includes("longitude") || h.includes("lng")) &&
    lowerHeaders.some((h) => h.includes("north") || h === "y" || h.includes("latitude") || h.includes("lat"));

  const hasAssays = lowerHeaders.some(
    (h) => h.includes("au") || h.includes("cu") || h.includes("ag") || h.includes("grade") || h.includes("assay")
  );

  // Build readable summary for AI
  let summary = `CSV File: ${filename}\n`;
  summary += `Rows: ${totalRows}, Columns: ${headers.length}\n`;
  summary += `Headers: ${headers.join(", ")}\n\n`;

  if (isDrillhole) summary += `Detected type: Drillhole data\n`;
  if (hasCoordinates) summary += `Contains spatial coordinates\n`;
  if (hasAssays) summary += `Contains assay/grade data\n`;

  summary += `\nColumn Statistics:\n`;
  for (const [col, stats] of Object.entries(columnStats)) {
    if (stats.type === "numeric") {
      summary += `  ${col}: numeric, min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)}, mean=${stats.mean.toFixed(2)}, n=${stats.count}\n`;
    } else {
      summary += `  ${col}: text, ${stats.unique} unique values, sample=[${stats.sample.slice(0, 5).join(", ")}]\n`;
    }
  }

  summary += `\nFirst 5 rows:\n`;
  for (const row of sampleRows) {
    summary += `  ${JSON.stringify(row)}\n`;
  }

  return {
    type: "csv",
    filename,
    totalRows,
    columns: headers,
    columnCount: headers.length,
    columnStats,
    sampleRows,
    isDrillhole,
    hasCoordinates,
    hasAssays,
    summary,
  };
}

async function parsePDF(blob: Blob, filename: string) {
  try {
    const buffer = Buffer.from(await blob.arrayBuffer());
    // Dynamic import to avoid issues with pdf-parse in edge runtime
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);

    const text = data.text || "";
    const truncatedText = text.slice(0, 15000); // First ~15k chars

    const summary = `PDF File: ${filename}\n`;
    const info = `Pages: ${data.numpages}, Characters: ${text.length}\n\n`;
    const content = `Content:\n${truncatedText}${text.length > 15000 ? "\n... (truncated)" : ""}`;

    return {
      type: "pdf",
      filename,
      pages: data.numpages,
      characterCount: text.length,
      extractedText: truncatedText,
      summary: summary + info + content,
    };
  } catch (error: any) {
    return {
      type: "pdf",
      filename,
      error: error.message,
      summary: `PDF File: ${filename}\nFailed to extract text: ${error.message}`,
    };
  }
}

async function parseJSON(blob: Blob, filename: string) {
  const text = await blob.text();
  try {
    const data = JSON.parse(text);
    const keys = Array.isArray(data)
      ? Object.keys(data[0] || {})
      : Object.keys(data);

    const summary = `JSON File: ${filename}\n`;
    const info = Array.isArray(data)
      ? `Array with ${data.length} items\nKeys: ${keys.join(", ")}\n`
      : `Object with ${keys.length} keys: ${keys.join(", ")}\n`;

    const preview = JSON.stringify(data, null, 2).slice(0, 5000);

    return {
      type: "json",
      filename,
      isArray: Array.isArray(data),
      itemCount: Array.isArray(data) ? data.length : null,
      keys,
      summary: summary + info + `\nPreview:\n${preview}`,
    };
  } catch {
    return {
      type: "json",
      filename,
      error: "Invalid JSON",
      summary: `JSON File: ${filename}\nFailed to parse as valid JSON.`,
    };
  }
}

async function parseText(blob: Blob, filename: string) {
  const text = await blob.text();
  const lines = text.split("\n");
  const truncated = lines.slice(0, 200).join("\n");

  return {
    type: "text",
    filename,
    lineCount: lines.length,
    characterCount: text.length,
    preview: truncated,
    summary: `Text File: ${filename}\nLines: ${lines.length}, Characters: ${text.length}\n\nContent:\n${truncated}${lines.length > 200 ? "\n... (truncated)" : ""}`,
  };
}
