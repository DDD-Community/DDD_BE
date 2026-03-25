# Copilot All-in-One Instructions

이 파일 하나로 GitHub Copilot이 다음을 우선 지키게 한다.
- CODE_RULES 준수 여부 점검
- 도메인 분리 상태 점검
- DDD + Layered Architecture 준수 여부 점검
- 한국어 PR 메시지 작성
- 한국어 리뷰 코멘트 작성

## 기본 전제
- 이 저장소는 NestJS + TypeScript 기반 백엔드다.
- 최우선 기준은 가독성, 책임 분리, 일관성이다.
- 기존 네이밍, 포맷, ESLint, Prettier, 폴더 구조 컨벤션을 우선 준수한다.
- 답변, 리뷰, PR 메시지는 기본적으로 한국어로 작성한다.

## 아키텍처 핵심 규칙
- DDD + Layered Architecture를 지킨다.
- 의존 방향은 항상 Interface -> Application -> Domain 이다.
- Domain Layer는 framework-free 여야 하며 NestJS, ORM, 외부 SDK, HTTP/DB 구현 세부사항에 의존하지 않는다.
- Application Layer는 유스케이스 조합과 트랜잭션 경계를 담당한다.
- Infrastructure Layer는 DB, 외부 API, 메시징, Queue Consumer 같은 구현 세부사항만 담당한다.
- Interface Layer는 Controller, Resolver, Request/Response DTO, Queue Provider에 집중한다.
- 외부 API도 하나의 독립 도메인처럼 분리한다.

## 계층별 금지/권장 규칙
- Controller에는 비즈니스 로직을 넣지 않는다.
- Controller가 Repository를 직접 호출하지 않는다.
- Repository는 영속성 책임만 가지며 도메인 정책 판단을 하지 않는다.
- Repository끼리 직접 참조하지 않는다.
- Application이 ORM 타입, SQL 세부사항, HTTP 클라이언트 구현 세부사항을 직접 다루지 않게 한다.
- Queue는 발행 Provider와 처리 Consumer를 분리한다.

## TypeScript / NestJS 규칙
- 기본은 const 기반 화살표 함수를 사용한다.
- 재귀, 호이스팅, 의도 표현이 더 명확할 때만 function 선언을 사용한다.
- return 문에는 복잡한 연산, 긴 체이닝, 중첩 삼항, 복합 조건식을 넣지 않는다.
- if는 한 줄이어도 항상 중괄호를 사용한다.
- 분기가 복잡하면 ts-pattern의 match 사용을 검토한다.
- any는 금지에 가깝게 다루고 불가피할 때만 최소 범위로 제한한다.
- Promise 반환 함수는 async/await 스타일을 일관되게 사용한다.
- try-catch 안에서는 rejection이 catch에서 잡히도록 return await를 사용한다.
- DTO 입력은 명시적으로 검증한다. 타입만 믿지 않는다.
- 예외는 도메인/애플리케이션 의미가 드러나는 커스텀 예외를 사용하고 응답 변환은 전역에서 처리한다.
- 공통 응답 형태 ApiResponse<T>를 유지한다.
- 환경변수는 ConfigModule을 통해 접근하고 하드코딩하지 않는다.
- 로그에 개인정보, 토큰, 비밀값을 남기지 않는다.

## 네이밍 / Repository 규칙
- 클래스/인터페이스/타입/Enum은 PascalCase
- 변수/함수/메서드는 camelCase
- 파일명은 kebab-case
- 변수명에 줄임말과 불필요한 진행형을 피한다.
- Domain Repository는 비즈니스 의미가 드러나는 이름을 사용한다. 예: findByEmail, register
- Write Repository는 save, findOne, delete 같은 영속성 행위만 담당한다.
- where 조건 조합, ORM 옵션, DB 세부 구현은 Infrastructure 내부에 가둔다.
- 함수 파라미터는 읽기 쉽고 확장 가능하도록 객체 구조분해 방식을 우선 검토한다.

## 테스트 규칙
- 테스트는 Util, Parsing, UseCase 중심으로 본다.
- UseCase 테스트는 외부 의존성을 Mock 또는 Stub으로 분리한다.
- 회귀 버그는 재발 방지 테스트를 우선 추가한다.
- Given-When-Then 구조를 선호한다.

## Copilot이 코드 제안/리뷰 시 반드시 점검할 것
1. 도메인 경계가 명확한가
2. DDD Layered Architecture가 지켜졌는가
3. 의존 방향이 올바른가
4. Controller에 비즈니스 로직이 없는가
5. Repository가 영속성 책임만 가지는가
6. Domain이 프레임워크/ORM/외부 SDK로 오염되지 않았는가
7. DTO 검증, 예외 처리, 공통 응답, 보안 규칙이 누락되지 않았는가
8. 테스트가 필요한 변경인데 UseCase/Parsing/Util 테스트가 빠지지 않았는가

## PR 리뷰 작성 규칙
- 반드시 한국어로 작성한다.
- 먼저 머지 전 필수 수정 사항을 찾고, 그 다음 권장 개선 사항을 제안한다.
- DDD 계층 위반, 도메인 누수, 트랜잭션 경계 누락, 검증 누락, 보안 이슈를 최우선으로 본다.
- 각 지적에는 가능하면 파일 또는 위치, 위반 규칙, 문제 이유, 수정 방향을 함께 적는다.
- 문제가 없다면 억지로 지적하지 말고 왜 괜찮은지 설명한다.

리뷰 출력 형식:
### 1. 머지 전 필수 수정
### 2. 권장 개선
### 3. 잘한 점
### 4. 최종 판단
- DDD/LAYER 준수: 좋음 | 보통 | 미흡
- 도메인 분리: 좋음 | 보통 | 미흡
- 즉시 수정 필요 여부: 예 | 아니오

## PR 메시지 작성 규칙
- 반드시 한국어로 작성한다.
- 과장 없이 실제 변경 사항만 작성한다.
- 도메인 분리, 레이어 변경, 의존 방향 변화, 트랜잭션 경계 변화는 명시적으로 드러낸다.
- 테스트 여부와 확인 방법을 적는다.
- 리뷰어가 어디를 집중해서 봐야 하는지 분명히 적는다.

PR 출력 형식:
### PR 제목
한 줄 제목

### PR 본문
## 개요
## 변경 이유
## 주요 변경 사항
## 아키텍처 영향
## 테스트
## 리뷰 포인트
## 리스크 / 후속 작업

---

# PR Template
## 개요
- 

## 변경 이유
- 

## 주요 변경 사항
- 
- 
- 

## 아키텍처 영향
- 도메인 분리:
- 레이어 변경:
- 의존 방향 영향:
- 트랜잭션 경계 영향:

## 테스트
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] 수동 테스트
- 확인 내용:

## 리뷰 포인트
- 

## 리스크 / 후속 작업
- 

## 관련 이슈
- 
