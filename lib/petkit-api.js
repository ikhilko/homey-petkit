'use strict';

const axios = require('axios');
const crypto = require('crypto');

// Constants matching Python implementation
const DEFAULT_COUNTRY = 'DE';
const DEFAULT_TZ = 'Europe/Berlin';

const RES_KEY = 'result';
const ERR_KEY = 'error';

// Device types
const FEEDER = 'feeder';
const FEEDER_MINI = 'feedermini';
const D3 = 'd3';
const D4 = 'd4';
const D4S = 'd4s';
const D4H = 'd4h';
const D4SH = 'd4sh';
const T3 = 't3';
const T4 = 't4';
const T5 = 't5';
const T6 = 't6';
const T7 = 't7';
const W4 = 'w4';
const W5 = 'w5';
const CTW2 = 'ctw2';
const CTW3 = 'ctw3';
const K2 = 'k2';
const K3 = 'k3';
const PET = 'pet';

// Device groups
const DEVICES_LITTER_BOX = [T3, T4, T5, T6, T7];
const LITTER_WITH_CAMERA = [T5, T6, T7];
const LITTER_NO_CAMERA = [T3, T4];
const FEEDER_WITH_CAMERA = [D4H, D4SH];
const DEVICES_FEEDER = [FEEDER, FEEDER_MINI, D3, D4, D4S, D4H, D4SH];
const DEVICES_WATER_FOUNTAIN = [W4, W5, CTW2, CTW3];
const DEVICES_PURIFIER = [K2, K3];

// PetKit domains
const PETKIT_DOMAINS = {
  PASSPORT_PETKIT: 'https://passport.petkt.com/',
  CHINA_SRV: 'https://api.petkit.cn/6/'
};

// Endpoints
const PETKIT_ENDPOINTS = {
  REGION_SERVERS: 'v1/regionservers',
  LOGIN: 'user/login',
  GET_LOGIN_CODE: 'user/sendcodeforquicklogin',
  REFRESH_SESSION: 'user/refreshsession',
  DETAILS: 'user/details2',
  FAMILY_LIST: 'group/family/list',
  DEVICE_DETAIL: 'device_detail',
  OWN_DEVICES: 'owndevices',
  GET_DEVICE_RECORD: 'getDeviceRecord',
  CONTROL_DEVICE: 'controlDevice',
  STATISTIC: 'statistic',
  GET_PET_OUT_GRAPH: 'getPetOutGraph',
  LIVE: 'start/live',
  CLOUD_VIDEO: 'cloud/video'
};

// Headers matching Python implementation
const HEADERS = {
  ACCEPT: '*/*',
  ACCEPT_LANG: 'en-US;q=1, it-US;q=0.9',
  ENCODING: 'gzip, deflate',
  API_VERSION: '12.6.0',
  CONTENT_TYPE: 'application/x-www-form-urlencoded',
  AGENT: 'okhttp/3.14.19',
  CLIENT: 'android(15.1;23127PN0CG)',
  LOCALE: 'en-US',
  IMG_VERSION: '1',
  HOUR: '24'
};

// Client info matching Python implementation
const CLIENT_NFO = {
  locale: HEADERS.LOCALE,
  name: '23127PN0CG',
  osVersion: '15.1',
  phoneBrand: 'Xiaomi',
  platform: 'android',
  source: 'app.petkit-android',
  version: HEADERS.API_VERSION
};

const LOGIN_DATA = {
  oldVersion: HEADERS.API_VERSION
};

class PetkitAPIError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'PetkitAPIError';
    this.code = code;
  }
}

class PetkitAuthenticationError extends PetkitAPIError {
  constructor(message) {
    super(message);
    this.name = 'PetkitAuthenticationError';
  }
}

class PetkitSessionExpiredError extends PetkitAPIError {
  constructor(message) {
    super(message);
    this.name = 'PetkitSessionExpiredError';
  }
}

class PetkitServerBusyError extends PetkitAPIError {
  constructor(message) {
    super(message);
    this.name = 'PetkitServerBusyError';
  }
}

class PetkitRegionalServerNotFoundError extends PetkitAPIError {
  constructor(region) {
    super(`Regional server not found for region: ${region}`);
    this.name = 'PetkitRegionalServerNotFoundError';
  }
}

class PetKitClient {
  constructor(options = {}) {
    this.username = options.username;
    this.password = options.password;
    this.region = (options.region || DEFAULT_COUNTRY).toLowerCase();
    this.timezone = options.timezone || DEFAULT_TZ;

    this._session = null;
    this.accountData = [];
    this.petkitEntities = new Map();
    this.baseUrl = PETKIT_DOMAINS.PASSPORT_PETKIT;

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
        'X-Api-Version': HEADERS.API_VERSION
      }
    });

    // Add request logging interceptor
    this.client.interceptors.request.use(
      (config) => {
        const url = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
        console.log(`[PetKit API] ${config.method?.toUpperCase()} ${url}`);

        // Log headers (excluding sensitive data)
        const logHeaders = { ...config.headers };
        if (logHeaders['F-Session']) {
          logHeaders['F-Session'] = logHeaders['F-Session'].substring(0, 8) + '...';
        }
        if (logHeaders['X-Session']) {
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

    // Add response logging and retry logic
    this.client.interceptors.response.use(
      (response) => {
        const url = response.config.baseURL ? `${response.config.baseURL}${response.config.url}` : response.config.url;
        console.log(`[PetKit API] ${response.status} ${response.config.method?.toUpperCase()} ${url}`);

        // Log response size and content type
        const contentLength = response.headers['content-length'];
        const contentType = response.headers['content-type'];
        if (contentLength) {
          console.log(`[PetKit API] Response size: ${contentLength} bytes`);
        }
        if (contentType) {
          console.log(`[PetKit API] Content-Type: ${contentType}`);
        }

        // Log response data structure (without full content to avoid spam)
        if (response.data) {
          if (typeof response.data === 'object') {
            const keys = Object.keys(response.data);
            console.log(`[PetKit API] Response keys:`, keys);

            // Log result/error structure
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
      async (error) => {
        const config = error.config;
        const url = config?.baseURL ? `${config.baseURL}${config.url}` : config?.url || 'unknown';

        // Log error details
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
        if (!config._retry) {
          config._retry = 0;
        }

        if (config._retry < 5 && (
          error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNRESET' ||
          (error.response && error.response.status >= 500)
        )) {
          config._retry++;
          const delay = Math.min(1000 * Math.pow(2, config._retry - 1), 16000);
          console.log(`[PetKit API] Retrying request (${config._retry}/5) after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  async getTimezoneOffset(timezone) {
    // Simple timezone offset calculation
    // In a real implementation, you might want to use a proper timezone library
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const offset = -now.getTimezoneOffset() / 60;
    return offset.toString();
  }

  async _getBaseUrl() {
    if (this.region.toLowerCase() === 'china' || this.region.toLowerCase() === 'cn') {
      this.baseUrl = PETKIT_DOMAINS.CHINA_SRV;
      return;
    }

    try {
      const response = await this.client.get(
        `${PETKIT_DOMAINS.PASSPORT_PETKIT}${PETKIT_ENDPOINTS.REGION_SERVERS}`
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
      throw new PetkitAPIError(`Failed to get base URL: ${error.message}`);
    }
  }

  async requestLoginCode() {
    await this._getBaseUrl();

    try {
      const response = await this.client.get(`${this.baseUrl}${PETKIT_ENDPOINTS.GET_LOGIN_CODE}`, {
        params: { username: this.username }
      });

      return response.data && response.data[RES_KEY];
    } catch (error) {
      throw new PetkitAPIError(`Failed to request login code: ${error.message}`);
    }
  }

  async login(validCode = null) {
    this._session = null;
    await this._getBaseUrl();

    try {
      const clientNfo = { ...CLIENT_NFO };
      clientNfo.timezoneId = this.timezone;
      clientNfo.timezone = await this.getTimezoneOffset(this.timezone);

      const data = { ...LOGIN_DATA };
      data.client = JSON.stringify(clientNfo);
      data.encrypt = '1';
      data.region = this.region;
      data.username = this.username;

      if (validCode) {
        data.validCode = validCode;
      } else {
        data.password = crypto.createHash('md5').update(this.password).digest('hex');
      }

      const headers = {
        'X-TimezoneId': this.timezone,
        'X-Timezone': await this.getTimezoneOffset(this.timezone)
      };

      const response = await this.client.post(
        `${this.baseUrl}${PETKIT_ENDPOINTS.LOGIN}`,
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
          createdAt: sessionData.createdAt
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
      if (error.response && error.response.data && error.response.data[ERR_KEY]) {
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
      throw new PetkitAPIError(`Login failed: ${error.message}`);
    }
  }

  async refreshSession() {
    if (!this._session) {
      throw new PetkitAPIError('No session to refresh');
    }

    try {
      const response = await this.client.post(
        PETKIT_ENDPOINTS.REFRESH_SESSION,
        new URLSearchParams(LOGIN_DATA),
        {
          headers: {
            'F-Session': this._session.id,
            'X-Session': this._session.id
          }
        }
      );

      if (response.data && response.data[RES_KEY] && response.data[RES_KEY].session) {
        const sessionData = response.data[RES_KEY].session;
        this._session = {
          ...this._session,
          ...sessionData,
          refreshedAt: new Date().toISOString()
        };

        this.client.defaults.headers['F-Session'] = this._session.id;
        this.client.defaults.headers['X-Session'] = this._session.id;
      }
    } catch (error) {
      throw new PetkitAPIError(`Failed to refresh session: ${error.message}`);
    }
  }

  async validateSession() {
    if (!this._session) {
      await this.login();
      return;
    }

    const created = new Date(this._session.createdAt);
    const now = new Date();
    const tokenAge = (now - created) / 1000;

    if (tokenAge >= this._session.expiresIn) {
      await this.login();
    }
  }

  async getSessionHeaders() {
    await this.validateSession();
    if (!this._session) {
      throw new PetkitAPIError('No session available');
    }
    return {
      'F-Session': this._session.id,
      'X-Session': this._session.id
    };
  }

  async _getPetDetails() {
    const headers = await this.getSessionHeaders();

    try {
      const response = await this.client.get(
        PETKIT_ENDPOINTS.DETAILS,
        { headers }
      );

      if (response.data && response.data[RES_KEY] && response.data[RES_KEY].user) {
        const userDetails = response.data[RES_KEY].user;
        return userDetails.dogs || [];
      }
      return [];
    } catch (error) {
      throw new PetkitAPIError(`Failed to get pet details: ${error.message}`);
    }
  }

  async _getAccountData() {
    const headers = await this.getSessionHeaders();

    try {
      // First get family data (pets, basic device list)
      const response = await this.client.get(
        PETKIT_ENDPOINTS.FAMILY_LIST,
        { headers }
      );

      if (response.data && response.data[RES_KEY]) {
        this.accountData = response.data[RES_KEY];

        // Add pets to entities
        for (const account of this.accountData) {
          if (account.petList) {
            for (const pet of account.petList) {
              this.petkitEntities.set(pet.petId, {
                ...pet,
                type: PET,
                deviceNfo: {
                  deviceType: PET,
                  deviceId: pet.petId,
                  createdAt: pet.createdAt,
                  deviceName: pet.petName,
                  groupId: 0,
                  type: 0,
                  typeCode: 0,
                  uniqueId: pet.sn?.toString()
                }
              });
            }
          }
        }

        // Fetch and update pet details
        const petDetailsList = await this._getPetDetails();
        for (const petDetails of petDetailsList) {
          const petId = petDetails.id;
          if (this.petkitEntities.has(petId)) {
            const pet = this.petkitEntities.get(petId);
            pet.petDetails = petDetails;
            this.petkitEntities.set(petId, pet);
          }
        }
      }
    } catch (error) {
      throw new PetkitAPIError(`Failed to get account data: ${error.message}`);
    }
  }

  async getDevicesData() {
    const startTime = Date.now();

    if (!this.accountData.length) {
      await this._getAccountData();
    }

    // Now fetch detailed device data for each device using OWN_DEVICES endpoint
    await this._fetchDeviceDetails();

    // Fetch additional device data (records, stats, live feeds, etc.)
    await this._fetchAdditionalDeviceData();

    const endTime = Date.now();
    console.log(`Petkit data fetched successfully in: ${endTime - startTime}ms`);
  }

  async _fetchAdditionalDeviceData() {
    const deviceList = this._collectDevices();
    const { recordTasks, mediaTasks, liveTasks } = this._prepareTasks(deviceList);

    console.log(`[PetKit API] Fetching additional data: ${recordTasks.length} record tasks, ${mediaTasks.length} media tasks, ${liveTasks.length} live tasks`);

    // Execute tasks in sequence as per Python implementation
    // Note: mainTasks (basic device data) are already fetched by OWN_DEVICES endpoint
    await Promise.all(recordTasks);
    await Promise.all(mediaTasks);
    await Promise.all(liveTasks);
    await this._executeStatsTasks();
  }

  async _fetchDeviceDetails() {
    const headers = await this.getSessionHeaders();
    const deviceList = this._collectDevices();

    console.log(`[PetKit API] Fetching detailed data for ${deviceList.length} devices`);

    // Group devices by their type for efficient API calls
    const devicesByType = this._groupDevicesByType(deviceList);

    // Fetch detailed data for each device type
    for (const [deviceTypeCode, devices] of devicesByType) {
      try {
        console.log(`[PetKit API] Fetching details for ${devices.length} devices of type: ${deviceTypeCode}`);

        // Call the type-specific owndevices endpoint
        const response = await this.client.get(
          `${deviceTypeCode}/${PETKIT_ENDPOINTS.OWN_DEVICES}`,
          { headers }
        );

        if (response.data && response.data[RES_KEY]) {
          const detailedDevices = response.data[RES_KEY];
          console.log(`[PetKit API] Received ${detailedDevices.length} detailed devices for type ${deviceTypeCode}`);

          // Match detailed devices with basic devices from family data
          for (const device of devices) {
            const detailedDevice = detailedDevices.find(d => d.id === device.deviceId);

            if (detailedDevice) {
              // Map device type code to device type name
              const deviceType = this._mapDeviceTypeCodeToName(deviceTypeCode);

              // Create enhanced device entity with detailed data
              const deviceEntity = {
                ...detailedDevice.state, // Include current state
                type: deviceType,
                deviceNfo: {
                  deviceType: deviceType.toLowerCase(),
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
                  uniqueId: detailedDevice.sn
                },
                settings: detailedDevice.settings,
                k3Device: detailedDevice.k3Device, // For litter boxes with spray attachment
                rawDevice: detailedDevice // Keep full device data for reference
              };

              this.petkitEntities.set(device.deviceId, deviceEntity);
              console.log(`[PetKit API] Updated device: ${detailedDevice.name} (${deviceType}) - ID: ${device.deviceId}`);
            } else {
              console.log(`[PetKit API] No detailed data found for device ${device.deviceId} in type ${deviceTypeCode}`);
            }
          }
        }
      } catch (error) {
        console.error(`[PetKit API] Failed to fetch details for device type ${deviceTypeCode}: ${error.message}`);
      }
    }
  }

  _groupDevicesByType(deviceList) {
    const devicesByType = new Map();

    for (const device of deviceList) {
      // Determine device type code from device info
      let deviceTypeCode = this._getDeviceTypeCode(device);

      if (!devicesByType.has(deviceTypeCode)) {
        devicesByType.set(deviceTypeCode, []);
      }
      devicesByType.get(deviceTypeCode).push(device);
    }

    return devicesByType;
  }

  _getDeviceTypeCode(device) {
    // Map device to API endpoint prefix based on device type or name
    const deviceType = device.deviceType?.toLowerCase() || '';
    const deviceName = device.deviceName?.toLowerCase() || '';

    // First try to identify by existing deviceType if available
    if (DEVICES_LITTER_BOX.includes(deviceType) || deviceName.includes('litter') || deviceName.includes('pura')) {
      return 't4'; // Litter boxes use t4 endpoint
    } else if (DEVICES_FEEDER.includes(deviceType) || deviceName.includes('feeder') || deviceName.includes('fresh')) {
      return 'd4'; // Feeders use d4 endpoint
    } else if (DEVICES_WATER_FOUNTAIN.includes(deviceType) || deviceName.includes('fountain') || deviceName.includes('water')) {
      return 'w5'; // Water fountains use w5 endpoint
    } else if (DEVICES_PURIFIER.includes(deviceType) || deviceName.includes('purifier') || deviceName.includes('air')) {
      return 'k3'; // Air purifiers use k3 endpoint
    }

    // Default fallback - most common types
    if (deviceName.includes('pura') || deviceName.includes('max')) {
      return 't4'; // PURA MAX is a litter box
    }

    // If we can't determine, try the most common one first
    console.log(`[PetKit API] Unknown device type for ${device.deviceName}, defaulting to t4`);
    return 't4';
  }

  _mapDeviceTypeCodeToName(deviceTypeCode) {
    // Simple mapping from API endpoint prefix to device type name
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

  _collectDevices() {
    const deviceList = [];
    for (const account of this.accountData) {
      if (account.deviceList) {
        deviceList.push(...account.deviceList);
      }
    }
    return deviceList;
  }

  _prepareTasks(deviceList) {
    const mainTasks = [];
    const recordTasks = [];
    const liveTasks = [];
    const mediaTasks = [];

    for (const device of deviceList) {
      const deviceType = device.deviceType.toLowerCase();
			if (DEVICES_FEEDER.includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'Feeder'));
        recordTasks.push(this._fetchDeviceData(device, 'FeederRecord'));
        if (FEEDER_WITH_CAMERA.includes(deviceType)) {
          mediaTasks.push(this._fetchMedia(device));
          liveTasks.push(this._fetchDeviceData(device, 'LiveFeed'));
        }
      } else if (DEVICES_LITTER_BOX.includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'Litter'));
        recordTasks.push(this._fetchDeviceData(device, 'LitterRecord'));
        if (LITTER_NO_CAMERA.includes(deviceType)) {
          recordTasks.push(this._fetchDeviceData(device, 'LitterStats'));
        }
        if (LITTER_WITH_CAMERA.includes(deviceType)) {
          recordTasks.push(this._fetchDeviceData(device, 'PetOutGraph'));
          mediaTasks.push(this._fetchMedia(device));
          liveTasks.push(this._fetchDeviceData(device, 'LiveFeed'));
        }
      } else if (DEVICES_WATER_FOUNTAIN.includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'WaterFountain'));
        recordTasks.push(this._fetchDeviceData(device, 'WaterFountainRecord'));
      } else if (DEVICES_PURIFIER.includes(deviceType)) {
        mainTasks.push(this._fetchDeviceData(device, 'Purifier'));
      }
    }

    return { mainTasks, recordTasks, mediaTasks, liveTasks };
  }

  async _executeStatsTasks() {
    const statsTasks = [];
    for (const [deviceId, entity] of this.petkitEntities) {
      if (entity.type === 'Litter') {
        statsTasks.push(this.populatePetStats(entity));
      }
    }
    await Promise.all(statsTasks);
  }

  async _fetchMedia(device) {
    // Placeholder for media fetching logic
    console.log(`Fetching media for device: ${device.deviceId}`);
  }

  async _fetchDeviceData(device, dataClass) {
    const headers = await this.getSessionHeaders();

    // Get device type code for URL (t4, d4, etc.)
    const deviceTypeCode = this._getDeviceTypeCode(device);

    // Get endpoint based on data class
    let endpoint = this._getEndpointForDataClass(dataClass, deviceTypeCode);
    if (!endpoint) {
      console.log(`Endpoint not found for device type: ${deviceTypeCode}, data class: ${dataClass}`);
      return;
    }

    // Get request parameters
    const params = this._getRequestParams(device, dataClass);

    try {
      console.log(`[PetKit API] Fetching ${dataClass} for device ${device.deviceId} via ${deviceTypeCode}/${endpoint}`);

      const response = await this.client.post(
        `${deviceTypeCode}/${endpoint}`,
        new URLSearchParams(params),
        { headers }
      );

      let responseData = response.data && response.data[RES_KEY];
      if (!responseData) {
        console.log(`No data returned for ${deviceTypeCode}/${endpoint}`);
        return;
      }

      // Handle list response for some endpoints
      if (responseData.list) {
        responseData = responseData.list;
      }

      // Process the response data
      this._handleDataResponse(device, responseData, dataClass, deviceTypeCode);

    } catch (error) {
      console.error(`Failed to fetch device data for ${deviceTypeCode}/${endpoint}: ${error.message}`);
    }
  }

  _getEndpointForDataClass(dataClass, deviceType) {
    // Map data classes to endpoints based on device type
    const endpointMap = {
      'Feeder': PETKIT_ENDPOINTS.OWN_DEVICES,
      'Litter': PETKIT_ENDPOINTS.OWN_DEVICES,
      'WaterFountain': PETKIT_ENDPOINTS.OWN_DEVICES,
      'Purifier': PETKIT_ENDPOINTS.OWN_DEVICES,
      'FeederRecord': PETKIT_ENDPOINTS.GET_DEVICE_RECORD,
      'LitterRecord': PETKIT_ENDPOINTS.GET_DEVICE_RECORD,
      'WaterFountainRecord': PETKIT_ENDPOINTS.GET_DEVICE_RECORD,
      'LitterStats': PETKIT_ENDPOINTS.STATISTIC,
      'PetOutGraph': PETKIT_ENDPOINTS.GET_PET_OUT_GRAPH,
      'LiveFeed': PETKIT_ENDPOINTS.LIVE
    };

    return endpointMap[dataClass];
  }

  _getRequestParams(device, dataClass) {
    const deviceId = String(device.deviceId || device.deviceNfo?.deviceId);
    const baseParams = { deviceId };

    // Get current date for date-based endpoints
    const today = new Date();
    const dateStr = today.getFullYear() +
                   String(today.getMonth() + 1).padStart(2, '0') +
                   String(today.getDate()).padStart(2, '0');

    // Add specific parameters based on data class and endpoint requirements
    switch (dataClass) {
      case 'LitterStats':
      case 'statistic':
        return {
          ...baseParams,
          startDate: dateStr,
          endDate: dateStr,
          type: '0' // Default type as string
        };

      case 'FeederRecord':
      case 'LitterRecord':
      case 'WaterFountainRecord':
      case 'getDeviceRecord':
        return {
          date: dateStr,
          deviceId: deviceId
        };

      case 'PetOutGraph':
      case 'getPetOutGraph':
        return {
          ...baseParams,
          startDate: dateStr,
          endDate: dateStr
        };

      case 'LiveFeed':
      case 'start/live':
        return {
          ...baseParams
        };

      default:
        return baseParams;
    }
  }

  _handleDataResponse(device, responseData, dataClass, deviceType) {
    const deviceId = device.deviceId;

    if (dataClass.includes('Record') || dataClass === 'LitterStats' || dataClass === 'PetOutGraph') {
      // Handle record data
      const existingEntity = this.petkitEntities.get(deviceId);
      if (existingEntity) {
        if (dataClass === 'LitterStats') {
          existingEntity.deviceStats = responseData;
        } else if (dataClass === 'PetOutGraph') {
          existingEntity.devicePetGraphOut = responseData;
        } else {
          existingEntity.deviceRecords = responseData;
        }
        this.petkitEntities.set(deviceId, existingEntity);
      }
    } else if (dataClass === 'LiveFeed') {
      // Handle live feed data
      const existingEntity = this.petkitEntities.get(deviceId);
      if (existingEntity) {
        existingEntity.liveFeed = responseData;
        this.petkitEntities.set(deviceId, existingEntity);
      }
    } else {
      // Handle main device data
      const deviceData = {
        ...responseData,
        type: dataClass,
        deviceNfo: device
      };
      this.petkitEntities.set(deviceId, deviceData);
    }
  }

  async populatePetStats(litterData) {
    // Placeholder for pet stats population logic
    console.log(`Populating pet stats for litter: ${litterData.deviceNfo?.deviceId}`);
  }

  async getPetsList() {
    const pets = [];
    for (const [id, entity] of this.petkitEntities) {
      if (entity.type === PET) {
        pets.push(entity);
      }
    }
    return pets;
  }

  async sendApiRequest(deviceId, action, setting = null) {
    const device = this.petkitEntities.get(deviceId);
    if (!device) {
      throw new PetkitAPIError(`Device with ID ${deviceId} not found`);
    }

    if (!device.deviceNfo) {
      throw new PetkitAPIError(`Device with ID ${deviceId} has no device info`);
    }

    const headers = await this.getSessionHeaders();
    const deviceType = device.deviceNfo.deviceType;

    try {
      let endpoint, params;

      // Map actions to endpoints and parameters based on device type
      switch (action) {
        case 'manual_feed':
          endpoint = 'saveDailyFeed';
          params = { id: deviceId, amount: setting?.amount || 1 };
          break;
        case 'start_clean':
          // For litter boxes
          endpoint = 'controlDevice';
          params = { id: deviceId, cmd: 0 }; // 0 = start cleaning
          break;
        case 'set_fountain_mode':
          // For water fountains
          endpoint = 'controlDevice';
          params = { id: deviceId, cmd: setting?.mode || 0 };
          break;
        case 'set_purifier_mode':
          // For air purifiers
          endpoint = 'controlDevice';
          params = { id: deviceId, cmd: setting?.mode || 0 };
          break;
        case 'control_device':
          endpoint = 'controlDevice';
          params = { id: deviceId, ...setting };
          break;
        default:
          throw new PetkitAPIError(`Action ${action} not supported for device type ${deviceType}`);
      }

      console.log(`[PetKit API] Sending command ${action} to device ${deviceId} (${deviceType})`);

      const response = await this.client.post(
        `${deviceType}/${endpoint}`,
        new URLSearchParams(params),
        { headers }
      );

      return response.data && response.data[RES_KEY];
    } catch (error) {
      throw new PetkitAPIError(`Failed to send command: ${error.message}`);
    }
  }

  // Convenience methods
  async getDevices() {
    await this.getDevicesData();
		return Array.from(this.petkitEntities.values()).filter(entity => entity.deviceNfo);
  }

  async getDeviceStatus(deviceId) {
    const device = this.petkitEntities.get(deviceId);
    if (!device) {
      throw new PetkitAPIError(`Device ${deviceId} not found`);
    }
    return device;
  }

  async feedManual(deviceId, amount = 1) {
    return this.sendApiRequest(deviceId, 'manual_feed', { amount });
  }

  async startCleaning(deviceId) {
    return this.sendApiRequest(deviceId, 'start_clean');
  }

  isLoggedIn() {
    return !!this._session;
  }

  logout() {
    this._session = null;
    delete this.client.defaults.headers['F-Session'];
    delete this.client.defaults.headers['X-Session'];
    delete this.client.defaults.baseURL;
  }
}

module.exports = PetKitClient;
