// 시험 도우미(시험 목록에는 없음): Supabase 요청을 빈 목록으로 받아 실제 서버로 나가지 않게 한다.
// 로그인하지 않아도 MY가 공지사항을 확인하므로(ui/help.js checkNotices) 계정을 흉내 내지 않는 시험에서 씀 — 공지·문의 흐름 자체는 help.mjs, 계정은 social·vault·cloud2
export const noSupabase = (target) =>
  target.route("https://*.supabase.co/**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
      body: "[]"
    })
  );
