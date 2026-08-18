// 인증 쿠키가 SameSite=None 으로 나가므로, 이 목록은 "쿠키를 실어 보내고 응답까지 읽을 수 있는
// 오리진" 과 같은 뜻이 된다. 따라서 패턴 매칭이 아니라 정확히 일치하는 오리진만 둔다.
//
// 이전에는 /^https:\/\/ddd-fe-web(-[\w-]+)?\.vercel\.app$/ 를 썼는데, Vercel 프로젝트 이름은
// 팀 단위로만 유일하다. 제3자가 자기 팀에 같은 이름의 프로젝트를 만들면
// ddd-fe-web-<해시>-<남의팀>.vercel.app 를 얻어 이 정규식을 통과했다. SameSite=Lax 시절에는
// 브라우저가 쿠키를 안 실어 실질 위험이 없었지만, None 으로 바꾸는 순간 그 오리진이 지원자
// 인증으로 지원서를 읽고 덮어쓸 수 있게 된다. 그래서 쿠키 속성 변경과 같은 시점에 좁힌다.
//
// 프리뷰 배포에서 이 API 를 불러야 한다면 팀 슬러그를 고정한 형태
// (ddd-fe-web-<해시>-<우리팀슬러그>.vercel.app) 로 다시 넣어야 한다. 슬러그 없이는
// 우리 프리뷰와 남의 프로젝트를 구분할 수 없다.
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://admin.dddstudy.kr',
  'https://ddd-fe-web.vercel.app',
] as const;

// TODO: 지원자 FE 운영 origin은 사용자 확인 후 ALLOWED_ORIGINS에 추가한다. 임의의 origin을 추측하지 않는다.

export const isAllowedOrigin = ({ origin }: { origin: string }): boolean =>
  ALLOWED_ORIGINS.some((allowedOrigin) => allowedOrigin === origin);
