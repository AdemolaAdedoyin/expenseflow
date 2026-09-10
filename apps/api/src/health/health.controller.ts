import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  @ApiResponse({ status: 200, description: 'API process is running.' })
  live() {
    return this.health.live();
  }

  @Get('ready')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dependency readiness probe' })
  @ApiResponse({ status: 200, description: 'API dependencies are ready.' })
  @ApiResponse({ status: 503, description: 'One or more dependencies are unavailable.' })
  async ready() {
    const result = await this.health.ready();

    if (result.status !== 'ready') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
