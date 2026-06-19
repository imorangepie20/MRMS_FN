"use client";

import { useUser } from "./use-user";

/** 공개 화면(EMP 등)에서 비회원 액션을 게이팅한다.
 *  - isGuest: 로딩이 끝났고 미인증일 때만 true(로딩 중엔 false → 회원의 첫 클릭이 잘못 막히지 않음).
 *  - guard(action): 게스트면 /login으로 보내고, 회원이면 action 실행.
 *  좋아요·저장처럼 게스트에게 무의미한 컨트롤은 isGuest로 숨기고, 재생은 guard로 감싼다. */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useUser();
  const isGuest = !isLoading && !isAuthenticated;

  function guard(action: () => void): () => void {
    return () => {
      if (isGuest) {
        window.location.href = "/login";
        return;
      }
      action();
    };
  }

  return { isGuest, guard };
}
