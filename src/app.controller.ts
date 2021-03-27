import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getFilteredGeoIpData(@Req() req: Express.Request): Promise<string> {
    return this.appService.getFilteredIpDetails(req);
  }

  @Get('data/:id/all')
  getAllGeoIpData(@Req() req: Express.Request): Promise<string> {
    return this.appService.getAllIpDetails(req);
  }
}
