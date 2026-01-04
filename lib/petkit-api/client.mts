/**
 * PetKit API Client
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import crypto from 'crypto';

import type {
  PetKitClientOptions,
  Session,
  DeviceEntity,
  DeviceNfo,
  AccountData,
  BasicDevice,
  PetData,
  RawDevice,
  ApiResponse,
  RegionServersResponse,
  LoginResponse,
  LitterStatus,
  FeederStatus,
  FountainStatus,
  PurifierStatus,
  PetDetails,
} from './types.mjs';

import {
  DEFAULT_COUNTRY,
  DEFAULT_TZ,
  RES_KEY,
  ERR_KEY,
  DeviceType,
  DEVICES_FEEDER,
  DEVICES_LITTER_BOX,
  DEVICES_WATER_FOUNTAIN,
  DEVICES_PURIFIER,
  FEEDER_WITH_CAMERA,
  LITTER_WITH_CAMERA,
  LITTER_NO_CAMERA,
  PetkitDomain,
  PetkitEndpoint,
  HEADERS,
  CLIENT_NFO,
  LOGIN_DATA,
  ACTIONS_MAP,
  DeviceCommand,
  FeederCommand,
  LitterCommand,
  PetCommand,
  DeviceAction,
  LBCommand,
  PurMode,
} from './constants.mjs';

import {
  PetkitAPIError,
  PetkitAuthenticationError,
  PetkitSessionExpiredError,
  PetkitServerBusyError,
  PetkitRegionalServerNotFoundError,
  PetkitDeviceNotFoundError,
  PetkitUnsupportedActionError,
} from './errors.mjs';

// Extended Axios config for retry logic
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: number;
}

/**
 * PetKit API Client
 */
export class PetKitClient {
  private readonly username: string;
  private readonly password: string;
  private region: string;
  private readonly timezone: string;

  private _session: Session | null = null;
  private accountData: AccountData[] = [];
  private petkitEntities: Map<number, DeviceEntity> = new Map();
  private baseUrl: string = PetkitDomain.PASSPORT_PETKIT;

  private readonly client: AxiosInstance;

  constructor(options: PetKitClientOptions) {
    this.username = options.username;
    this.password = options.password;
    this.region = (options.region || DEFAULT_COUNTRY).toLowerCase();
    this.timezone = options.timezone || DEFAULT_TZ;

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Accept': HEADERS.ACCEPT,
        'Accept-Language': HEADERS.ACCEPT_LANG,
        'Accept-Encoding': HEADERS.ENCODING,
        'Content-Type': HEADERS.CONTENT_TYPE,
        'User-Agent': HEADERS.AGENT,
        'X-Img-Version': HEADERS.IMG_VERSION,
        'X-Locale': HEADERS.LOCALE,
        'X-Client': HEADERS.CLIENT,
        'X-Hour': HEADERS.HOUR,
        'X-Api-Version': HEADERS.API_VERSION,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request logging interceptor
    this.client.interceptors.request.use(
      (config) => {
        const url = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
        console.log(`[PetKit API] ${config.method?.toUpperCase()} ${url}`);

        // Log headers (excluding sensitive data)
        const logHeaders = { ...config.headers } as Record<string, unknown>;
        if (typeof logHeaders['F-Session'] === 'string') {
          logHeaders['F-Session'] = logHeaders['F-Session'].substring(0, 8) + '...';
        }
        if (typeof logHeaders['X-Session'] === 'string') {
          logHeaders['X-Session'] = logHeaders['X-Session'].substring(0, 8) + '...';
        }
        console.log(`[PetKit API] Request headers:`, logHeaders);

        // Log request data (excluding passwords)
        if (config.data) {
          let logData = config.data;
          if (typeof config.data === 'string' && config.data.includes('password=')) {
            logData = config.data.replace(/password=[^&]+/, 'password=***');
          }
          console.log(`[PetKit API] Request data:`, logData);
        }

        if (config.params) {
          console.log(`[PetKit API] Request params:`, config.params);
        }

        return config;
      },
      (error) => {
        console.error('[PetKit API] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response logging and retry logic
    this.client.interceptors.response.use(
      (response) => {
        const url = response.config.baseURL
          ? `${response.config.baseURL}${response.config.url}`
          : response.config.url;
        console.log(`[PetKit API] ${response.status} ${response.config.method?.toUpperCase()} ${url}`);

        const contentLength = response.headers['content-length'];
        const contentType = response.headers['content-type'];
        if (contentLength) {
          console.log(`[PetKit API] Response size: ${contentLength} bytes`);
        }
        if (contentType) {
          console.log(`[PetKit API] Content-Type: ${contentType}`);
        }

        if (response.data) {
          if (typeof response.data === 'object') {
            const keys = Object.keys(response.data);
            console.log(`[PetKit API] Response keys:`, keys);

            if (response.data[RES_KEY]) {
              console.log(`[PetKit API] Result structure:`, response.data[RES_KEY]);
            }
            if (response.data[ERR_KEY]) {
              console.log(`[PetKit API] Error in response:`, response.data[ERR_KEY]);
            }
          } else {
            console.log(`[PetKit API] Response data type:`, typeof response.data);
          }
        }

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as ExtendedAxiosRequestConfig | undefined;
        const url = config?.baseURL
          ? `${config.baseURL}${config.url}`
          : config?.url || 'unknown';

        if (error.response) {
          console.error(`[PetKit API] ${error.response.status} ${config?.method?.toUpperCase()} ${url}`);
          console.error(`[PetKit API] Error response:`, error.response.data);
        } else if (error.request) {
          console.error(`[PetKit API] No response received for ${config?.method?.toUpperCase()} ${url}`);
          console.error(`[PetKit API] Error code:`, error.code);
        } else {
          console.error(`[PetKit API] Request setup error:`, error.message);
        }

        // Retry logic with exponential backoff
        if (config) {
          if (!config._retry) {
            config._retry = 0;
          }

          if (
            config._retry < 5 &&
            (error.code === 'ECONNABORTED' ||
              error.code === 'ENOTFOUND' ||
              error.code === 'ECONNRESET' ||
              (error.response && error.response.status >= 500))
          ) {
            config._retry++;
            const delay = Math.min(1000 * Math.pow(2, config._retry - 1), 16000);
            console.log(`[PetKit API] Retrying request (${config._retry}/5) after ${delay}ms delay`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this.client(config);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async getTimezoneOffset(_timezone: string): Promise<string> {
    const now = new Date();
    const offset = -now.getTimezoneOffset() / 60;
    return offset.toString();
  }

  private async _getBaseUrl(): Promise<void> {
    if (this.region.toLowerCase() === 'china' || this.region.toLowerCase() === 'cn') {
      this.baseUrl = PetkitDomain.CHINA_SRV;
      return;
    }

    try {
      const response = await this.client.get<ApiResponse<RegionServersResponse>>(
        `${PetkitDomain.PASSPORT_PETKIT}${PetkitEndpoint.REGION_SERVERS}`
      );

      if (response.data && response.data[RES_KEY]) {
        const regions = response.data[RES_KEY].list || [];
        for (const region of regions) {
          if (region.name.toLowerCase() === this.region || region.id.toLowerCase() === this.region) {
            this.region = region.id.toLowerCase();
            this.baseUrl = region.gateway;
            return;
          }
        }
      }
      throw new PetkitRegionalServerNotFoundError(this.region);
    } catch (error) {
      if (error instanceof PetkitRegionalServerNotFoundError) {
        throw error;
      }
      throw new PetkitAPIError(`Failed to get base URL: ${(error as Error).message}`);
    }
  }

  async requestLoginCode(): Promise<boolean> {
    await this._getBaseUrl();

    try {
      const response = await this.client.get<ApiResponse<boolean>>(
        `${this.baseUrl}${PetkitEndpoint.GET_LOGIN_CODE}`,
        {
          params: { username: this.username },
        }
      );

      return !!(response.data && response.data[RES_KEY]);
    } catch (error) {
      throw new PetkitAPIError(`Failed to request login code: ${(error as Error).message}`);
    }
  }

  async login(validCode: string | null = null): Promise<boolean> {
    this._session = null;
    await this._getBaseUrl();

    try {
      const clientNfo = {
        ...CLIENT_NFO,
        timezoneId: this.timezone,
        timezone: await this.getTimezoneOffset(this.timezone),
      };

      const data: Record<string, string> = {
        ...LOGIN_DATA,
        client: JSON.stringify(clientNfo),
        encrypt: '1',
        region: this.region,
        username: this.username,
      };

      if (validCode) {
        data.validCode = validCode;
      } else {
        data.password = crypto.createHash('md5').update(this.password).digest('hex');
      }

      const headers = {
        'X-TimezoneId': this.timezone,
        'X-Timezone': await this.getTimezoneOffset(this.timezone),
      };

      const response = await this.client.post<ApiResponse<LoginResponse>>(
        `${this.baseUrl}${PetkitEndpoint.LOGIN}`,
        new URLSearchParams(data),
        { headers }
      );

      if (response.data && response.data[RES_KEY] && response.data[RES_KEY].session) {
        const sessionData = response.data[RES_KEY].session;
        this._session = {
          id: sessionData.id,
          userId: sessionData.userId,
          expiresIn: sessionData.expiresIn,
          region: sessionData.region,
          createdAt: sessionData.createdAt,
        };

        // Set default headers for future requests
        this.client.defaults.headers['F-Session'] = this._session.id;
        this.client.defaults.headers['X-Session'] = this._session.id;
        this.client.defaults.baseURL = this.baseUrl;

        return true;
      } else {
        throw new PetkitAuthenticationError('Login failed: Invalid response format');
      }
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data?.[ERR_KEY]) {
        const errorCode = error.response.data[ERR_KEY].code;
        const errorMsg = error.response.data[ERR_KEY].msg || 'Unknown error';

        switch (errorCode) {
          case 1:
            throw new PetkitServerBusyError(`Server busy: ${errorMsg}`);
          case 5:
            throw new PetkitSessionExpiredError(`Session expired: ${errorMsg}`);
          case 122:
            throw new PetkitAuthenticationError(`Authentication failed: ${errorMsg}`);
          case 125:
            throw new PetkitAuthenticationError('Unregistered email');
          default:
            throw new PetkitAPIError(`Request failed code: ${errorCode}, details: ${errorMsg}`);
        }
      }
      throw new PetkitAPIError(`Login failed: ${(error as Error).message}`);
    }
  }

  async refreshSession(): Promise<void> {
    if (!this._session) {
      throw new PetkitAPIError('No session to refresh');
    }

    try {
      const response = await this.client.post<ApiResponse<LoginResponse>>(
        PetkitEndpoint.REFRESH_SESSION,
        new URLSearchParams(LOGIN_DATA as Record<string, string>),
        {
          headers: {
            'F-Session': this._session.id,
            'X-Session': this._session.id,
          },
        }
      );

      if (response.data && response.data[RES_KEY] && response.data[RES_KEY].session) {
        const sessionData = response.data[RES_KEY].session;
        this._session = {
          ...this._session,
          id: sessionData.id,
          userId: sessionData.userId,
          expiresIn: sessionData.expiresIn,
          region: sessionData.region,
          createdAt: sessionData.createdAt,
          refreshedAt: new Date().toISOString(),
        };

        this.client.defaults.headers['F-Session'] = this._session.id;
        this.client.defaults.headers['X-Session'] = this._session.id;
      }
    } catch (error) {
      throw new PetkitAPIError(`Failed to refresh session: ${(error as Error).message}`);
    }
  }

  async validateSession(): Promise<void> {
    if (!this._session) {
      await this.login();
      return;
    }

    const created = new Date(this._session.createdAt);
    const now = new Date();
    const tokenAge = (now.getTime() - created.getTime()) / 1000;

    if (tokenAge >= this._session.expiresIn) {
      await this.login();
    }
  }

  private async getSessionHeaders(): Promise<Record<string, string>> {
    await this.validateSession();
    if (!this._session) {
      throw new PetkitAPIError('No session available');
    }
    return {
      'F-Session': this._session.id,
      'X-Session': this._session.id,
    };
  }

  private async _getPetDetails(): Promise<PetDetails[]> {
    const headers = await this.getSessionHeaders();

    try {
      const response = await this.client.get<ApiResponse<{ user: { dogs?: PetDetails[] } }>>(
        PetkitEndpoint.DETAILS,
        { headers }
      );

      if (response.data && response.data[RES_KEY] && response.data[RES_KEY].user) {
        const userDetails = response.data[RES_KEY].user;
        return userDetails.dogs || [];
      }
      return [];
    } catch (error) {
      throw new PetkitAPIError(`Failed to get pet details: ${(error as Error).message}`);
    }
  }

  private async _getAccountData(): Promise<void> {
    const headers = await this.getSessionHeaders();

    try {
      const response = await this.client.get<ApiResponse<AccountData[]>>(
        PetkitEndpoint.FAMILY_LIST,
        { headers }
      );

      if (response.data && response.data[RES_KEY]) {
        this.accountData = response.data[RES_KEY];

        // Add pets to entities
        for (const account of this.accountData) {
          if (account.petList) {
            for (const pet of account.petList) {
              const petEntity: DeviceEntity = {
                type: DeviceType.PET,
                deviceNfo: {
                  deviceType: DeviceType.PET,
                  deviceId: pet.petId,
                  createdAt: pet.createdAt,
                  deviceName: pet.petName,
                  groupId: 0,
                  type: 0,
                  typeCode: 0,
                  uniqueId: pet.sn?.toString(),
                },
                ...pet,
              };
              this.petkitEntities.set(pet.petId, petEntity);
            }
          }
        }

        // Fetch and update pet details
        const petDetailsList = await this._getPetDetails();
        for (const petDetails of petDetailsList) {
          const petId = petDetails.id;
          if (this.petkitEntities.has(petId)) {
            const pet = this.petkitEntities.get(petId)!;
            pet.petDetails = petDetails;
            this.petkitEntities.set(petId, pet);
          }
        }
      }
    } catch (error) {
      throw new PetkitAPIError(`Failed to get account data: ${(error as Error).message}`);
    }
  }

  async getDevicesData(): Promise<void> {
    const startTime = Date.now();

    if (!this.accountData.length) {
      await this._getAccountData();
    }

    await this._fetchDeviceDetails();
    await this._fetchAdditionalDeviceData();

    const endTime = Date.now();
    console.log(`Petkit data fetched successfully in: ${endTime - startTime}ms`);
  }

  private async _fetchAdditionalDeviceData(): Promise<void> {
    const deviceList = this._collectDevices();
    const { recordTasks, mediaTasks, liveTasks } = this._prepareTasks(deviceList);

    console.log(
      `[PetKit API] Fetching additional data: ${recordTasks.length} record tasks, ${mediaTasks.length} media tasks, ${liveTasks.length} live tasks`
    );

    await Promise.all(recordTasks);
    await Promise.all(mediaTasks);
    await Promise.all(liveTasks);
    await this._executeStatsTasks();
  }

  private async _fetchDeviceDetails(): Promise<void> {
    const headers = await this.getSessionHeaders();
    const deviceList = this._collectDevices();

    console.log(`[PetKit API] Fetching detailed data for ${deviceList.length} devices`);

    const devicesByType = this._groupDevicesByType(deviceList);

    for (const [deviceTypeCode, devices] of devicesByType) {
      try {
        console.log(`[PetKit API] Fetching details for ${devices.length} devices of type: ${deviceTypeCode}`);

        const response = await this.client.get<ApiResponse<RawDevice[]>>(
          `${deviceTypeCode}/${PetkitEndpoint.OWN_DEVICES}`,
          { headers }
        );

        if (response.data && response.data[RES_KEY]) {
          const detailedDevices = response.data[RES_KEY];
          console.log(`[PetKit API] Received ${detailedDevices.length} detailed devices for type ${deviceTypeCode}`);

          for (const device of devices) {
            const detailedDevice = detailedDevices.find((d) => d.id === device.deviceId);

            if (detailedDevice) {
              const deviceType = this._mapDeviceTypeCodeToName(deviceTypeCode);

              const deviceEntity: DeviceEntity = {
                ...(detailedDevice.state || {}),
                type: deviceType,
                deviceNfo: {
                  deviceType: deviceTypeCode,
                  deviceId: detailedDevice.id,
                  createdAt: detailedDevice.createdAt,
                  deviceName: detailedDevice.name,
                  mac: detailedDevice.mac,
                  sn: detailedDevice.sn,
                  hardware: detailedDevice.hardware,
                  firmware: detailedDevice.firmware,
                  timezone: detailedDevice.timezone,
                  locale: detailedDevice.locale,
                  typeCode: detailedDevice.typeCode,
                  familyId: detailedDevice.familyId,
                  uniqueId: detailedDevice.sn,
                },
                settings: detailedDevice.settings,
                k3Device: detailedDevice.k3Device as DeviceEntity | undefined,
                rawDevice: detailedDevice,
              };

              this.petkitEntities.set(device.deviceId, deviceEntity);
              console.log(`[PetKit API] Updated device: ${detailedDevice.name} (${deviceType}) - ID: ${device.deviceId}`);
            } else {
              console.log(`[PetKit API] No detailed data found for device ${device.deviceId} in type ${deviceTypeCode}`);
            }
          }
        }
      } catch (error) {
        console.error(`[PetKit API] Failed to fetch details for device type ${deviceTypeCode}: ${(error as Error).message}`);
      }
    }
  }

  private _groupDevicesByType(deviceList: BasicDevice[]): Map<string, BasicDevice[]> {
    const devicesByType = new Map<string, BasicDevice[]>();

    for (const device of deviceList) {
      const deviceTypeCode = this._getDeviceTypeCode(device);

      if (!devicesByType.has(deviceTypeCode)) {
        devicesByType.set(deviceTypeCode, []);
      }
      devicesByType.get(deviceTypeCode)!.push(device);
    }

    return devicesByType;
  }

  private _getDeviceTypeCode(device: BasicDevice): string {
    const deviceType = device.deviceType?.toLowerCase() || '';
    const deviceName = device.deviceName?.toLowerCase() || '';

    if (
      (DEVICES_LITTER_BOX as readonly string[]).includes(deviceType) ||
      deviceName.includes('litter') ||
      deviceName.includes('pura')
    ) {
      return 't4';
    } else if ((DEVICES_FEEDER as readonly string[]).includes(deviceType) || deviceName.includes('feeder') || deviceName.includes('fresh')) {
      return 'd4';
    } else if ((DEVICES_WATER_FOUNTAIN as readonly string[]).includes(deviceType) || deviceName.includes('fountain') || deviceName.includes('water')) {
      return 'w5';
    } else if ((DEVICES_PURIFIER as readonly string[]).includes(deviceType) || deviceName.includes('purifier') || deviceName.includes('air')) {
      return 'k3';
    }

    if (deviceName.includes('pura') || deviceName.includes('max')) {
      return 't4';
    }

    console.log(`[PetKit API] Unknown device type for ${device.deviceName}, defaulting to t4`);
    return 't4';
  }

  private _mapDeviceTypeCodeToName(deviceTypeCode: string): string {
    switch (deviceTypeCode) {
      case 't4':
        return 'Litter';
      case 'd4':
        return 'Feeder';
      case 'w5':
        return 'WaterFountain';
      case 'k3':
        return 'Purifier';
      default:
        return 'Unknown';
    }
  }

  private _collectDevices(): BasicDevice[] {
    const deviceList: BasicDevice[] = [];
    for (const account of this.accountData) {
      if (account.deviceList) {
        deviceList.push(...account.deviceList);
      }
    }
    return deviceList;
  }

  private _prepareTasks(deviceList: BasicDevice[]): {
    mainTasks: Promise<void>[];
    recordTasks: Promise<void>[];
    liveTasks: Promise<void>[];
    mediaTasks: Promise<void>[];
  } {
    const mainTasks: Promise<void>[] = [];
    const recordTasks: Promise<void>[] = [];
    const liveTasks: Promise<void>[] = [];
    const mediaTasks: Promise<void>[] = [];

    for (const device of deviceList) {
      const deviceType = device.deviceType?.toLowerCase() || '';
      if ((DEVICES_FEEDER as readonly string[]).includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'Feeder'));
        recordTasks.push(this._fetchDeviceData(device, 'FeederRecord'));
        if ((FEEDER_WITH_CAMERA as readonly string[]).includes(deviceType)) {
          mediaTasks.push(this._fetchMedia(device));
          liveTasks.push(this._fetchDeviceData(device, 'LiveFeed'));
        }
      } else if ((DEVICES_LITTER_BOX as readonly string[]).includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'Litter'));
        recordTasks.push(this._fetchDeviceData(device, 'LitterRecord'));
        if ((LITTER_NO_CAMERA as readonly string[]).includes(deviceType)) {
          recordTasks.push(this._fetchDeviceData(device, 'LitterStats'));
        }
        if ((LITTER_WITH_CAMERA as readonly string[]).includes(deviceType)) {
          recordTasks.push(this._fetchDeviceData(device, 'PetOutGraph'));
          mediaTasks.push(this._fetchMedia(device));
          liveTasks.push(this._fetchDeviceData(device, 'LiveFeed'));
        }
      } else if ((DEVICES_WATER_FOUNTAIN as readonly string[]).includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'WaterFountain'));
        recordTasks.push(this._fetchDeviceData(device, 'WaterFountainRecord'));
      } else if ((DEVICES_PURIFIER as readonly string[]).includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'Purifier'));
      }
    }

    return { mainTasks, recordTasks, mediaTasks, liveTasks };
  }

  private async _executeStatsTasks(): Promise<void> {
    const statsTasks: Promise<void>[] = [];
    for (const [_deviceId, entity] of this.petkitEntities) {
      if (entity.type === 'Litter') {
        statsTasks.push(this.populatePetStats(entity));
      }
    }
    await Promise.all(statsTasks);
  }

  private async _fetchMedia(device: BasicDevice): Promise<void> {
    console.log(`Fetching media for device: ${device.deviceId}`);
  }

  private async _fetchDeviceData(device: BasicDevice, dataClass: string): Promise<void> {
    const headers = await this.getSessionHeaders();
    const deviceTypeCode = this._getDeviceTypeCode(device);
    const endpoint = this._getEndpointForDataClass(dataClass);

    if (!endpoint) {
      console.log(`Endpoint not found for device type: ${deviceTypeCode}, data class: ${dataClass}`);
      return;
    }

    const params = this._getRequestParams(device, dataClass);

    try {
      console.log(`[PetKit API] Fetching ${dataClass} for device ${device.deviceId} via ${deviceTypeCode}/${endpoint}`);

      const response = await this.client.post<ApiResponse<unknown>>(
        `${deviceTypeCode}/${endpoint}`,
        new URLSearchParams(params as Record<string, string>),
        { headers }
      );

      let responseData = response.data && response.data[RES_KEY];
      if (!responseData) {
        console.log(`No data returned for ${deviceTypeCode}/${endpoint}`);
        return;
      }

      if (typeof responseData === 'object' && responseData !== null && 'list' in responseData) {
        responseData = (responseData as { list: unknown }).list;
      }

      this._handleDataResponse(device, responseData, dataClass);
    } catch (error) {
      console.error(`Failed to fetch device data for ${deviceTypeCode}/${endpoint}: ${(error as Error).message}`);
    }
  }

  private _getEndpointForDataClass(dataClass: string): string | undefined {
    const endpointMap: Record<string, string> = {
      Feeder: PetkitEndpoint.OWN_DEVICES,
      Litter: PetkitEndpoint.OWN_DEVICES,
      WaterFountain: PetkitEndpoint.OWN_DEVICES,
      Purifier: PetkitEndpoint.OWN_DEVICES,
      FeederRecord: PetkitEndpoint.GET_DEVICE_RECORD,
      LitterRecord: PetkitEndpoint.GET_DEVICE_RECORD,
      WaterFountainRecord: PetkitEndpoint.GET_DEVICE_RECORD,
      LitterStats: PetkitEndpoint.STATISTIC,
      PetOutGraph: PetkitEndpoint.GET_PET_OUT_GRAPH,
      LiveFeed: PetkitEndpoint.LIVE,
    };

    return endpointMap[dataClass];
  }

  private _getRequestParams(device: BasicDevice, dataClass: string): Record<string, string | number> {
    const deviceId = String(device.deviceId);
    const baseParams = { deviceId };

    const today = new Date();
    const dateStr =
      today.getFullYear() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');

    switch (dataClass) {
      case 'LitterStats':
      case 'statistic':
        return {
          ...baseParams,
          startDate: dateStr,
          endDate: dateStr,
          type: '0',
        };

      case 'FeederRecord':
      case 'LitterRecord':
      case 'WaterFountainRecord':
      case 'getDeviceRecord':
        return {
          date: dateStr,
          deviceId: deviceId,
        };

      case 'PetOutGraph':
      case 'getPetOutGraph':
        return {
          ...baseParams,
          startDate: dateStr,
          endDate: dateStr,
        };

      case 'LiveFeed':
      case 'start/live':
        return baseParams;

      default:
        return baseParams;
    }
  }

  private _handleDataResponse(device: BasicDevice, responseData: unknown, dataClass: string): void {
    const deviceId = device.deviceId;

    if (dataClass.includes('Record') || dataClass === 'LitterStats' || dataClass === 'PetOutGraph') {
      const existingEntity = this.petkitEntities.get(deviceId);
      if (existingEntity) {
        if (dataClass === 'LitterStats') {
          existingEntity.deviceStats = responseData as DeviceEntity['deviceStats'];
        } else if (dataClass === 'PetOutGraph') {
          existingEntity.devicePetGraphOut = responseData as DeviceEntity['devicePetGraphOut'];
        } else {
          existingEntity.deviceRecords = responseData as DeviceEntity['deviceRecords'];
        }
        this.petkitEntities.set(deviceId, existingEntity);
      }
    } else if (dataClass === 'LiveFeed') {
      const existingEntity = this.petkitEntities.get(deviceId);
      if (existingEntity) {
        existingEntity.liveFeed = responseData as DeviceEntity['liveFeed'];
        this.petkitEntities.set(deviceId, existingEntity);
      }
    } else {
      const deviceData: DeviceEntity = {
        ...(responseData as object),
        type: dataClass,
        deviceNfo: device as unknown as DeviceNfo,
      };
      this.petkitEntities.set(deviceId, deviceData);
    }
  }

  private async populatePetStats(litterData: DeviceEntity): Promise<void> {
    console.log(`Populating pet stats for litter: ${litterData.deviceNfo?.deviceId}`);
  }

  async getPetsList(): Promise<DeviceEntity[]> {
    const pets: DeviceEntity[] = [];
    for (const [_id, entity] of this.petkitEntities) {
      if (entity.type === DeviceType.PET) {
        pets.push(entity);
      }
    }
    return pets;
  }

  async sendApiRequest(
    deviceId: number,
    action: string,
    setting: Record<string, unknown> | null = null
  ): Promise<unknown> {
    const device = this.petkitEntities.get(deviceId);
    if (!device) {
      throw new PetkitDeviceNotFoundError(deviceId);
    }

    if (!device.deviceNfo) {
      throw new PetkitAPIError(`Device with ID ${deviceId} has no device info`);
    }

    const deviceType = device.deviceNfo.deviceType.toLowerCase();

    const actionConfig = ACTIONS_MAP[action];
    if (!actionConfig) {
      throw new PetkitAPIError(`Action '${action}' is not supported`);
    }

    if (!(actionConfig.supportedDevices as readonly string[]).includes(deviceType)) {
      throw new PetkitUnsupportedActionError(action, deviceType, actionConfig.supportedDevices);
    }

    const headers = await this.getSessionHeaders();

    const endpoint = actionConfig.getEndpoint
      ? actionConfig.getEndpoint(deviceType)
      : actionConfig.endpoint!;

    const params = actionConfig.getParams(device, setting || undefined);

    try {
      console.log(`[PetKit API] Sending command '${action}' to device ${deviceId} (${deviceType})`);
      console.log(`[PetKit API] Endpoint: ${deviceType}/${endpoint}`);
      console.log(`[PetKit API] Params:`, params);

      const response = await this.client.post<ApiResponse<unknown>>(
        `${deviceType}/${endpoint}`,
        new URLSearchParams(params as Record<string, string>),
        { headers }
      );

      return response.data && response.data[RES_KEY];
    } catch (error) {
      throw new PetkitAPIError(`Failed to send command '${action}': ${(error as Error).message}`);
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  async getDevices(): Promise<DeviceEntity[]> {
    await this.getDevicesData();
    return Array.from(this.petkitEntities.values()).filter((entity) => entity.deviceNfo);
  }

  async getDeviceStatus(deviceId: number): Promise<DeviceEntity> {
    await this.getDevicesData();
    const device = this.petkitEntities.get(deviceId);
    if (!device) {
      throw new PetkitDeviceNotFoundError(deviceId);
    }
    return device;
  }

  async getLitterStatus(deviceId: number): Promise<LitterStatus> {
    const device = await this.getDeviceStatus(deviceId);
    return {
      litterLevel: device.sandPercent ?? device.sand_percent ?? 0,
      wasteLevel: device.box ?? 0,
      batteryLevel: device.battery ?? 100,
      _raw: device,
    };
  }

  async getFeederStatus(deviceId: number): Promise<FeederStatus> {
    const device = await this.getDeviceStatus(deviceId);
    return {
      batteryLevel: device.batteryPower ?? device.battery_power ?? device.battery ?? 0,
      foodLevel: device.food ?? device.food1 ?? 0,
      _raw: device,
    };
  }

  async getFountainStatus(deviceId: number): Promise<FountainStatus> {
    const device = await this.getDeviceStatus(deviceId);
    return {
      waterLevel: device.filterPercent ?? device.filter_percent ?? 100,
      filterLife: device.filterPercent ?? device.filter_percent ?? 100,
      pumpRunning: device.runStatus === 1 || device.run_status === 1 || false,
      mode: (device.mode ?? 0).toString(),
      _raw: device,
    };
  }

  async getPurifierStatus(deviceId: number): Promise<PurifierStatus> {
    const device = await this.getDeviceStatus(deviceId);
    const state = device.rawDevice?.state || device;
    return {
      airQuality: state.humidity ?? 0,
      filterLife: state.leftDay ?? state.left_day ?? 100,
      mode: state.mode ?? 0,
      fanSpeed: state.refresh ?? 1,
      _raw: device,
    };
  }

  // ============================================================================
  // Feeder Actions
  // ============================================================================

  async feedManual(deviceId: number, amount: number = 1): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.MANUAL_FEED, { amount });
  }

  async feedManualDual(deviceId: number, amount1: number = 1, amount2: number = 1): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.MANUAL_FEED_DUAL, { amount1, amount2 });
  }

  async cancelManualFeed(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.CANCEL_MANUAL_FEED);
  }

  async resetDesiccant(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.RESET_DESICCANT);
  }

  async foodReplenished(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.FOOD_REPLENISHED);
  }

  async calibrateFeeder(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.CALIBRATION);
  }

  async callPet(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.CALL_PET);
  }

  async removeDailyFeed(deviceId: number, feedId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.REMOVE_DAILY_FEED, { feedId });
  }

  async restoreDailyFeed(deviceId: number, feedId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, FeederCommand.RESTORE_DAILY_FEED, { feedId });
  }

  // ============================================================================
  // Litter Box Actions
  // ============================================================================

  async startCleaning(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.CLEANING });
  }

  async startDumping(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.DUMPING });
  }

  async startOdorRemoval(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.ODOR_REMOVAL });
  }

  async stopLitterAction(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.STOP);
  }

  async resetN50Deodorizer(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, LitterCommand.RESET_N50_DEODORIZER);
  }

  async toggleLitterLight(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.LIGHT });
  }

  async startMaintenance(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.MAINTENANCE });
  }

  async levelLitter(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.LEVELING });
  }

  async calibrateLitter(deviceId: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.CALIBRATING });
  }

  // ============================================================================
  // Purifier Actions
  // ============================================================================

  async setPurifierMode(deviceId: number, mode: PurMode): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.MODE, { mode });
  }

  async powerPurifier(deviceId: number, power: boolean): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceAction.POWER, { power });
  }

  // ============================================================================
  // Water Fountain Actions
  // ============================================================================

  async setFountainMode(deviceId: number, mode: number): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceCommand.UPDATE_SETTING, { mode });
  }

  // ============================================================================
  // General Device Actions
  // ============================================================================

  async updateDeviceSetting(deviceId: number, settings: Record<string, unknown>): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceCommand.UPDATE_SETTING, settings);
  }

  async controlDevice(deviceId: number, settings: Record<string, unknown>): Promise<unknown> {
    return this.sendApiRequest(deviceId, DeviceCommand.CONTROL_DEVICE, settings);
  }

  // ============================================================================
  // Pet Actions
  // ============================================================================

  async updatePetSetting(petId: number, settings: Record<string, unknown>): Promise<unknown> {
    return this.sendApiRequest(petId, PetCommand.PET_UPDATE_SETTING, settings);
  }

  // ============================================================================
  // Session State
  // ============================================================================

  isLoggedIn(): boolean {
    return !!this._session;
  }

  logout(): void {
    this._session = null;
    delete this.client.defaults.headers['F-Session'];
    delete this.client.defaults.headers['X-Session'];
    delete this.client.defaults.baseURL;
  }
}
