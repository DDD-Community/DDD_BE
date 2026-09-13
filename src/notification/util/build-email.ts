/**
 * DDD 안내 메일의 공용 레이아웃.
 *
 * 디자인 시안(DDD메일_01~08)의 구성을 그대로 옮겼다. 로고 → 제목 → 블록들 → 구분선 → 푸터.
 * 메일마다 다른 부분은 블록 배열로만 표현하고, 여백·색·타이포는 여기서 한곳에 둔다.
 * html 과 text 를 한 번에 만들어 두 형식이 어긋나지 않게 한다.
 *
 * 메일 클라이언트 호환을 위해 table 기반 레이아웃과 인라인 스타일만 쓴다.
 */

/** 이미 escape 가 끝난 HTML 조각. 호출자가 escapeHtml 을 거쳐 넘긴다 */
type SafeHtml = string;

export type EmailInfoRow = {
  label: string;
  valueHtml: SafeHtml;
  /** text 본문용 평문 */
  valueText: string;
};

export type EmailBlock =
  /** 본문 문단 (15px) */
  | { type: 'lead'; html: SafeHtml }
  /** 회색 카드 안의 "라벨 — 값" 목록. 행이 없으면 블록째 생략된다 */
  | { type: 'info'; rows: EmailInfoRow[] }
  /** 인증번호처럼 크게 보여줄 값 */
  | { type: 'code'; value: SafeHtml }
  /** 제목이 붙은 회색 카드 (회신 양식 등) */
  | { type: 'box'; heading: string; lines: SafeHtml[] }
  /** 검은 CTA 버튼. href 는 escape 전 원본 URL */
  | { type: 'button'; label: string; href: string }
  /** 회색 보조 안내 (13px). 한 블록 안의 줄은 <br> 로 이어진다 */
  | { type: 'note'; lines: SafeHtml[] }
  /** 버튼이 안 눌릴 때를 위한 원문 주소 안내. href 는 escape 전 원본 URL */
  | { type: 'linkFallback'; href: string };

export type BuildEmailInput = {
  /** 메일 상단 제목. escape 된 값 */
  title: SafeHtml;
  blocks: EmailBlock[];
};

const FONT_FAMILY = `'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',Arial,sans-serif`;
const COLOR = {
  background: '#F4F5F7',
  card: '#FFFFFF',
  title: '#111827',
  body: '#3F4652',
  muted: '#8B93A1',
  faint: '#B4BAC4',
  divider: '#E8EAEE',
} as const;

const FOOTER_TEXT_LINES = ['문의사항은 본 메일로 회신해 주세요.', '© DDD'];

/**
 * 메일 상단 로고. 시안의 ddd-logo.png 같은 상대경로는 메일 클라이언트가 불러오지 못하므로
 * 이미 공개 호스팅 중인 어드민 FE 의 정적 파일(DDD_FE apps/admin/public/logo.png)을 쓴다.
 * 흰 카드 위에서 보이는 검은 원형 로고라 이 파일을 골랐다 — 지원자 웹의 logo.png 는 흰색이라 안 보인다.
 * 어드민 FE 에서 이 경로가 바뀌면 메일 로고가 조용히 깨지므로 함께 옮겨야 한다.
 */
const LOGO_URL = 'https://admin.dddstudy.kr/logo.png';

export const escapeHtml = (input: string): string =>
  input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** "[DDD] 14기 최종 합격을 축하드립니다" — 제목이 이미 DDD 로 시작하면 접두어와 겹치지 않게 뗀다 */
export const toEmailSubject = (title: string): string => `[DDD] ${title.replace(/^DDD\s+/, '')}`;

/**
 * 블록 사이 여백은 시안에서 앞 블록 종류에 따라 달라진다.
 * 카드끼리는 붙이고(10), 카드·버튼 뒤 안내는 가깝게(12), 문단·안내 뒤 안내는 띄운다(18).
 */
const paddingTopFor = (
  previous: EmailBlock['type'] | null,
  current: EmailBlock['type'],
): number => {
  if (previous === null) {
    return current === 'lead' ? 16 : 24;
  }
  switch (current) {
    case 'lead':
      return 14;
    case 'info':
    case 'code':
    case 'box':
      return previous === 'info' || previous === 'box' ? 10 : 24;
    case 'button':
      return 24;
    case 'note':
      if (previous === 'box') return 14;
      if (previous === 'lead' || previous === 'note') return 18;
      return 12;
    case 'linkFallback':
      return 14;
  }
};

const renderInfoRowsHtml = (rows: EmailInfoRow[]): string =>
  rows
    .map(({ label, valueHtml }, index) => {
      const bottom = index === rows.length - 1 ? '0' : '10px';
      return `
              <tr>
                <td width="96" style="padding-bottom:${bottom}; font-size:13px; color:${COLOR.muted}; vertical-align:top; white-space:nowrap;">${label}</td>
                <td style="padding-bottom:${bottom}; font-size:14px; font-weight:700; color:${COLOR.title}; vertical-align:top; word-break:break-all;">${valueHtml}</td>
              </tr>`;
    })
    .join('');

const renderBlockHtml = (block: EmailBlock, paddingTop: number): string => {
  switch (block.type) {
    case 'lead':
      return `
  <tr>
    <td style="padding-top:${paddingTop}px; font-family:${FONT_FAMILY}; font-size:15px; line-height:1.7; color:${COLOR.body}; letter-spacing:-0.3px;">
      ${block.html}
    </td>
  </tr>`;
    case 'info':
      return `
  <tr>
    <td style="padding-top:${paddingTop}px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.background}; border-radius:12px;">
        <tr>
          <td style="padding:20px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT_FAMILY}; line-height:1.55; letter-spacing:-0.3px;">${renderInfoRowsHtml(block.rows)}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
    case 'code':
      return `
  <tr>
    <td style="padding-top:${paddingTop}px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.background}; border-radius:12px;">
        <tr>
          <td align="center" style="padding:26px 20px; font-family:${FONT_FAMILY}; font-size:30px; font-weight:700; color:${COLOR.title}; letter-spacing:8px; text-indent:8px;">
            ${block.value}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
    case 'box':
      return `
  <tr>
    <td style="padding-top:${paddingTop}px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.background}; border-radius:12px;">
        <tr>
          <td style="padding:20px 22px; font-family:${FONT_FAMILY}; letter-spacing:-0.3px;">
            <div style="font-size:13px; font-weight:700; color:${COLOR.muted}; padding-bottom:8px;">${block.heading}</div>
            <div style="font-size:14px; line-height:1.85; color:${COLOR.title};">
              ${block.lines.join('<br>\n              ')}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
    case 'button':
      return `
  <tr>
    <td style="padding-top:${paddingTop}px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background-color:${COLOR.title}; border-radius:8px;">
            <a href="${escapeHtml(block.href)}" style="display:inline-block; padding:13px 26px; font-family:${FONT_FAMILY}; font-size:15px; font-weight:700; color:#FFFFFF; text-decoration:none; letter-spacing:-0.3px;">${block.label}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
    case 'note': {
      // 시안에서 문단·안내 뒤로 멀리 떨어진 안내만 줄 간격이 조금 넓다.
      const lineHeight = paddingTop === 18 ? 1.7 : 1.65;
      return `
  <tr>
    <td style="padding-top:${paddingTop}px; font-family:${FONT_FAMILY}; font-size:13px; line-height:${lineHeight}; color:${COLOR.muted}; letter-spacing:-0.3px;">
      ${block.lines.join('<br>')}
    </td>
  </tr>`;
    }
    case 'linkFallback':
      return `
  <tr>
    <td style="padding-top:${paddingTop}px; font-family:${FONT_FAMILY}; font-size:12px; line-height:1.6; color:${COLOR.faint}; letter-spacing:-0.3px;">
      버튼이 동작하지 않으면 아래 주소를 복사해 브라우저에 붙여넣어 주세요.<br>
      <span style="color:${COLOR.muted}; word-break:break-all;">${escapeHtml(block.href)}</span>
    </td>
  </tr>`;
  }
};

const renderBlockText = (block: EmailBlock): string | null => {
  switch (block.type) {
    case 'lead':
      return stripHtml(block.html);
    case 'info':
      return block.rows.map(({ label, valueText }) => `- ${label}: ${valueText}`).join('\n');
    case 'code':
      return stripHtml(block.value);
    case 'box':
      return [block.heading, ...block.lines.map(stripHtml)].join('\n');
    case 'button':
      return `${block.label}: ${block.href}`;
    case 'note':
      return block.lines.map(stripHtml).join('\n');
    case 'linkFallback':
      // text 본문에서는 버튼 줄이 이미 원문 주소를 담고 있다.
      return null;
  }
};

/** 비어 있는 info 카드는 시안에 없는 빈 회색 상자가 되므로 렌더링 전에 걷어낸다 */
const isRenderable = (block: EmailBlock): boolean =>
  !(block.type === 'info' && block.rows.length === 0);

export const buildEmail = ({ title, blocks }: BuildEmailInput): { html: string; text: string } => {
  const renderable = blocks.filter(isRenderable);

  let previous: EmailBlock['type'] | null = null;
  const blocksHtml = renderable
    .map((block) => {
      const rendered = renderBlockHtml(block, paddingTopFor(previous, block.type));
      previous = block.type;
      return rendered;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no">
<title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:${COLOR.background};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.background};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:520px; max-width:100%; background-color:${COLOR.card}; border-radius:16px;">
<tr><td style="padding:36px 36px 28px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

  <tr>
    <td style="padding-bottom:22px;">
      <img src="${LOGO_URL}" alt="DDD" width="30" height="30" style="display:block; width:30px; height:30px; border:0; outline:none;">
    </td>
  </tr>

  <tr>
    <td style="font-family:${FONT_FAMILY}; font-size:21px; font-weight:700; line-height:1.4; color:${COLOR.title}; letter-spacing:-0.6px;">
      ${title}
    </td>
  </tr>
${blocksHtml}

  <tr>
    <td style="padding-top:32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:1px; background-color:${COLOR.divider}; font-size:0; line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding-top:16px; font-family:${FONT_FAMILY}; font-size:11px; line-height:1.8; color:${COLOR.faint}; letter-spacing:-0.2px;">
      ${FOOTER_TEXT_LINES[0]}<br>
      &copy; DDD
    </td>
  </tr>

</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  // html 은 블록마다 떨어져 보이므로 text 도 빈 줄로 갈라야 같은 구조로 읽힌다.
  const textBlocks = [
    stripHtml(title),
    ...renderable.map(renderBlockText).filter((text): text is string => text !== null),
    FOOTER_TEXT_LINES.join('\n'),
  ];

  return { html, text: textBlocks.join('\n\n') };
};

/** 문단에 섞인 <br> · <strong> 같은 최소 태그만 걷어낸다. 본문은 애초에 평문으로 넘긴다. */
const stripHtml = (input: string): string =>
  input
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&copy;', '©')
    .replaceAll('&amp;', '&');
