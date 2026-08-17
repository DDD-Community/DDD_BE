// express.json() 기본값은 100kb 라 우리가 정한 값이 아니었다. 지원서 answers 는 자유 형식이고
// 길이 상한도 없어서 장문 문항이 여러 개면 도달할 수 있다. 넘으면 413 과 한국어 안내가 나간다.
//
// urlencoded 는 대상이 아니다. useBodyParser('json') 은 json 슬롯만 교체하므로 urlencoded 는
// 기본값(100kb)으로 남는데, form-urlencoded 를 받는 엔드포인트가 없어 문제되지 않는다.
export const JSON_BODY_LIMIT = '1mb';
