import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController refresh', () => {
  it('verifies the refresh token before rotating it', async () => {
    const refreshToken = jest.fn().mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    const verifyAsync = jest.fn().mockResolvedValue({ sub: 'user-id' });
    const authService = {
      refreshToken,
    } as unknown as AuthService;
    const jwtService = {
      verifyAsync,
    } as unknown as JwtService;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('refresh-secret'),
      get: jest.fn().mockReturnValue('development'),
    } as unknown as ConfigService;
    const response = { cookie: jest.fn() } as unknown as Response;
    const controller = new AuthController(
      authService,
      jwtService,
      configService,
    );

    await expect(
      controller.refresh({ refreshToken: 'signed-refresh' }, {}, response),
    ).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    expect(verifyAsync).toHaveBeenCalledWith('signed-refresh', {
      secret: 'refresh-secret',
    });
    expect(refreshToken).toHaveBeenCalledWith('user-id', 'signed-refresh');
  });

  it('rejects an invalid refresh token', async () => {
    const refreshToken = jest.fn();
    const verifyAsync = jest.fn().mockRejectedValue(new Error('invalid token'));
    const authService = {
      refreshToken,
    } as unknown as AuthService;
    const jwtService = {
      verifyAsync,
    } as unknown as JwtService;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('refresh-secret'),
      get: jest.fn().mockReturnValue('development'),
    } as unknown as ConfigService;
    const response = { cookie: jest.fn() } as unknown as Response;
    const controller = new AuthController(
      authService,
      jwtService,
      configService,
    );

    await expect(
      controller.refresh({ refreshToken: 'tampered' }, {}, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken).not.toHaveBeenCalled();
  });
});
