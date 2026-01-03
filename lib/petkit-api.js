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

// Commands - matching Python implementation
const DeviceCommand = {
  POWER: 'power_device',
  CONTROL_DEVICE: 'control_device',
  UPDATE_SETTING: 'update_setting'
};

const FeederCommand = {
  CALL_PET: 'call_pet',
  CALIBRATION: 'food_reset',
  MANUAL_FEED: 'manual_feed',
  MANUAL_FEED_DUAL: 'manual_feed_dual',
  CANCEL_MANUAL_FEED: 'cancelRealtimeFeed',
  FOOD_REPLENISHED: 'food_replenished',
  RESET_DESICCANT: 'desiccant_reset',
  REMOVE_DAILY_FEED: 'remove_daily_feed',
  RESTORE_DAILY_FEED: 'restore_daily_feed'
};

const LitterCommand = {
  RESET_N50_DEODORIZER: 'reset_deodorizer'
};

const PetCommand = {
  PET_UPDATE_SETTING: 'pet_update_setting'
};

// Litter box action commands (integer values)
const LBCommand = {
  CLEANING: 0,
  DUMPING: 1,
  ODOR_REMOVAL: 2,
  RESETTING: 3,
  LEVELING: 4,
  CALIBRATING: 5,
  RESET_DEODOR: 6,
  LIGHT: 7,
  RESET_N50_DEODOR: 8,
  MAINTENANCE: 9,
  RESET_N60_DEODOR: 10
};

// Purifier working modes
const PurMode = {
  AUTO_MODE: 0,
  SILENT_MODE: 1,
  STANDARD_MODE: 2,
  STRONG_MODE: 3
};

// Device actions (for litter box and purifier)
const DeviceAction = {
  CONTINUE: 'continue_action',
  END: 'end_action',
  START: 'start_action',
  STOP: 'stop_action',
  MODE: 'mode_action', // Purifier K2 only
  POWER: 'power_action'
};

// Water fountain actions
const FountainAction = {
  MODE_NORMAL: 'Normal',
  MODE_SMART: 'Smart',
  MODE_STANDARD: 'Standard',
  MODE_INTERMITTENT: 'Intermittent',
  PAUSE: 'Pause',
  CONTINUE: 'Continue',
  POWER_OFF: 'Power Off',
  POWER_ON: 'Power On',
  RESET_FILTER: 'Reset Filter',
  DO_NOT_DISTURB: 'Do Not Disturb',
  DO_NOT_DISTURB_OFF: 'Do Not Disturb Off',
  LIGHT_LOW: 'Light Low',
  LIGHT_MEDIUM: 'Light Medium',
  LIGHT_HIGH: 'Light High',
  LIGHT_ON: 'Light On',
  LIGHT_OFF: 'Light Off'
};

// Fountain BLE command bytes
const FOUNTAIN_COMMAND = {
  [FountainAction.PAUSE]: [220, 1, 3, 0, 1, 0, 2],
  [FountainAction.CONTINUE]: [220, 1, 3, 0, 1, 1, 2],
  [FountainAction.RESET_FILTER]: [222, 1, 0, 0],
  [FountainAction.POWER_OFF]: [220, 1, 3, 0, 0, 1, 1],
  [FountainAction.POWER_ON]: [220, 1, 3, 0, 1, 1, 1]
};

// Helper functions for dynamic endpoint selection
const getEndpointManualFeed = (deviceType) => {
  return [FEEDER, FEEDER_MINI].includes(deviceType) ? 'saveDailyFeed' : 'save_dailyfeed';
};

const getEndpointCancelManualFeed = (deviceType) => {
  return [FEEDER, FEEDER_MINI].includes(deviceType) ? 'removeDailyFeed' : 'cancel_realtime_feed';
};

const getEndpointResetDesiccant = (deviceType) => {
  return [FEEDER, FEEDER_MINI].includes(deviceType) ? 'desiccantReset' : 'desiccant_reset';
};

const getEndpointUpdateSetting = (deviceType) => {
  return [FEEDER_MINI, K3].includes(deviceType) ? 'saveSetting' : 'update_settings';
};

// Helper to get current date as YYYYMMDD
const getCurrentDateStr = () => {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
};

// Actions map - maps action to endpoint and parameter generation
const ACTIONS_MAP = {
  // Device commands
  [DeviceCommand.UPDATE_SETTING]: {
    getEndpoint: getEndpointUpdateSetting,
    getParams: (device, setting) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify(setting)
    }),
    supportedDevices: [...DEVICES_FEEDER, ...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER, ...DEVICES_WATER_FOUNTAIN]
  },
  [DeviceCommand.CONTROL_DEVICE]: {
    endpoint: 'controlDevice',
    getParams: (device, command) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify(command),
      type: Object.keys(command)[0]?.split('_')[0] || ''
    }),
    supportedDevices: [K2, K3, T3, T4, T5, T6, T7]
  },

  // Feeder commands
  [FeederCommand.MANUAL_FEED]: {
    getEndpoint: getEndpointManualFeed,
    getParams: (device, setting) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      name: '',
      time: '-1',
      ...(setting || {})
    }),
    supportedDevices: DEVICES_FEEDER
  },
  [FeederCommand.MANUAL_FEED_DUAL]: {
    endpoint: 'save_dailyfeed',
    getParams: (device, setting) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      name: '',
      time: '-1',
      amount1: setting?.amount1 || 1,
      amount2: setting?.amount2 || 1
    }),
    supportedDevices: [D4S, D4SH]
  },
  [FeederCommand.CANCEL_MANUAL_FEED]: {
    getEndpoint: getEndpointCancelManualFeed,
    getParams: (device) => {
      const deviceType = device.deviceNfo.deviceType.toLowerCase();
      const params = {
        deviceId: device.deviceNfo.deviceId,
        day: getCurrentDateStr()
      };
      // D4H, D4S, D4SH need the manual_feed_id
      if ([D4H, D4S, D4SH].includes(deviceType) && device.manualFeedId) {
        params.id = device.manualFeedId;
      }
      return params;
    },
    supportedDevices: DEVICES_FEEDER
  },
  [FeederCommand.RESET_DESICCANT]: {
    getEndpoint: getEndpointResetDesiccant,
    getParams: (device) => ({ deviceId: device.deviceNfo.deviceId }),
    supportedDevices: DEVICES_FEEDER
  },
  [FeederCommand.REMOVE_DAILY_FEED]: {
    endpoint: 'remove_dailyfeed',
    getParams: (device, setting) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      ...(setting || {})
    }),
    supportedDevices: DEVICES_FEEDER
  },
  [FeederCommand.RESTORE_DAILY_FEED]: {
    endpoint: 'restore_dailyfeed',
    getParams: (device, setting) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      ...(setting || {})
    }),
    supportedDevices: DEVICES_FEEDER
  },
  [FeederCommand.FOOD_REPLENISHED]: {
    endpoint: 'food_replenished',
    getParams: (device) => ({
      deviceId: device.deviceNfo.deviceId,
      noRemind: '3'
    }),
    supportedDevices: [D4H, D4S, D4SH]
  },
  [FeederCommand.CALIBRATION]: {
    endpoint: 'food_reset',
    getParams: (device, setting) => ({
      deviceId: device.deviceNfo.deviceId,
      action: setting?.action || 0
    }),
    supportedDevices: [FEEDER]
  },
  [FeederCommand.CALL_PET]: {
    endpoint: 'call_pet',
    getParams: (device) => ({ deviceId: device.deviceNfo.deviceId }),
    supportedDevices: [D3]
  },

  // Litter commands
  [LitterCommand.RESET_N50_DEODORIZER]: {
    endpoint: 'deodorizer_reset',
    getParams: (device) => ({ deviceId: device.deviceNfo.deviceId }),
    supportedDevices: [T4, T5, T6]
  },

  // Pet commands
  [PetCommand.PET_UPDATE_SETTING]: {
    endpoint: 'updatePet',
    getParams: (device, setting) => ({
      petId: device.deviceNfo.deviceId,
      kv: JSON.stringify(setting)
    }),
    supportedDevices: [PET]
  },

  // Device actions (litter box / purifier)
  // Format: kv = {"action_name": value}, type = "action" (first part before underscore)
  [DeviceAction.START]: {
    endpoint: 'controlDevice',
    getParams: (device, setting) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.START]: setting?.cmd ?? LBCommand.CLEANING }),
      type: 'start'
    }),
    supportedDevices: [...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER]
  },
  [DeviceAction.STOP]: {
    endpoint: 'controlDevice',
    getParams: (device) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.STOP]: LBCommand.RESETTING }),
      type: 'stop'
    }),
    supportedDevices: DEVICES_LITTER_BOX
  },
  [DeviceAction.CONTINUE]: {
    endpoint: 'controlDevice',
    getParams: (device) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.CONTINUE]: 1 }),
      type: 'continue'
    }),
    supportedDevices: [...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER]
  },
  [DeviceAction.END]: {
    endpoint: 'controlDevice',
    getParams: (device) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.END]: 1 }),
      type: 'end'
    }),
    supportedDevices: [...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER]
  },
  [DeviceAction.POWER]: {
    endpoint: 'controlDevice',
    getParams: (device, setting) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.POWER]: setting?.power ? 1 : 0 }),
      type: 'power'
    }),
    supportedDevices: DEVICES_PURIFIER
  },
  [DeviceAction.MODE]: {
    endpoint: 'controlDevice',
    getParams: (device, setting) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.MODE]: setting?.mode ?? PurMode.AUTO_MODE }),
      type: 'mode'
    }),
    supportedDevices: [K2]
  }
};

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

    const deviceType = device.deviceNfo.deviceType.toLowerCase();

    // Check if action exists in ACTIONS_MAP
    const actionConfig = ACTIONS_MAP[action];
    if (!actionConfig) {
      throw new PetkitAPIError(`Action '${action}' is not supported`);
    }

    // Check if device type supports this action
    if (!actionConfig.supportedDevices.includes(deviceType)) {
      throw new PetkitAPIError(
        `Action '${action}' is not supported for device type '${deviceType}'. ` +
        `Supported devices: ${actionConfig.supportedDevices.join(', ')}`
      );
    }

    const headers = await this.getSessionHeaders();

    // Get endpoint (can be static or dynamic based on device type)
    const endpoint = actionConfig.getEndpoint
      ? actionConfig.getEndpoint(deviceType)
      : actionConfig.endpoint;

    // Get parameters using the params function
    const params = actionConfig.getParams(device, setting);

    try {
      console.log(`[PetKit API] Sending command '${action}' to device ${deviceId} (${deviceType})`);
      console.log(`[PetKit API] Endpoint: ${deviceType}/${endpoint}`);
      console.log(`[PetKit API] Params:`, params);

      const response = await this.client.post(
        `${deviceType}/${endpoint}`,
        new URLSearchParams(params),
        { headers }
      );

      return response.data && response.data[RES_KEY];
    } catch (error) {
      throw new PetkitAPIError(`Failed to send command '${action}': ${error.message}`);
    }
  }

  // Convenience methods
  async getDevices() {
    await this.getDevicesData();
		return Array.from(this.petkitEntities.values()).filter(entity => entity.deviceNfo);
  }

  async getDeviceStatus(deviceId) {
		await this.getDevicesData();
    const device = this.petkitEntities.get(deviceId);
		if (!device) {
      throw new PetkitAPIError(`Device ${deviceId} not found`);
    }
    return device;
  }

  async getLitterStatus(deviceId) {
    const device = await this.getDeviceStatus(deviceId);
    return {
      litterLevel: device.sandPercent ?? device.sand_percent ?? 0,
      wasteLevel: device.box ?? 0,
      batteryLevel: device.battery ?? 100,
      _raw: device
    };
  }

  async getFeederStatus(deviceId) {
    const device = await this.getDeviceStatus(deviceId);
    return {
      batteryLevel: device.batteryPower ?? device.battery_power ?? device.battery ?? 0,
      foodLevel: device.food ?? device.food1 ?? 0,
      _raw: device
    };
  }

  async getFountainStatus(deviceId) {
    const device = await this.getDeviceStatus(deviceId);
    return {
      waterLevel: device.filterPercent ?? device.filter_percent ?? 100,
      filterLife: device.filterPercent ?? device.filter_percent ?? 100,
      pumpRunning: device.runStatus === 1 || device.run_status === 1 || false,
      mode: (device.mode ?? 0).toString(),
      _raw: device
    };
  }

  async getPurifierStatus(deviceId) {
    const device = await this.getDeviceStatus(deviceId);
    const state = device.rawDevice?.state || device;
    return {
      airQuality: state.humidity ?? 0,
      filterLife: state.leftDay ?? state.left_day ?? 100,
      mode: state.mode ?? 0,
      fanSpeed: state.refresh ?? 1,
      _raw: device
    };
  }

  // Feeder actions
  async feedManual(deviceId, amount = 1) {
    return this.sendApiRequest(deviceId, FeederCommand.MANUAL_FEED, { amount });
  }

  async feedManualDual(deviceId, amount1 = 1, amount2 = 1) {
    return this.sendApiRequest(deviceId, FeederCommand.MANUAL_FEED_DUAL, { amount1, amount2 });
  }

  async cancelManualFeed(deviceId) {
    return this.sendApiRequest(deviceId, FeederCommand.CANCEL_MANUAL_FEED);
  }

  async resetDesiccant(deviceId) {
    return this.sendApiRequest(deviceId, FeederCommand.RESET_DESICCANT);
  }

  async foodReplenished(deviceId) {
    return this.sendApiRequest(deviceId, FeederCommand.FOOD_REPLENISHED);
  }

  async calibrateFeeder(deviceId) {
    return this.sendApiRequest(deviceId, FeederCommand.CALIBRATION);
  }

  async callPet(deviceId) {
    return this.sendApiRequest(deviceId, FeederCommand.CALL_PET);
  }

  async removeDailyFeed(deviceId, feedId) {
    return this.sendApiRequest(deviceId, FeederCommand.REMOVE_DAILY_FEED, { feedId });
  }

  async restoreDailyFeed(deviceId, feedId) {
    return this.sendApiRequest(deviceId, FeederCommand.RESTORE_DAILY_FEED, { feedId });
  }

  // Litter box actions
  async startCleaning(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.CLEANING });
  }

  async startDumping(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.DUMPING });
  }

  async startOdorRemoval(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.ODOR_REMOVAL });
  }

  async stopLitterAction(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.STOP);
  }

  async resetN50Deodorizer(deviceId) {
    return this.sendApiRequest(deviceId, LitterCommand.RESET_N50_DEODORIZER);
  }

  async toggleLitterLight(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.LIGHT });
  }

  async startMaintenance(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.MAINTENANCE });
  }

  async levelLitter(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.LEVELING });
  }

  async calibrateLitter(deviceId) {
    return this.sendApiRequest(deviceId, DeviceAction.START, { cmd: LBCommand.CALIBRATING });
  }

  // Purifier actions
  async setPurifierMode(deviceId, mode) {
    return this.sendApiRequest(deviceId, DeviceAction.MODE, { mode });
  }

  async powerPurifier(deviceId, power) {
    return this.sendApiRequest(deviceId, DeviceAction.POWER, { power });
  }

  // Water fountain actions
  async setFountainMode(deviceId, mode) {
    // Water fountains use settings update for mode changes
    return this.sendApiRequest(deviceId, DeviceCommand.UPDATE_SETTING, { mode });
  }

  // General device actions
  async updateDeviceSetting(deviceId, settings) {
    return this.sendApiRequest(deviceId, DeviceCommand.UPDATE_SETTING, settings);
  }

  async controlDevice(deviceId, settings) {
    return this.sendApiRequest(deviceId, DeviceCommand.CONTROL_DEVICE, settings);
  }

  // Pet actions
  async updatePetSetting(petId, settings) {
    return this.sendApiRequest(petId, PetCommand.PET_UPDATE_SETTING, settings);
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

// Export constants for external use
module.exports = {
  PetKitClient,
  // Device types
  FEEDER, FEEDER_MINI, D3, D4, D4S, D4H, D4SH,
  T3, T4, T5, T6, T7,
  W4, W5, CTW2, CTW3,
  K2, K3,
  PET,
  // Device groups
  DEVICES_FEEDER, DEVICES_LITTER_BOX, DEVICES_WATER_FOUNTAIN, DEVICES_PURIFIER,
  // Commands
  DeviceCommand, FeederCommand, LitterCommand, PetCommand,
  // Actions
  DeviceAction, FountainAction,
  // Command values
  LBCommand, PurMode,
  // Errors
  PetkitAPIError, PetkitAuthenticationError, PetkitSessionExpiredError,
  PetkitServerBusyError, PetkitRegionalServerNotFoundError
};
