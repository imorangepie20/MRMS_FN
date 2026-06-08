"use client";

import {
  FileText,
  ImageIcon,
  Video,
  Archive,
  Sheet,
  Download,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { recentFiles, type UploadedFile } from "./data";

function FileTypeIcon({ type }: { type: UploadedFile["type"] }) {
  switch (type) {
    case "document":    return <FileText className="size-4 text-blue-500"             />;
    case "image":       return <ImageIcon className="size-4 text-purple-500"          />;
    case "video":       return <Video     className="size-4 text-rose-500"            />;
    case "spreadsheet": return <Sheet     className="size-4 text-emerald-500"         />;
    case "archive":     return <Archive   className="size-4 text-amber-500"           />;
    default:            return <FileText  className="size-4 text-muted-foreground"    />;
  }
}

export function RecentlyUploadedFilesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recently Uploaded Files</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentFiles.map((file) => (
              <TableRow key={file.name}>
                <TableCell className="pl-(--card-spacing)">
                  <div className="flex items-center gap-2">
                    <FileTypeIcon type={file.type} />
                    <span className="font-medium">{file.name}</span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {file.size}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {file.uploadDate}
                </TableCell>
                <TableCell className="pr-(--card-spacing) text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">File actions</span>
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Download className="size-4" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Pencil className="size-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive">
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
