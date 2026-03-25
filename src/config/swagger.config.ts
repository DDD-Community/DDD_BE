import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('DDD API')
    .setDescription(
      [
        '## 인증 방식',
        '- 모든 토큰은 **httpOnly 쿠키**로 발급됩니다.',
        '- `access_token`: 일반 API 인증에 사용 (24시간)',
        '- `refresh_token`: Access Token 재발급에만 사용 (7일, path=/api/v1/auth/refresh)',
        '',
        '## 인증이 필요한 엔드포인트',
        '우측 자물쇠 아이콘 클릭 후 `access_token` 값을 입력하세요.',
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
