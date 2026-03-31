import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ValidationIssue {
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { fileId } = await request.json();
    if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });

    // Fetch file record with parsed summary
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const issues: ValidationIssue[] = [];
    const summary = file.parsed_summary;

    if (!summary) {
      issues.push({
        severity: "warning",
        category: "Parsing",
        message: "File has not been parsed yet",
        details: "Parse the file first to enable full validation",
      });
      return NextResponse.json({ issues, score: 0 });
    }

    // === CSV VALIDATION ===
    if (summary.type === "csv") {
      const cols = (summary.columns || []).map((c: string) => c.toLowerCase());

      // Check for minimum row count
      if (summary.totalRows !== undefined) {
        if (summary.totalRows < 5) {
          issues.push({
            severity: "warning",
            category: "Data Volume",
            message: `Only ${summary.totalRows} rows detected`,
            details: "Very small dataset — results may not be statistically meaningful",
          });
        } else if (summary.totalRows > 1000) {
          issues.push({
            severity: "info",
            category: "Data Volume",
            message: `${summary.totalRows.toLocaleString()} rows — large dataset`,
          });
        }
      }

      // Drillhole-specific checks
      if (summary.isDrillhole) {
        // Check for required drillhole columns
        const holeIdCol = cols.find((c: string) => c.includes("hole") || c.includes("bhid") || c.includes("drill"));
        const fromCol = cols.find((c: string) => c === "from" || c.includes("from_m") || c.includes("from_depth"));
        const toCol = cols.find((c: string) => c === "to" || c.includes("to_m") || c.includes("to_depth"));

        if (!holeIdCol) {
          issues.push({
            severity: "error",
            category: "Missing Column",
            message: "No hole ID column found (e.g., BHID, HoleID, DrillholeID)",
            details: "A unique hole identifier is required for drillhole data",
          });
        }

        if (!fromCol || !toCol) {
          issues.push({
            severity: "error",
            category: "Missing Column",
            message: `Missing ${!fromCol ? "FROM" : ""}${!fromCol && !toCol ? " and " : ""}${!toCol ? "TO" : ""} depth column(s)`,
            details: "Interval data requires FROM and TO depth columns for proper analysis",
          });
        }

        // Check for coordinate columns
        if (!summary.hasCoordinates) {
          issues.push({
            severity: "warning",
            category: "Missing Data",
            message: "No coordinate columns detected (Easting/Northing or Lat/Lng)",
            details: "Spatial analysis and 3D visualization require collar coordinates",
          });
        }

        // Check for assay columns
        if (!summary.hasAssays) {
          issues.push({
            severity: "info",
            category: "Data Type",
            message: "No assay columns detected (Au, Cu, Ag, etc.)",
            details: "This may be a collar or survey file rather than an assay file",
          });
        }

        // Check sample rows for issues
        if (summary.sampleRows && summary.sampleRows.length > 0) {
          const sampleCols = summary.columns || [];

          // Check for missing values in sample data
          let missingCount = 0;
          let totalCells = 0;
          for (const row of summary.sampleRows) {
            for (const col of sampleCols) {
              totalCells++;
              const val = row[col];
              if (val === null || val === undefined || val === "" || val === "NA" || val === "N/A" || val === "-") {
                missingCount++;
              }
            }
          }
          if (totalCells > 0 && missingCount / totalCells > 0.1) {
            issues.push({
              severity: "warning",
              category: "Data Quality",
              message: `~${Math.round((missingCount / totalCells) * 100)}% missing values in sampled rows`,
              details: "High proportion of missing data may affect analysis reliability",
            });
          }

          // Check for negative depth values
          if (fromCol || toCol) {
            for (const row of summary.sampleRows) {
              const fromKey = sampleCols.find((c: string) => c.toLowerCase() === fromCol);
              const toKey = sampleCols.find((c: string) => c.toLowerCase() === toCol);
              if (fromKey && toKey) {
                const fromVal = parseFloat(row[fromKey]);
                const toVal = parseFloat(row[toKey]);
                if (!isNaN(fromVal) && !isNaN(toVal)) {
                  if (fromVal < 0 || toVal < 0) {
                    issues.push({
                      severity: "error",
                      category: "Invalid Data",
                      message: "Negative depth values detected",
                      details: "FROM/TO depths should not be negative — check for data entry errors",
                    });
                    break;
                  }
                  if (fromVal >= toVal) {
                    issues.push({
                      severity: "error",
                      category: "Interval Error",
                      message: "FROM depth >= TO depth in one or more intervals",
                      details: "FROM must be less than TO for valid downhole intervals",
                    });
                    break;
                  }
                }
              }
            }
          }

          // Check for duplicate hole IDs with same intervals
          if (holeIdCol) {
            const holeKey = sampleCols.find((c: string) => c.toLowerCase() === holeIdCol);
            if (holeKey) {
              const seen = new Set<string>();
              let duplicates = false;
              for (const row of summary.sampleRows) {
                const fromKey = sampleCols.find((c: string) => c.toLowerCase() === fromCol);
                const key = `${row[holeKey]}_${fromKey ? row[fromKey] : ""}`;
                if (seen.has(key)) {
                  duplicates = true;
                  break;
                }
                seen.add(key);
              }
              if (duplicates) {
                issues.push({
                  severity: "warning",
                  category: "Duplicates",
                  message: "Possible duplicate intervals detected in sample data",
                  details: "Same hole ID and FROM depth appear multiple times",
                });
              }
            }
          }
        }

        // Column stats checks
        if (summary.columnStats) {
          for (const [colName, stats] of Object.entries(summary.columnStats as Record<string, any>)) {
            if (stats.type === "numeric") {
              // Check for outliers (values far from mean)
              if (stats.min !== undefined && stats.max !== undefined && stats.mean !== undefined) {
                const range = stats.max - stats.min;
                if (range > 0 && stats.max > stats.mean * 100) {
                  issues.push({
                    severity: "warning",
                    category: "Outliers",
                    message: `Possible outlier in "${colName}" — max (${stats.max}) is >100× the mean (${stats.mean.toFixed(2)})`,
                    details: "Review for data entry errors or extreme values",
                  });
                }
              }
              // Check for all-zero columns
              if (stats.min === 0 && stats.max === 0) {
                issues.push({
                  severity: "info",
                  category: "Empty Column",
                  message: `Column "${colName}" contains all zeros`,
                });
              }
            }
          }
        }
      } else {
        // Non-drillhole CSV
        if (summary.columnCount && summary.columnCount < 2) {
          issues.push({
            severity: "warning",
            category: "Data Structure",
            message: "Only 1 column detected — check CSV delimiter",
            details: "The file may not be comma-separated",
          });
        }
      }
    }

    // === PDF VALIDATION ===
    if (summary.type === "pdf") {
      if (summary.characterCount !== undefined && summary.characterCount < 100) {
        issues.push({
          severity: "warning",
          category: "Content",
          message: "Very little text extracted from PDF",
          details: "The PDF may be image-based or scanned — text extraction is limited",
        });
      }
      if (summary.pages && summary.pages > 100) {
        issues.push({
          severity: "info",
          category: "Size",
          message: `Large document: ${summary.pages} pages`,
          details: "Only a portion of the text may be used for AI context",
        });
      }
    }

    // No issues = good
    if (issues.length === 0) {
      issues.push({
        severity: "info",
        category: "Validation",
        message: "No issues detected — data looks clean",
      });
    }

    // Calculate a simple quality score
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10);

    return NextResponse.json({ issues, score });
  } catch (error: any) {
    console.error("Validation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
