import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Reader,
  ContinentRecord,
  CountryRecord,
  CityRecord,
  SubdivisionsRecord,
} from '@maxmind/geoip2-node';
import * as path from 'path';
import * as fs from 'fs';
import ReaderModel from '@maxmind/geoip2-node/dist/src/readerModel';

@Injectable()
export class AppService {
  private asnReader: ReaderModel;
  private cityReader: ReaderModel;

  constructor() {
    this.initializeReaders();
  }

  private async initializeReaders() {
    const now = Date.now();

    const geoIpDbsPath = './data';

    const asnFilePath = path.join(process.cwd(), geoIpDbsPath, 'GeoLite2-ASN.mmdb');
    const cityFilePath = path.join(process.cwd(), geoIpDbsPath, 'GeoLite2-City.mmdb');

    const asnDbBuffer = fs.readFileSync(asnFilePath);
    const cityDbBuffer = fs.readFileSync(cityFilePath);

    this.asnReader = Reader.openBuffer(asnDbBuffer);
    this.cityReader = Reader.openBuffer(cityDbBuffer);

    const timeTaken = Date.now() - now;

    Logger.log(`[initializeReaders]: GeoIp databases initialised after...${timeTaken}ms`)
  }

  private async fetchIp(req: any): Promise<string> {
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',').pop().trim() ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket?.remoteAddress;

    if (!ip) {
      throw new UnprocessableEntityException('Ip address not found');
    }

    return ip;
  }

  private async fetchAllIpGeoData(ip: string) {
    try {
      if (!this.cityReader && !this.cityReader) {
        throw new InternalServerErrorException('GeoIp2 readers are not ready');
      }

      const asn = this.asnReader.asn(ip);
      const city = this.cityReader.city(ip);

      Logger.log({
        ipAddress: asn.ipAddress,
        continent: (city.continent as ContinentRecord)?.names?.en,
        country: (city.country as CountryRecord)?.names?.en,
        city: (city.city as CityRecord)?.names?.en,
      });

      return { asn, city };
    } catch (error) {
      Logger.error(error);
      return null;
    }
  }

  private async fetchFilteredIpGeoData(ip: string) {
    const allGeoIpData = await this.fetchAllIpGeoData(ip);

    const { asn, city } = allGeoIpData;

    return {
      ipAddress: asn.ipAddress,
      autonomousSystemOrganization: asn.autonomousSystemOrganization,
      isAnonymous: city.traits.isAnonymous,
      continent: (city.continent as ContinentRecord)?.names?.en,
      country: (city.country as CountryRecord)?.names?.en,
      registeredCountry: (city.country as CountryRecord)?.names?.en,
      isInEuropeanUnion: (city.country as CountryRecord)?.isInEuropeanUnion,
      city: (city.city as CityRecord)?.names?.en,
      subdivisions: (city.subdivisions as SubdivisionsRecord[])
        .map((sub) => sub.names.en)
        .join(' / '),
      ...city.location,
    };
  }

  async getFilteredIpDetails(req: Express.Request): Promise<any> {
    const ip = await this.fetchIp(req);
    return await this.fetchFilteredIpGeoData(ip);
  }

  async getAllIpDetails(req: Express.Request): Promise<any> {
    const ip = await this.fetchIp(req);
    return await this.fetchAllIpGeoData(ip);
  }
}
