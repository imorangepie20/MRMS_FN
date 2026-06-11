"use client";

import { useEffect, useState } from "react";

import { saveEmpSetting } from "@/lib/api/admin-emp";
import type { EmpSettings, EmpSettingValue } from "@/lib/types";


export function SettingsCard({
  settings,
  onSaved,
}: {
  settings: EmpSettings["settings"] | null;
  onSaved: () => Promise<void>;
}) {
  const [tokenInput, setTokenInput] = useState("");
  const [sourcesInput, setSourcesInput] = useState("");
  const [spotifySourcesInput, setSpotifySourcesInput] = useState("");
  const [floSourcesInput, setFloSourcesInput] = useState("");
  const [vibeSourcesInput, setVibeSourcesInput] = useState("");
  const [appleSourcesInput, setAppleSourcesInput] = useState("");
  const [saving, setSaving] = useState(false);

  const tokenSetting: EmpSettingValue | undefined = settings?.["tidal_x_token"];
  const sourcesSetting: EmpSettingValue | undefined = settings?.["tidal_emp_sources"];
  const spotifySourcesSetting: EmpSettingValue | undefined = settings?.["spotify_emp_sources"];
  const floSourcesSetting: EmpSettingValue | undefined = settings?.["flo_emp_sources"];
  const vibeSourcesSetting: EmpSettingValue | undefined = settings?.["vibe_emp_sources"];
  const appleSourcesSetting: EmpSettingValue | undefined = settings?.["apple_emp_sources"];

  // Initialise sources textareas from server value whenever settings load/refresh
  useEffect(() => {
    if (sourcesSetting && "value" in sourcesSetting) {
      setSourcesInput(sourcesSetting.value ?? "");
    }
  }, [sourcesSetting]);

  useEffect(() => {
    if (spotifySourcesSetting && "value" in spotifySourcesSetting) {
      setSpotifySourcesInput(spotifySourcesSetting.value ?? "");
    }
  }, [spotifySourcesSetting]);

  useEffect(() => {
    if (floSourcesSetting && "value" in floSourcesSetting) {
      setFloSourcesInput(floSourcesSetting.value ?? "");
    }
  }, [floSourcesSetting]);

  useEffect(() => {
    if (vibeSourcesSetting && "value" in vibeSourcesSetting) {
      setVibeSourcesInput(vibeSourcesSetting.value ?? "");
    }
  }, [vibeSourcesSetting]);

  useEffect(() => {
    if (appleSourcesSetting && "value" in appleSourcesSetting) {
      setAppleSourcesInput(appleSourcesSetting.value ?? "");
    }
  }, [appleSourcesSetting]);

  const saveToken = async () => {
    if (!tokenInput.trim()) {
      alert("값을 입력하세요");
      return;
    }
    setSaving(true);
    try {
      await saveEmpSetting("tidal_x_token", tokenInput.trim());
      setTokenInput("");
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const clearToken = async () => {
    if (!confirm("Tidal token 삭제?")) return;
    setSaving(true);
    try {
      await saveEmpSetting("tidal_x_token", null);
      await onSaved();
    } catch (e) {
      alert(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSources = async () => {
    setSaving(true);
    try {
      await saveEmpSetting("tidal_emp_sources", sourcesInput.trim() || null);
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSpotifySources = async () => {
    setSaving(true);
    try {
      await saveEmpSetting("spotify_emp_sources", spotifySourcesInput.trim() || null);
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveFloSources = async () => {
    setSaving(true);
    try {
      await saveEmpSetting("flo_emp_sources", floSourcesInput.trim() || null);
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveVibeSources = async () => {
    setSaving(true);
    try {
      await saveEmpSetting("vibe_emp_sources", vibeSourcesInput.trim() || null);
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveAppleSources = async () => {
    setSaving(true);
    try {
      await saveEmpSetting("apple_emp_sources", appleSourcesInput.trim() || null);
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-10">
      <h2 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-(--mrms-ink)">
        Settings
      </h2>

      {/* Token row */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] py-2 border-b border-(--mrms-rule)">
        <span className="text-(--mrms-ink-mute) tracking-editorial uppercase min-w-[120px]">
          tidal_x_token
        </span>
        <span className="text-(--mrms-ink-soft) truncate flex-1 min-w-[100px]">
          {tokenSetting?.present ? `set · ${tokenSetting.preview}` : "— not set —"}
        </span>
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="paste token"
          className="border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) w-[180px]"
        />
        <button
          onClick={saveToken}
          disabled={saving || !tokenInput.trim()}
          className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
        >
          Save
        </button>
        {tokenSetting?.present && (
          <button
            onClick={clearToken}
            disabled={saving}
            className="bg-transparent border border-(--mrms-rust) text-(--mrms-rust) px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Sources row */}
      <div className="py-2 border-b border-(--mrms-rule)">
        <div className="font-mono text-[11px] text-(--mrms-ink-mute) tracking-editorial uppercase mb-2">
          tidal_emp_sources
        </div>
        <textarea
          value={sourcesInput}
          onChange={(e) => setSourcesInput(e.target.value)}
          placeholder={`pages/explore\npages/genre_jazz\nplaylist/31885f0b-96dc-41e1-8e1b-f83372043208`}
          rows={8}
          className="w-full border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={saveSources}
            disabled={saving}
            className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
          >
            Save sources
          </button>
        </div>
      </div>

      {/* Spotify sources row */}
      <div className="py-2 border-b border-(--mrms-rule)">
        <div className="font-mono text-[11px] text-(--mrms-ink-mute) tracking-editorial uppercase mb-2">
          spotify_emp_sources
        </div>
        <textarea
          value={spotifySourcesInput}
          onChange={(e) => setSpotifySourcesInput(e.target.value)}
          placeholder={`search-tracks/year:2026 genre:k-pop\nplaylist/<id>`}
          rows={8}
          className="w-full border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={saveSpotifySources}
            disabled={saving}
            className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
          >
            Save sources
          </button>
        </div>
      </div>

      {/* FLO sources row */}
      <div className="py-2 border-b border-(--mrms-rule)">
        <div className="font-mono text-[11px] text-(--mrms-ink-mute) tracking-editorial uppercase mb-2">
          flo_emp_sources
        </div>
        <textarea
          value={floSourcesInput}
          onChange={(e) => setFloSourcesInput(e.target.value)}
          placeholder={`special\nplaylist/<id>\nchannel/<id>`}
          rows={8}
          className="w-full border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={saveFloSources}
            disabled={saving}
            className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
          >
            Save sources
          </button>
        </div>
      </div>

      {/* VIBE sources row */}
      <div className="py-2 border-b border-(--mrms-rule)">
        <div className="font-mono text-[11px] text-(--mrms-ink-mute) tracking-editorial uppercase mb-2">
          vibe_emp_sources
        </div>
        <textarea
          value={vibeSourcesInput}
          onChange={(e) => setVibeSourcesInput(e.target.value)}
          placeholder={`stations\ntheme\nstation/20000011\nplaylist/<plId>`}
          rows={6}
          className="w-full border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={saveVibeSources}
            disabled={saving}
            className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
          >
            Save sources
          </button>
        </div>
      </div>

      {/* Apple sources row */}
      <div className="py-2 border-b border-(--mrms-rule)">
        <div className="font-mono text-[11px] text-(--mrms-ink-mute) tracking-editorial uppercase mb-2">
          apple_emp_sources
        </div>
        <textarea
          value={appleSourcesInput}
          onChange={(e) => setAppleSourcesInput(e.target.value)}
          placeholder={`songs/kr\nalbums/us\nplaylists/us\nalbum/<id>`}
          rows={5}
          className="w-full border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={saveAppleSources}
            disabled={saving}
            className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
          >
            Save sources
          </button>
        </div>
      </div>

      <p className="mt-2 font-mono text-[10px] text-(--mrms-ink-mute)">
        Tidal web client의 X-Tidal-Token. 값이 있으면 importer가 editorial playlists 받아옴.
        <br />
        <span className="mt-1 block">
          Sources: 한 줄에 하나씩.{" "}
          <code>pages/&lt;slug&gt;</code> = 해당 페이지에서 playlist discover.{" "}
          <code>playlist/&lt;uuid&gt;</code> = 직접 추가. 비우면 default (explore + 17개 장르).
        </span>
        <span className="mt-1 block">
          Spotify sources: <code>search-tracks/&lt;query&gt;</code> = 트랙 검색 (예:{" "}
          <code>search-tracks/year:2026 genre:k-pop</code>),{" "}
          <code>playlist/&lt;id&gt;</code> = playlist 직접 추가 (OAuth 필요).
        </span>
        <span className="mt-1 block">
          FLO sources: <code>special</code> = 큐레이션 섹션 자동 발견,{" "}
          <code>playlist/&lt;id&gt;</code> / <code>channel/&lt;id&gt;</code> = 직접 추가.
          비우면 default (special 자동).
        </span>
        <span className="mt-1 block">
          VIBE sources: <code>stations</code> = DJ 스테이션 전체(MOOD/GENRE),{" "}
          <code>theme</code> = 테마 플리 자동,{" "}
          <code>station/&lt;no&gt;</code> / <code>playlist/&lt;plId&gt;</code> = 직접. 비우면 default (stations + theme).
        </span>
        <span className="mt-1 block">
          Apple sources: <code>songs/&lt;region&gt;</code> = 지역 인기곡 Top 50 (RSS),{" "}
          <code>albums/&lt;region&gt;</code> / <code>playlists/&lt;region&gt;</code> = 지역 인기
          앨범/플리 Top 50 (각 페이지 스크래핑),{" "}
          <code>album/&lt;id&gt;</code> / <code>playlist/&lt;id&gt;</code> = 직접 추가.
          비우면 default (songs/kr + songs/us). album/playlist는 요청 많아 옵트인.
        </span>
        <span className="mt-1 block">
          Melon Hot 100 자동 — 소스 고정이라 설정 불필요.
        </span>
      </p>
    </section>
  );
}
