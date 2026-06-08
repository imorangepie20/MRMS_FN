// ─── File Type Cards ──────────────────────────────────────────────────────────

export type FileTypeCard = {
  type: string;
  items: string;
  size: string;
  progress: number;
};

export const fileTypeCards: FileTypeCard[] = [
  { type: "Documents", items: "120 items", size: "2.1 GB used", progress: 35 },
  { type: "Images",    items: "250 items", size: "3.8 GB used", progress: 62 },
  { type: "Videos",    items: "38 items",  size: "7.5 GB used", progress: 89 },
  { type: "Others",    items: "64 items",  size: "1.2 GB used", progress: 28 },
];

// ─── Folders ──────────────────────────────────────────────────────────────────

export type FolderItem = {
  name: string;
  items: string;
  lastUpdate: string;
};

export const folders: FolderItem[] = [
  { name: "Documents", items: "120 items", lastUpdate: "10 days ago" },
  { name: "Images",    items: "250 items", lastUpdate: "2 days ago"  },
  { name: "Downloads", items: "80 items",  lastUpdate: "Yesterday"   },
];

// ─── Monthly File Transfer (chart data) ──────────────────────────────────────

export type TransferDataPoint = {
  day: string;
  uploaded: number;
  downloaded: number;
};

export const transferData: TransferDataPoint[] = [
  { day: "May 11", uploaded: 120, downloaded: 200 },
  { day: "May 13", uploaded: 85,  downloaded: 150 },
  { day: "May 15", uploaded: 200, downloaded: 180 },
  { day: "May 17", uploaded: 145, downloaded: 220 },
  { day: "May 19", uploaded: 95,  downloaded: 130 },
  { day: "May 21", uploaded: 170, downloaded: 260 },
  { day: "May 23", uploaded: 130, downloaded: 190 },
  { day: "May 25", uploaded: 210, downloaded: 240 },
  { day: "May 27", uploaded: 160, downloaded: 170 },
  { day: "May 30", uploaded: 190, downloaded: 300 },
  { day: "Jun 3",  uploaded: 240, downloaded: 280 },
  { day: "Jun 7",  uploaded: 175, downloaded: 310 },
];

// ─── Recently Uploaded Files ──────────────────────────────────────────────────

export type UploadedFile = {
  name: string;
  type: "document" | "image" | "video" | "archive" | "spreadsheet";
  size: string;
  uploadDate: string;
};

export const recentFiles: UploadedFile[] = [
  { name: "project-brief.pdf",     type: "document",    size: "957 KB",     uploadDate: "Apr 28, 2025" },
  { name: "hero-banner.png",       type: "image",       size: "4.2 MB",     uploadDate: "Apr 22, 2025" },
  { name: "demo-recording.mp4",    type: "video",       size: "150.68 MB",  uploadDate: "Apr 15, 2025" },
  { name: "quarterly-report.xlsx", type: "spreadsheet", size: "1.8 MB",     uploadDate: "Apr 10, 2025" },
  { name: "assets-backup.zip",     type: "archive",     size: "38.4 MB",    uploadDate: "Mar 30, 2025" },
];
