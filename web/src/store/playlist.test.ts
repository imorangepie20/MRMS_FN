import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api/playlists", () => ({
  addTracksToPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  listPlaylists: vi.fn(),
  updatePlaylist: vi.fn(),
}));

import { usePlaylistStore } from "./playlist";
import { addTracksToPlaylist } from "@/lib/api/playlists";

describe("playlist store addTracks", () => {
  beforeEach(() => {
    usePlaylistStore.setState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playlists: [{ id: "p1", name: "P", track_count: 2 } as any],
      loaded: true,
    });
    vi.clearAllMocks();
  });

  it("벌크 추가 시 added만큼 bumpCount + {added,skipped} 반환", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (addTracksToPlaylist as any).mockResolvedValue({ added: 3, skipped: 1 });
    const res = await usePlaylistStore.getState().addTracks("p1", ["a", "b", "c", "d"]);
    expect(addTracksToPlaylist).toHaveBeenCalledWith("p1", ["a", "b", "c", "d"]);
    expect(res).toEqual({ added: 3, skipped: 1 });
    expect(usePlaylistStore.getState().playlists.find((p) => p.id === "p1")!.track_count).toBe(5);
  });

  it("빈 배열이면 API 호출 안 하고 {added:0,skipped:0}", async () => {
    const res = await usePlaylistStore.getState().addTracks("p1", []);
    expect(addTracksToPlaylist).not.toHaveBeenCalled();
    expect(res).toEqual({ added: 0, skipped: 0 });
  });
});
