/** API fetch 공통 헬퍼.
 *  - credentials: "include" 기본 적용 (init으로 override 가능)
 *  - !ok 시 FastAPI 에러 body의 `detail`(string인 경우만)을 메시지에 덧붙여 throw:
 *    `${label} failed: ${status} ${detail}` (detail 없으면 기존과 동일하게 status까지만)
 *  성공 시 Response를 그대로 반환 — body 파싱 여부는 호출부가 결정.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
  label = "request",
): Promise<Response> {
  const r = await fetch(input, { credentials: "include", ...init });
  if (!r.ok) {
    let detail = "";
    try {
      const body = await r.json();
      if (typeof body?.detail === "string") detail = ` ${body.detail}`;
    } catch {
      // body가 JSON이 아니면 status만 노출 (기존 동작)
    }
    throw new Error(`${label} failed: ${r.status}${detail}`);
  }
  return r;
}
