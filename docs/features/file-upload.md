# 프로젝트 파일 업로드

대상: 프로젝트 PDF, 썸네일. 작성일 2026-09-18.

## 1. 기존 구현

업로드와 저장이 서로 다른 요청이다.

1. `POST /api/v1/admin/files/upload?category=project-pdf` — 파일을 GCS 에 저장하고 `url` 을 돌려준다.
2. `POST|PATCH /api/v1/admin/projects` — 그 `url` 을 `pdfUrl` 로 보내야 프로젝트에 연결된다.

- 업로드 API 는 프로젝트를 모른다. 받는 값은 `category` 뿐이다.
- GCS 경로는 `projects/pdfs/<uuid>.pdf`. 프로젝트 ID 도 원본 파일명도 남지 않는다.
- 매핑은 `projects.pdfUrl`, `projects.thumbnailUrl` 컬럼이 전부다.
- 어드민 화면은 파일을 고르는 즉시 1 을 호출한다. 2 는 저장 버튼을 눌러야 나간다.
- 용량 상한: PDF 20MB, 썸네일 5MB. 초과 시 413.
- 파일을 교체해도 이전 객체는 GCS 에 남는다.

## 2. 직면한 문제

GCS 에 PDF 는 있는데 어느 프로젝트 것인지 알 수 없었다. (2026-09 문의)

- 저장 없이 뒤로 가면 파일만 남는다.
- 저장 요청이 실패해도 파일만 남는다.
- 업로드가 실패로 보여 재시도하면 같은 파일이 여러 개 쌓인다. 실제로 같은 파일이 3개 있었다.
- 남은 파일은 경로가 uuid 라 주인을 복원할 수 없다.

원인은 버그가 아니라 구조다. 매핑이 클라이언트의 두 번째 요청에 달려 있다.
서버는 오지 않은 요청을 막을 수 없다.

고아 정리 스케줄러(PR #99)는 쌓인 파일을 30일 뒤 지울 뿐, 발생 자체는 못 막는다.

## 3. 적용한 것

업로드와 매핑을 한 요청으로 묶었다.

### 새 엔드포인트

| 메서드 | 경로 | 상한 | 허용 타입 |
| --- | --- | --- | --- |
| POST | `/api/v1/admin/projects/:id/pdf` | 20MB | `application/pdf` |
| POST | `/api/v1/admin/projects/:id/thumbnail` | 5MB | jpeg, png, webp |

- 본문: `multipart/form-data`, 필드명 `file`.
- 응답: 200, 갱신된 프로젝트(`ProjectDetailResponseDto`).
- 권한: `계정관리`, `운영자`.
- operationId: `project_uploadPdfAdmin`, `project_uploadThumbnailAdmin`.

| 상황 | 응답 |
| --- | --- |
| 프로젝트 없음 | 404 `PROJECT_NOT_FOUND` |
| 파일 없음 | 400 `FILE_NOT_PROVIDED` |
| 타입·확장자 불일치 | 400 `FILE_TYPE_NOT_ALLOWED` |
| 용량 초과 | 413 |

### 처리 순서

GCS 와 DB 는 한 트랜잭션으로 묶이지 않는다. 순서로 안전을 만든다.

1. 프로젝트 조회. 없으면 404, 업로드하지 않는다.
2. 새 파일을 GCS 에 저장한다.
3. DB 의 `pdfUrl`(또는 `thumbnailUrl`)을 새 URL 로 갱신한다.
4. 3 이 실패하면 2 에서 올린 객체를 지우고 오류를 던진다.
5. 3 이 성공한 뒤에만 이전 파일을 지운다.

- 어느 단계에서 끊겨도 프로젝트는 유효한 파일을 가리킨다.
- 이전 파일 삭제가 실패해도 요청은 성공이다.
- 다른 프로젝트가 같은 파일을 참조하면 이전 파일을 지우지 않는다.
- 참조 비교는 URL 이 아니라 파일명(uuid)으로 한다. 인코딩·CDN 표기 차이를 피한다.
- 보상 삭제까지 실패한 객체는 고아 정리 스케줄러가 치운다. 그래서 스케줄러는 유지한다.
- DB 트랜잭션은 걸지 않았다. 업로드 동안 커넥션을 쥘 이유가 없다.

프로젝트당 PDF 1개, 썸네일 1개. DB 와 GCS 가 같은 상태를 유지한다.

### 프론트 적용 방법

파일 선택 시점이 아니라 저장 시점에 올린다.

```ts
// 생성
const project = await createProject(fields);            // ① 순차. id 가 필요하다
const results = await Promise.allSettled([              // ② 파일끼리만 병렬
  pdfFile && uploadProjectPdf(project.id, pdfFile),
  thumbnailFile && uploadProjectThumbnail(project.id, thumbnailFile),
]);
```

- ① 실패: 아무것도 생기지 않는다. 저장을 다시 눌러도 된다.
- ② 실패: 프로젝트는 이미 있다. 받은 id 로 ② 만 재시도한다. ① 을 다시 보내면 중복 생성된다.
- `Promise.allSettled` 를 쓴다. 실패한 파일만 골라 재시도할 수 있다.
- 수정 화면도 같다. `PATCH` 후 바뀐 파일만 ② 로 보낸다.
- 저장 전 썸네일 미리보기는 `URL.createObjectURL` 로 처리한다.
- 새 API 는 호출 즉시 반영된다. 저장 전에 호출하면 공개 페이지가 먼저 바뀐다.

### 남겨둔 것

- `POST /admin/files/upload` 는 그대로다. 블로그 썸네일이 쓴다.
- `PATCH` 의 `pdfUrl`, `thumbnailUrl` 직접 지정도 그대로다. 프론트 전환이 끝나면 제거한다.
- 같은 프로젝트에 동시에 두 번 올리면 하나가 고아로 남을 수 있다. 스케줄러가 치운다.

### 코드 위치

| 역할 | 파일 |
| --- | --- |
| 교체 로직 | `src/project/application/project-asset.service.ts` |
| 종류별 설정, 파일명 추출 | `src/project/domain/project-asset.ts` |
| 엔드포인트 | `src/project/interface/admin.project.controller.ts` |
| 고아 정리 | `src/project/application/project-asset-purge.service.ts` |
| 용량·타입 정책 | `src/storage/domain/storage.type.ts` |
