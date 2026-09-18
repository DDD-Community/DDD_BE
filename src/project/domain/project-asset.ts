import { UploadCategory } from '../../storage/domain/storage.type';

export type ProjectAssetKind = 'pdf' | 'thumbnail';

type ProjectAssetConfig = {
  category: UploadCategory;
  column: 'pdfUrl' | 'thumbnailUrl';
};

export const PROJECT_ASSET_CONFIG: Record<ProjectAssetKind, ProjectAssetConfig> = {
  pdf: { category: UploadCategory.PROJECT_PDF, column: 'pdfUrl' },
  thumbnail: { category: UploadCategory.PROJECT_THUMBNAIL, column: 'thumbnailUrl' },
};

/**
 * 참조 판정은 URL 전체가 아니라 파일명으로 맞춘다.
 *
 * `pdfUrl`/`thumbnailUrl` 은 `@IsUrl()` 만 통과하면 무엇이든 저장되므로 표기가 하나로 고정되지
 * 않는다. 퍼센트 인코딩(`projects%2Fpdfs%2F...`), CDN·프록시 경유 주소, 스토리지 모듈 도입
 * 이전의 레거시 행이 모두 같은 객체를 가리킬 수 있다. 경로 전체를 맞추면 이런 표기가 참조
 * 목록에서 조용히 빠지고, 빠진 참조는 곧 살아 있는 파일의 삭제다. 실패가 보존이 아니라
 * 삭제 쪽으로 기우는 유일한 지점이라 표기 문제 자체를 없앤다.
 *
 * 파일명은 업로드 때 `randomUUID()` 로 붙으므로(GcsClient.upload) 호스트·인코딩·경로 표기와
 * 무관하게 같다. 서로 다른 객체가 같은 이름을 가질 일은 사실상 없고, 설령 겹쳐도 결과는
 * '참조로 간주' 라 보존 쪽이다.
 */
export const toAssetName = ({ url }: { url: string }): string | null => {
  const [withoutQuery] = url.split('?');
  const name = decodePath({ value: withoutQuery }).split('/').pop();

  return name ? name : null;
};

/** 잘못된 인코딩이면 decodeURIComponent 가 던진다. 원문으로 물러서고 판정은 호출부가 한다. */
const decodePath = ({ value }: { value: string }): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
