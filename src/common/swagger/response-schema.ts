import type { Type } from '@nestjs/common';
import { getSchemaPath } from '@nestjs/swagger';

export const successResponseSchema = (model: Type<unknown>) => ({
  schema: {
    type: 'object',
    properties: {
      code: { type: 'string', example: 'SUCCESS' },
      message: { type: 'string', example: 'success' },
      data: { $ref: getSchemaPath(model) },
    },
  },
});

export const successListResponseSchema = (model: Type<unknown>) => ({
  schema: {
    type: 'object',
    properties: {
      code: { type: 'string', example: 'SUCCESS' },
      message: { type: 'string', example: 'success' },
      data: {
        type: 'array',
        items: { $ref: getSchemaPath(model) },
      },
    },
  },
});

export const successNullResponseSchema = (message = 'success') => ({
  schema: {
    type: 'object',
    properties: {
      code: { type: 'string', example: 'SUCCESS' },
      message: { type: 'string', example: message },
      data: { type: 'object', nullable: true, example: null },
    },
  },
});

export const errorResponseSchema = (code: string, message: string) => ({
  schema: {
    type: 'object',
    properties: {
      code: { type: 'string', example: code },
      message: { type: 'string', example: message },
      data: { type: 'object', nullable: true, example: null },
    },
  },
});

const errorOneOfSchema = (cases: Array<{ code: string; message: string }>) => ({
  schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        enum: cases.map((c) => c.code),
        example: cases[0].code,
      },
      message: {
        type: 'string',
        example: cases[0].message,
      },
      data: { type: 'object', nullable: true, example: null },
    },
  },
});

export const CommonSwaggerResponses = {
  unauthorized: (description = '인증이 필요합니다.', code = 'UNAUTHORIZED') => ({
    status: 401 as const,
    description,
    ...errorResponseSchema(code, description),
  }),
  notFound: (description = '리소스를 찾을 수 없습니다.', code = 'NOT_FOUND') => ({
    status: 404 as const,
    description,
    ...errorResponseSchema(code, description),
  }),
  notFoundOneOf: (
    description: string,
    cases: Array<{ code: string; message: string }>,
  ) => ({
    status: 404 as const,
    description,
    ...errorOneOfSchema(cases),
  }),
};
