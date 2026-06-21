import { describe, it, expect } from "vitest";

import type { EmpSection, EmpSectionItem } from "@/lib/types";

import { pickClassicalVideos } from "./classical-fetch";

function section(
  items: Partial<EmpSectionItem>[],
  key = "video:classical-live",
): EmpSection {
  return {
    id: "sec1",
    platform: "youtube",
    section_key: key,
    display_title: "클래식 공연 실황",
    display_order: 0,
    last_synced_at: null,
    items: items.map((it, i) => ({
      id: `i${i}`,
      item_type: "youtube_video",
      item_id: `vid${i}`,
      title: `T${i}`,
      cover_url: `c${i}`,
      display_order: i,
      ...it,
    })) as EmpSectionItem[],
  };
}

describe("pickClassicalVideos", () => {
  it("video:classical-live 섹션의 youtube_video만 display_order 순으로", () => {
    const out = pickClassicalVideos([
      section([
        { item_id: "b", display_order: 2 },
        { item_id: "a", display_order: 1 },
      ]),
    ]);
    expect(out.map((v) => v.videoId)).toEqual(["a", "b"]);
  });

  it("videoId(item_id) 없는 item 제외", () => {
    const out = pickClassicalVideos([section([{ item_id: "" }, { item_id: "ok" }])]);
    expect(out.map((v) => v.videoId)).toEqual(["ok"]);
  });

  it("youtube_video 아닌 item 제외", () => {
    const out = pickClassicalVideos([
      section([
        { item_id: "v", item_type: "video" },
        { item_id: "ok", item_type: "youtube_video" },
      ]),
    ]);
    expect(out.map((v) => v.videoId)).toEqual(["ok"]);
  });

  it("classical 섹션 없으면 빈 배열", () => {
    expect(pickClassicalVideos([section([{ item_id: "x" }], "video:other")])).toEqual([]);
    expect(pickClassicalVideos([])).toEqual([]);
  });

  it("title/cover 매핑 + title 없으면 기본 라벨", () => {
    const out = pickClassicalVideos([
      section([{ item_id: "z", title: null, cover_url: "thumb" }]),
    ]);
    expect(out[0]).toEqual({ videoId: "z", title: "클래식 공연 실황", cover: "thumb" });
  });
});
