import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

import { SignedUrlAction } from '../domain/storage.type';
import { GcsClient } from './gcs.client';

const mockSave = jest.fn();
const mockExists = jest.fn();
const mockDelete = jest.fn();
const mockGetSignedUrl = jest.fn();
const mockGetMetadata = jest.fn();
const mockCreateReadStream = jest.fn();
const mockGetFiles = jest.fn();

const mockFileFn = jest.fn(() => ({
  save: mockSave,
  exists: mockExists,
  delete: mockDelete,
  getSignedUrl: mockGetSignedUrl,
  getMetadata: mockGetMetadata,
  createReadStream: mockCreateReadStream,
}));

const mockBucketFn = jest.fn(() => ({
  file: mockFileFn,
  getFiles: mockGetFiles,
}));

const mockStorageCtor = jest.fn().mockImplementation(() => ({
  bucket: mockBucketFn,
}));

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation((args: unknown) => mockStorageCtor(args)),
}));

const buildConfig = (env: Record<string, string | undefined>): ConfigService =>
  ({
    get: <T>(key: string): T | undefined => env[key] as T | undefined,
  }) as unknown as ConfigService;

describe('GcsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('console mode (STORAGE_PROVIDER 미설정)', () => {
    let client: GcsClient;

    beforeEach(() => {
      client = new GcsClient(buildConfig({}));
    });

    it('isEnabled=false 를 반환한다', () => {
      expect(client.isEnabled()).toBe(false);
    });

    it('upload 는 storage.example.com 미리보기 URL을 반환하고 SDK를 호출하지 않는다', async () => {
      const url = await client.upload({
        buffer: Buffer.from('x'),
        originalName: 'foo.png',
        mimeType: 'image/png',
        gcsPath: 'projects/thumbnails',
      });

      expect(url).toMatch(/^https:\/\/storage\.example\.com\/projects\/thumbnails\/.+\.png$/);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('exists 는 false 를 반환한다', async () => {
      await expect(client.exists({ path: 'any/path' })).resolves.toBe(false);
    });

    it('delete 는 SDK를 호출하지 않고 즉시 종료한다', async () => {
      await expect(client.delete({ path: 'any/path' })).resolves.toBeUndefined();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('list 는 빈 결과를 반환한다', async () => {
      const result = await client.list({
        prefix: 'projects/thumbnails/',
        maxResults: 20,
      });
      expect(result).toEqual({ items: [], nextPageToken: null });
    });

    it('getSignedUrl 은 미리보기 URL과 expiresAt을 반환한다', async () => {
      const result = await client.getSignedUrl({
        path: 'projects/thumbnails/abc.png',
        action: SignedUrlAction.READ,
        expiresInSeconds: 60,
      });

      expect(result.url).toContain('storage.example.com');
      expect(typeof result.expiresAt).toBe('string');
    });

    it('download 는 빈 stream 을 반환한다', async () => {
      const result = await client.download({ path: 'projects/thumbnails/abc.png' });
      expect(result.contentType).toBe('application/octet-stream');
      expect(result.contentLength).toBe(0);
      expect(result.fileName).toBe('abc.png');
      expect(result.stream).toBeDefined();
    });
  });

  describe('gcs mode (정상 설정)', () => {
    let client: GcsClient;

    beforeEach(() => {
      client = new GcsClient(
        buildConfig({
          STORAGE_PROVIDER: 'gcs',
          GCS_PROJECT_ID: 'proj',
          GCS_BUCKET_NAME: 'bucket',
          GCS_KEY_FILE_PATH: '/tmp/key.json',
        }),
      );
    });

    it('isEnabled=true 를 반환한다', () => {
      expect(client.isEnabled()).toBe(true);
    });

    it('upload 는 storage.googleapis.com URL을 반환하고 SDK file.save 를 호출한다', async () => {
      mockSave.mockResolvedValue(undefined);

      const url = await client.upload({
        buffer: Buffer.from('x'),
        originalName: 'foo.png',
        mimeType: 'image/png',
        gcsPath: 'projects/thumbnails',
      });

      expect(mockSave).toHaveBeenCalledWith(expect.any(Buffer), {
        contentType: 'image/png',
        resumable: false,
      });
      expect(mockBucketFn).toHaveBeenCalledWith('bucket');
      expect(url).toMatch(
        /^https:\/\/storage\.googleapis\.com\/bucket\/projects\/thumbnails\/.+\.png$/,
      );
    });

    it('exists 는 GCS 응답을 그대로 반환한다', async () => {
      mockExists.mockResolvedValue([true]);

      await expect(client.exists({ path: 'projects/thumbnails/abc.png' })).resolves.toBe(true);
      expect(mockFileFn).toHaveBeenCalledWith('projects/thumbnails/abc.png');
    });

    it('delete 는 file.delete() 를 호출한다', async () => {
      mockDelete.mockResolvedValue([{}]);

      await client.delete({ path: 'projects/thumbnails/abc.png' });

      expect(mockFileFn).toHaveBeenCalledWith('projects/thumbnails/abc.png');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('list 는 file 메타에서 StorageObject 배열을 만들고 nextPageToken 을 추출한다', async () => {
      mockGetFiles.mockResolvedValue([
        [
          {
            name: 'projects/thumbnails/a.png',
            metadata: {
              size: '1024',
              contentType: 'image/png',
              updated: '2026-04-28T12:00:00.000Z',
            },
          },
          {
            name: 'projects/thumbnails/b.png',
            metadata: { size: 2048 },
          },
        ],
        { pageToken: 'token-2' },
        {},
      ]);

      const result = await client.list({
        prefix: 'projects/thumbnails/',
        maxResults: 10,
        pageToken: 'token-1',
      });

      expect(mockGetFiles).toHaveBeenCalledWith({
        prefix: 'projects/thumbnails/',
        maxResults: 10,
        pageToken: 'token-1',
        autoPaginate: false,
      });
      expect(result.nextPageToken).toBe('token-2');
      expect(result.items).toEqual([
        {
          path: 'projects/thumbnails/a.png',
          size: 1024,
          contentType: 'image/png',
          updatedAt: '2026-04-28T12:00:00.000Z',
          url: 'https://storage.googleapis.com/bucket/projects/thumbnails/a.png',
        },
        {
          path: 'projects/thumbnails/b.png',
          size: 2048,
          contentType: null,
          updatedAt: null,
          url: 'https://storage.googleapis.com/bucket/projects/thumbnails/b.png',
        },
      ]);
    });

    it('list 는 nextQuery 가 없으면 nextPageToken=null 을 반환한다', async () => {
      mockGetFiles.mockResolvedValue([[], null, {}]);

      const result = await client.list({ prefix: 'projects/pdfs/', maxResults: 5 });

      expect(result).toEqual({ items: [], nextPageToken: null });
    });

    it('getSignedUrl 은 v4/read 옵션으로 SDK 를 호출하고 결과를 매핑한다', async () => {
      mockGetSignedUrl.mockResolvedValue(['https://signed.example.com/abc']);

      const result = await client.getSignedUrl({
        path: 'projects/thumbnails/abc.png',
        action: SignedUrlAction.READ,
        expiresInSeconds: 120,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v4',
          action: 'read',
          expires: expect.any(Date) as Date,
        }),
      );
      expect(result.url).toBe('https://signed.example.com/abc');
      expect(typeof result.expiresAt).toBe('string');
    });

    it('getSignedUrl(WRITE) 는 action=write 로 SDK 를 호출한다', async () => {
      mockGetSignedUrl.mockResolvedValue(['https://signed.example.com/upload']);

      await client.getSignedUrl({
        path: 'projects/thumbnails/new.png',
        action: SignedUrlAction.WRITE,
        expiresInSeconds: 60,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: 'write' }));
    });

    it('download 는 metadata.contentType/size 와 createReadStream 을 반환한다', async () => {
      mockGetMetadata.mockResolvedValue([{ contentType: 'image/png', size: '6' }]);
      const stream = Readable.from(Buffer.from('binary'));
      mockCreateReadStream.mockReturnValue(stream);

      const result = await client.download({ path: 'projects/thumbnails/abc.png' });

      expect(result.contentType).toBe('image/png');
      expect(result.contentLength).toBe(6);
      expect(result.fileName).toBe('abc.png');
      expect(result.stream).toBe(stream);
      expect(mockCreateReadStream).toHaveBeenCalled();
    });

    it('download 는 contentType 이 없으면 application/octet-stream 으로 폴백한다', async () => {
      mockGetMetadata.mockResolvedValue([{}]);
      mockCreateReadStream.mockReturnValue(Readable.from(Buffer.from('x')));

      const result = await client.download({ path: 'projects/pdfs/x.pdf' });
      expect(result.contentType).toBe('application/octet-stream');
      expect(result.contentLength).toBeNull();
    });
  });

  describe('gcs mode (필수 설정 누락)', () => {
    it('GCS_BUCKET_NAME 누락 시 isEnabled=false', () => {
      const client = new GcsClient(
        buildConfig({ STORAGE_PROVIDER: 'gcs', GCS_PROJECT_ID: 'proj' }),
      );
      expect(client.isEnabled()).toBe(false);
    });

    it('GCS_PROJECT_ID 누락 시 isEnabled=false', () => {
      const client = new GcsClient(
        buildConfig({ STORAGE_PROVIDER: 'gcs', GCS_BUCKET_NAME: 'bucket' }),
      );
      expect(client.isEnabled()).toBe(false);
    });
  });
});
