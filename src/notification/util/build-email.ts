/**
 * DDD 안내 메일의 공용 레이아웃.
 *
 * 전형 결과 메일(서류합격·불합격·최종합격 등)과 면접 확정 메일이 같은 구성을 쓴다.
 * 인사 → 본문 → 항목 목록 → 덧붙이는 안내 → 서명. html 과 text 를 한 번에 만들어
 * 두 형식이 어긋나지 않게 한다.
 *
 * 메일 클라이언트 호환을 위해 table 기반 레이아웃을 쓴다.
 */

export type EmailBullet = {
  label: string;
  /** 이미 escape·링크 변환이 끝난 HTML 조각 */
  valueHtml: string;
  /** text 본문용 평문 */
  valueText: string;
};

export type BuildEmailInput = {
  /** 메일 상단 제목 */
  title: string;
  /** "안녕하세요, 홍길동님. DDD 운영진입니다." — 이미 escape 된 값 */
  greetingHtml: string;
  greetingText: string;
  /** 인사 다음에 오는 문단들 (escape 된 값) */
  introParagraphs: string[];
  /** 항목 목록. 비어 있으면 블록 자체를 렌더링하지 않는다 */
  bullets?: EmailBullet[];
  /** 목록 아래 안내 문단들 */
  outroParagraphs?: string[];
};

const SIGNATURE_HTML = '감사합니다.<br/>DDD 운영진 드림';
const SIGNATURE_TEXT = ['감사합니다.', 'DDD 운영진 드림'];

const renderBulletsHtml = (bullets: EmailBullet[]): string => {
  if (bullets.length === 0) {
    return '';
  }

  const rows = bullets
    .map(
      ({ label, valueHtml }) => `
                    <div style="margin-bottom:10px;">
                      <span style="display:inline-block;width:110px;color:#6b7280;font-weight:600;vertical-align:top;">${label}</span><span style="display:inline-block;max-width:340px;vertical-align:top;">${valueHtml}</span>
                    </div>`,
    )
    .join('');

  return `
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e5e9ef;">
                <tr>
                  <td style="padding:18px 20px;font-size:14px;color:#111;">${rows}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
};

const renderParagraphsHtml = (paragraphs: string[]): string =>
  paragraphs.map((text) => `<p style="margin:0 0 16px 0;">${text}</p>`).join('\n              ');

export const buildEmail = ({
  title,
  greetingHtml,
  greetingText,
  introParagraphs,
  bullets = [],
  outroParagraphs = [],
}: BuildEmailInput): { html: string; text: string } => {
  const html = `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);max-width:560px;width:100%;">
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <div style="font-size:13px;letter-spacing:1px;color:#5b6470;font-weight:600;">DDD</div>
              <div style="font-size:22px;font-weight:700;line-height:1.4;color:#111;margin-top:8px;">${title}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px 32px;font-size:15px;line-height:1.7;color:#222;">
              <p style="margin:0 0 16px 0;">${greetingHtml}</p>
              ${renderParagraphsHtml(introParagraphs)}
            </td>
          </tr>${renderBulletsHtml(bullets)}
          <tr>
            <td style="padding:0 32px 24px 32px;font-size:15px;line-height:1.7;color:#222;">
              ${renderParagraphsHtml(outroParagraphs)}
              <p style="margin:0;">${SIGNATURE_HTML}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #eef0f3;font-size:12px;color:#9097a3;">
              본 메일은 발신 전용입니다. © DDD
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
  `.trim();

  // html 은 문단마다 <p> 로 떨어지므로 text 도 빈 줄로 갈라야 같은 구조로 읽힌다.
  // 붙여 쓰면 최종합격 메일의 회신 양식 5줄이 다음 문단과 이어져 끝이 안 보인다.
  const textBlocks = [
    title,
    greetingText,
    ...introParagraphs.map(stripHtml),
    ...(bullets.length > 0
      ? [bullets.map(({ label, valueText }) => `- ${label}: ${valueText}`).join('\n')]
      : []),
    ...outroParagraphs.map(stripHtml),
    SIGNATURE_TEXT.join('\n'),
  ];

  return { html, text: textBlocks.join('\n\n') };
};

/** 문단에 섞인 <br/> 같은 최소 태그만 걷어낸다. 본문은 애초에 평문으로 넘긴다. */
const stripHtml = (input: string): string =>
  input
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
