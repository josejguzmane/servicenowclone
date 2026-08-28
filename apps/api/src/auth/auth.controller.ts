import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Actor, SessionResponse } from '@servicedesk/shared';
import { CurrentUser, Public } from '../common/decorators';
import { clientIp, userAgent, type AuthenticatedRequest } from '../common/request';
import { AuthService, type AuthContext } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: AuthenticatedRequest): Promise<SessionResponse> {
    return this.auth.register(dto, contextFrom(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: AuthenticatedRequest): Promise<SessionResponse> {
    return this.auth.login(dto, contextFrom(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: AuthenticatedRequest): Promise<SessionResponse> {
    return this.auth.refresh(dto.refreshToken, contextFrom(req));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body() dto: RefreshDto,
    @CurrentUser() actor: Actor,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.auth.logout(dto.refreshToken, actor, contextFrom(req));
  }

  @Get('me')
  me(@CurrentUser() actor: Actor): Actor {
    return actor;
  }
}

function contextFrom(req: AuthenticatedRequest): AuthContext {
  return { ip: clientIp(req), userAgent: userAgent(req), requestId: req.requestId };
}
