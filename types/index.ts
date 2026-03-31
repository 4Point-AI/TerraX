export interface Profile {
  id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface FileRecord {
  id: string;
  project_id: string;
  uploader_id: string;
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  file_kind: 'drill_csv' | 'geophysics' | 'block_model' | 'pdf' | 'other';
  parsed_summary: ParsedFileSummary | null;
  created_at: string;
}

export interface ParsedFileSummary {
  type: 'csv' | 'pdf' | 'json' | 'text' | 'binary';
  filename: string;
  summary: string;
  // CSV-specific
  totalRows?: number;
  columns?: string[];
  columnCount?: number;
  columnStats?: Record<string, any>;
  sampleRows?: Record<string, string>[];
  isDrillhole?: boolean;
  hasCoordinates?: boolean;
  hasAssays?: boolean;
  // PDF-specific
  pages?: number;
  characterCount?: number;
  extractedText?: string;
  // Error
  error?: string;
}

export interface AOI {
  id: string;
  project_id: string;
  name: string;
  geojson: any;
  bbox: any;
  created_at: string;
}

export interface Chat {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  artifacts: {
    table?: any[];
    mapLayers?: any[];
    sceneSpec?: any;
    followups?: string[];
    riskFlags?: string[];
  } | null;
  created_at: string;
}

export interface Report {
  id: string;
  project_id: string;
  chat_id: string | null;
  title: string;
  content_markdown: string;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  project_summary: string;
  data_description: string;
  created_at: string;
}

export interface SceneSpec {
  type: '3d';
  drillholes?: {
    collar: { id: string; x: number; y: number; z: number; }[];
    traces?: { from: number[]; to: number[]; color: string; }[];
  };
  points?: { x: number; y: number; z: number; color: string; value?: number; }[];
  volumes?: { bounds: number[]; data: number[]; }[];
  bounds: { min: number[]; max: number[]; };
}
