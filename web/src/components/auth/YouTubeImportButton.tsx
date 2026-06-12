"use client";

import { useState } from "react";
import { toast } from "sonner";

import { YouTubePlaylistPicker } from "@/components/auth/YouTubePlaylistPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


export function YouTubeImportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        className="w-full"
        size="lg"
      >
        내 YouTube 플레이리스트 가져오기
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>YouTube 플레이리스트 선택</DialogTitle>
          </DialogHeader>

          {open && (
            <YouTubePlaylistPicker
              onImported={() => setOpen(false)}
              onUnauthorized={() => {
                toast.error("먼저 YouTube 계정을 연결해주세요");
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
