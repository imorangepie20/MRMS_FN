import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileTypeCards } from "@/components/dashboards/file-manager/widgets";
import { FolderCards } from "@/components/dashboards/file-manager/widgets";
import { StorageSpaceCard } from "@/components/dashboards/file-manager/widgets";
import { MonthlyFileTransferCard } from "@/components/dashboards/file-manager/charts";
import { RecentlyUploadedFilesCard } from "@/components/dashboards/file-manager/recent-files";

export default function FileManagerPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">File Manager</h1>
        <Button>
          <Upload className="size-4" />
          Upload
        </Button>
      </div>

      {/* File Type Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FileTypeCards />
      </div>

      {/* Folders */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FolderCards />
      </div>

      {/* Storage + Monthly Transfer */}
      <div className="grid gap-4 lg:grid-cols-3">
        <StorageSpaceCard />
        <MonthlyFileTransferCard />
      </div>

      {/* Recently Uploaded Files */}
      <RecentlyUploadedFilesCard />
    </div>
  );
}
