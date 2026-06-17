"use client";

import { createContext, useContext } from "react";

/** 대시보드(로그인·DndContext 존재) 안에서만 true. 공유 페이지·비대시보드는 false →
 *  플레이리스트 ＋메뉴/드래그 핸들을 렌더하지 않아 안전. */
export const PlaylistActionsContext = createContext(false);
export const usePlaylistActionsEnabled = () => useContext(PlaylistActionsContext);
