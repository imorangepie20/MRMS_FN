import { type LucideIcon, Folder, FileText, ImageIcon, Music, Video } from "lucide-react"

export type FileKind = "folder" | "document" | "image" | "music" | "video"

export interface FileItem {
  id: string
  name: string
  kind: FileKind
  size: string | null
  modified: string
  itemCount?: number
  icon: LucideIcon
}

export interface FolderNode {
  id: string
  name: string
  children?: FolderNode[]
}

export const sidebarTree: FolderNode[] = [
  {
    id: "documents",
    name: "Documents",
    children: [
      { id: "documents-design", name: "Design" },
      { id: "documents-projects", name: "Projects" },
    ],
  },
  {
    id: "downloads",
    name: "Downloads",
  },
  {
    id: "pictures",
    name: "Pictures",
    children: [
      { id: "pictures-screenshots", name: "Screenshots" },
      { id: "pictures-wallpapers", name: "Wallpapers" },
    ],
  },
  {
    id: "music",
    name: "Music",
    children: [
      { id: "music-albums", name: "Albums" },
    ],
  },
]

export const storageUsedGB = 6.5
export const storageTotalGB = 10

export const fileItems: FileItem[] = [
  {
    id: "folder-design",
    name: "Design",
    kind: "folder",
    size: null,
    modified: "12.09.20",
    itemCount: 24,
    icon: Folder,
  },
  {
    id: "folder-projects",
    name: "Projects",
    kind: "folder",
    size: null,
    modified: "11.15.20",
    itemCount: 18,
    icon: Folder,
  },
  {
    id: "folder-documents",
    name: "Documents",
    kind: "folder",
    size: null,
    modified: "10.03.20",
    itemCount: 42,
    icon: Folder,
  },
  {
    id: "file-arion",
    name: "Arion – Admin Dashboard & UI Kit",
    kind: "document",
    size: "1.2 MB",
    modified: "12.09.20",
    icon: FileText,
  },
  {
    id: "file-brand",
    name: "Brand Styles Guide",
    kind: "document",
    size: "4.5 MB",
    modified: "11.22.20",
    icon: FileText,
  },
  {
    id: "file-vcard",
    name: "vCard – Resume",
    kind: "document",
    size: "2.5 MB",
    modified: "10.18.20",
    icon: FileText,
  },
  {
    id: "file-mockup",
    name: "UI Mockup Screens",
    kind: "image",
    size: "8.1 MB",
    modified: "12.01.20",
    icon: ImageIcon,
  },
  {
    id: "file-logo",
    name: "Company Logo Pack",
    kind: "image",
    size: "3.4 MB",
    modified: "11.30.20",
    icon: ImageIcon,
  },
  {
    id: "file-hero",
    name: "Hero Banner Final",
    kind: "image",
    size: "5.7 MB",
    modified: "11.05.20",
    icon: ImageIcon,
  },
  {
    id: "file-promo",
    name: "Product Promo Video",
    kind: "video",
    size: "124 MB",
    modified: "12.07.20",
    icon: Video,
  },
  {
    id: "file-walkthrough",
    name: "Onboarding Walkthrough",
    kind: "video",
    size: "87 MB",
    modified: "11.12.20",
    icon: Video,
  },
  {
    id: "file-podcast",
    name: "Episode 01 – Kickoff",
    kind: "music",
    size: "32 MB",
    modified: "10.29.20",
    icon: Music,
  },
  {
    id: "file-ambient",
    name: "Ambient Loop Collection",
    kind: "music",
    size: "14 MB",
    modified: "10.14.20",
    icon: Music,
  },
  {
    id: "file-spec",
    name: "Technical Spec Sheet",
    kind: "document",
    size: "0.9 MB",
    modified: "09.28.20",
    icon: FileText,
  },
  {
    id: "file-proposal",
    name: "Project Proposal 2020",
    kind: "document",
    size: "1.8 MB",
    modified: "09.15.20",
    icon: FileText,
  },
  {
    id: "file-icons",
    name: "Icon Set v2.0",
    kind: "image",
    size: "2.2 MB",
    modified: "08.30.20",
    icon: ImageIcon,
  },
]
