import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const setupSwagger = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle('DDD API')
    .setDescription(
      [
        '## 인증 방식',
        '- 모든 토큰은 **httpOnly 쿠키**로 발급됩니다.',
        '- `access_token`: 일반 API 인증에 사용 (24시간)',
        '- `refresh_token`: Access Token 재발급에만 사용 (7일, path=/api/v1/auth/refresh)',
        '',
        '## Swagger 테스트 방법',
        '1. 로그인 API(`/api/v1/auth/google`)를 먼저 호출하면 브라우저에 httpOnly 쿠키가 자동 저장됩니다.',
        '2. 이후 동일 오리진에서 요청 시 쿠키가 자동 전송됩니다.',
        '3. 또는 우측 자물쇠 아이콘 클릭 후 발급받은 `access_token` 값을 직접 입력하세요.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addCookieAuth(
      'access_token',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'JWT Access Token (httpOnly 쿠키)',
      },
      'access_token',
    )
    // 면접 예약 API 3종은 쿠키 세션이 아니라 메일 링크로 받은 예약 토큰을 Authorization 헤더로
    // 받는다(InterviewBookingGuard). 컨트롤러의 @ApiBearerAuth() 가 이미 security: [{ bearer: [] }]
    // 를 붙이고 있으므로, 여기서 같은 이름의 스킴을 정의하지 않으면 정의되지 않은 스킴을 참조하는
    // 스펙이 나간다. 그러면 openapi.json 으로 생성한 클라이언트가 헤더를 붙일 자리를 못 만들고
    // Swagger UI 에서도 이 3종을 테스트할 수 없다. 이름은 @ApiBearerAuth() 의 기본값과 맞춘다.
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '면접 예약 링크의 `?token=` 값 (면접 예약 API 전용, 로그인 세션과 무관)',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
};
