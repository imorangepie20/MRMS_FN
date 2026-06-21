import { describe, it, expect } from "vitest";

import type { EmpSection, EmpSectionItem } from "@/lib/types";

import { pickClassicalVideos, pickSectionVideos } from "./classical-fetch";

function section(
  items: Partial<EmpSectionItem>[],
  key = "video:classical-live",
): EmpSection {
  return {
    id: "sec1",
    platform: "youtube",
    section_key: key,
    display_title: "공연 실황",
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

describe("pickSectionVideos", () => {
  it("주어진 섹션키의 youtube_video만 display_order 순으로", () => {
    const out = pickSectionVideos(
      [
        section([{ item_id: "b", display_order: 2 }, { item_id: "a", display_order: 1 }], "video:jazz-live"),
      ],
      "video:jazz-live",
    );
    expect(out.map((v) => v.videoId)).toEqual(["a", "b"]);
  });

  it("videoId 없는 / youtube_video 아닌 item 제외", () => {
    const out = pickSectionVideos(
      [section([{ item_id: "" }, { item_id: "v", item_type: "video" }, { item_id: "ok" }], "video:jazz-live")],
      "video:jazz-live",
    );
    expect(out.map((v) => v.videoId)).toEqual(["ok"]);
  });

  it("섹션키 불일치 / 빈 입력이면 빈 배열", () => {
    expect(pickSectionVideos([section([{ item_id: "x" }], "video:classical-live")], "video:jazz-live")).toEqual([]);
    expect(pickSectionVideos([], "video:jazz-live")).toEqual([]);
  });

  it("title/cover 매핑 + title 없으면 기본 라벨", () => {
    const out = pickSectionVideos(
      [section([{ item_id: "z", title: null, cover_url: "thumb" }], "video:jazz-live")],
      "video:jazz-live",
    );
    expect(out[0]).toEqual({ videoId: "z", title: "공연 실황", cover: "thumb" });
  });
});

describe("pickClassicalVideos (래퍼)", () => {
  it("video:classical-live 섹션만 골라냄", () => {
    const out = pickClassicalVideos([
      section([{ item_id: "c" }], "video:classical-live"),
      section([{ item_id: "j" }], "video:jazz-live"),
    ]);
    expect(out.map((v) => v.videoId)).toEqual(["c"]);
  });
});
