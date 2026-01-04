/**
 * Constants, enums, and configuration for the PetKit API
 */

import type { ActionConfig, DeviceEntity } from './types.mjs';

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_COUNTRY = 'DE';
export const DEFAULT_TZ = 'Europe/Berlin';

export const RES_KEY = 'result';
export const ERR_KEY = 'error';

// ============================================================================
// Device Type Enum
// ============================================================================

export enum DeviceType {
  FEEDER = 'feeder',
  FEEDER_MINI = 'feedermini',
  D3 = 'd3',
  D4 = 'd4',
  D4S = 'd4s',
  D4H = 'd4h',
  D4SH = 'd4sh',
  T3 = 't3',
  T4 = 't4',
  T5 = 't5',
  T6 = 't6',
  T7 = 't7',
  W4 = 'w4',
  W5 = 'w5',
  CTW2 = 'ctw2',
  CTW3 = 'ctw3',
  K2 = 'k2',
  K3 = 'k3',
  PET = 'pet',
}

// ============================================================================
// Device Groups
// ============================================================================

export const DEVICES_LITTER_BOX = [
  DeviceType.T3,
  DeviceType.T4,
  DeviceType.T5,
  DeviceType.T6,
  DeviceType.T7,
] as const;

export const LITTER_WITH_CAMERA = [
  DeviceType.T5,
  DeviceType.T6,
  DeviceType.T7,
] as const;

export const LITTER_NO_CAMERA = [
  DeviceType.T3,
  DeviceType.T4,
] as const;

export const FEEDER_WITH_CAMERA = [
  DeviceType.D4H,
  DeviceType.D4SH,
] as const;

export const DEVICES_FEEDER = [
  DeviceType.FEEDER,
  DeviceType.FEEDER_MINI,
  DeviceType.D3,
  DeviceType.D4,
  DeviceType.D4S,
  DeviceType.D4H,
  DeviceType.D4SH,
] as const;

export const DEVICES_WATER_FOUNTAIN = [
  DeviceType.W4,
  DeviceType.W5,
  DeviceType.CTW2,
  DeviceType.CTW3,
] as const;

export const DEVICES_PURIFIER = [
  DeviceType.K2,
  DeviceType.K3,
] as const;

// ============================================================================
// Command Enums
// ============================================================================

export enum DeviceCommand {
  POWER = 'power_device',
  CONTROL_DEVICE = 'control_device',
  UPDATE_SETTING = 'update_setting',
}

export enum FeederCommand {
  CALL_PET = 'call_pet',
  CALIBRATION = 'food_reset',
  MANUAL_FEED = 'manual_feed',
  MANUAL_FEED_DUAL = 'manual_feed_dual',
  CANCEL_MANUAL_FEED = 'cancelRealtimeFeed',
  FOOD_REPLENISHED = 'food_replenished',
  RESET_DESICCANT = 'desiccant_reset',
  REMOVE_DAILY_FEED = 'remove_daily_feed',
  RESTORE_DAILY_FEED = 'restore_daily_feed',
}

export enum LitterCommand {
  RESET_N50_DEODORIZER = 'reset_deodorizer',
}

export enum PetCommand {
  PET_UPDATE_SETTING = 'pet_update_setting',
}

// ============================================================================
// Litter Box Commands (numeric)
// ============================================================================

export enum LBCommand {
  CLEANING = 0,
  DUMPING = 1,
  ODOR_REMOVAL = 2,
  RESETTING = 3,
  LEVELING = 4,
  CALIBRATING = 5,
  RESET_DEODOR = 6,
  LIGHT = 7,
  RESET_N50_DEODOR = 8,
  MAINTENANCE = 9,
  RESET_N60_DEODOR = 10,
}

// ============================================================================
// Purifier Modes
// ============================================================================

export enum PurMode {
  AUTO_MODE = 0,
  SILENT_MODE = 1,
  STANDARD_MODE = 2,
  STRONG_MODE = 3,
}

// ============================================================================
// Device Actions
// ============================================================================

export enum DeviceAction {
  CONTINUE = 'continue_action',
  END = 'end_action',
  START = 'start_action',
  STOP = 'stop_action',
  MODE = 'mode_action',
  POWER = 'power_action',
}

// ============================================================================
// Fountain Actions
// ============================================================================

export enum FountainAction {
  MODE_NORMAL = 'Normal',
  MODE_SMART = 'Smart',
  MODE_STANDARD = 'Standard',
  MODE_INTERMITTENT = 'Intermittent',
  PAUSE = 'Pause',
  CONTINUE = 'Continue',
  POWER_OFF = 'Power Off',
  POWER_ON = 'Power On',
  RESET_FILTER = 'Reset Filter',
  DO_NOT_DISTURB = 'Do Not Disturb',
  DO_NOT_DISTURB_OFF = 'Do Not Disturb Off',
  LIGHT_LOW = 'Light Low',
  LIGHT_MEDIUM = 'Light Medium',
  LIGHT_HIGH = 'Light High',
  LIGHT_ON = 'Light On',
  LIGHT_OFF = 'Light Off',
}

// ============================================================================
// Fountain BLE Command Bytes
// ============================================================================

export const FOUNTAIN_COMMAND: Record<FountainAction, number[]> = {
  [FountainAction.PAUSE]: [220, 1, 3, 0, 1, 0, 2],
  [FountainAction.CONTINUE]: [220, 1, 3, 0, 1, 1, 2],
  [FountainAction.RESET_FILTER]: [222, 1, 0, 0],
  [FountainAction.POWER_OFF]: [220, 1, 3, 0, 0, 1, 1],
  [FountainAction.POWER_ON]: [220, 1, 3, 0, 1, 1, 1],
  // Actions without BLE commands
  [FountainAction.MODE_NORMAL]: [],
  [FountainAction.MODE_SMART]: [],
  [FountainAction.MODE_STANDARD]: [],
  [FountainAction.MODE_INTERMITTENT]: [],
  [FountainAction.DO_NOT_DISTURB]: [],
  [FountainAction.DO_NOT_DISTURB_OFF]: [],
  [FountainAction.LIGHT_LOW]: [],
  [FountainAction.LIGHT_MEDIUM]: [],
  [FountainAction.LIGHT_HIGH]: [],
  [FountainAction.LIGHT_ON]: [],
  [FountainAction.LIGHT_OFF]: [],
};

// ============================================================================
// PetKit Domains
// ============================================================================

export enum PetkitDomain {
  PASSPORT_PETKIT = 'https://passport.petkt.com/',
  CHINA_SRV = 'https://api.petkit.cn/6/',
}

// ============================================================================
// PetKit Endpoints
// ============================================================================

export enum PetkitEndpoint {
  REGION_SERVERS = 'v1/regionservers',
  LOGIN = 'user/login',
  GET_LOGIN_CODE = 'user/sendcodeforquicklogin',
  REFRESH_SESSION = 'user/refreshsession',
  DETAILS = 'user/details2',
  FAMILY_LIST = 'group/family/list',
  DEVICE_DETAIL = 'device_detail',
  OWN_DEVICES = 'owndevices',
  GET_DEVICE_RECORD = 'getDeviceRecord',
  CONTROL_DEVICE = 'controlDevice',
  STATISTIC = 'statistic',
  GET_PET_OUT_GRAPH = 'getPetOutGraph',
  LIVE = 'start/live',
  CLOUD_VIDEO = 'cloud/video',
}

// ============================================================================
// HTTP Headers
// ============================================================================

export const HEADERS = {
  ACCEPT: '*/*',
  ACCEPT_LANG: 'en-US;q=1, it-US;q=0.9',
  ENCODING: 'gzip, deflate',
  API_VERSION: '12.6.0',
  CONTENT_TYPE: 'application/x-www-form-urlencoded',
  AGENT: 'okhttp/3.14.19',
  CLIENT: 'android(15.1;23127PN0CG)',
  LOCALE: 'en-US',
  IMG_VERSION: '1',
  HOUR: '24',
} as const;

// ============================================================================
// Client Info
// ============================================================================

export const CLIENT_NFO = {
  locale: HEADERS.LOCALE,
  name: '23127PN0CG',
  osVersion: '15.1',
  phoneBrand: 'Xiaomi',
  platform: 'android',
  source: 'app.petkit-android',
  version: HEADERS.API_VERSION,
} as const;

export const LOGIN_DATA = {
  oldVersion: HEADERS.API_VERSION,
} as const;

// ============================================================================
// Helper Functions for Dynamic Endpoints
// ============================================================================

export const getEndpointManualFeed = (deviceType: string): string => {
  return [DeviceType.FEEDER, DeviceType.FEEDER_MINI].includes(deviceType as DeviceType)
    ? 'saveDailyFeed'
    : 'save_dailyfeed';
};

export const getEndpointCancelManualFeed = (deviceType: string): string => {
  return [DeviceType.FEEDER, DeviceType.FEEDER_MINI].includes(deviceType as DeviceType)
    ? 'removeDailyFeed'
    : 'cancel_realtime_feed';
};

export const getEndpointResetDesiccant = (deviceType: string): string => {
  return [DeviceType.FEEDER, DeviceType.FEEDER_MINI].includes(deviceType as DeviceType)
    ? 'desiccantReset'
    : 'desiccant_reset';
};

export const getEndpointUpdateSetting = (deviceType: string): string => {
  return [DeviceType.FEEDER_MINI, DeviceType.K3].includes(deviceType as DeviceType)
    ? 'saveSetting'
    : 'update_settings';
};

// ============================================================================
// Helper to Get Current Date as YYYYMMDD
// ============================================================================

export const getCurrentDateStr = (): string => {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  );
};

// ============================================================================
// Actions Map
// ============================================================================

export const ACTIONS_MAP: Record<string, ActionConfig> = {
  // Device commands
  [DeviceCommand.UPDATE_SETTING]: {
    getEndpoint: getEndpointUpdateSetting,
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify(setting),
    }),
    supportedDevices: [...DEVICES_FEEDER, ...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER, ...DEVICES_WATER_FOUNTAIN],
  },
  [DeviceCommand.CONTROL_DEVICE]: {
    endpoint: 'controlDevice',
    getParams: (device: DeviceEntity, command?: Record<string, unknown>) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify(command),
      type: Object.keys(command || {})[0]?.split('_')[0] || '',
    }),
    supportedDevices: [DeviceType.K2, DeviceType.K3, DeviceType.T3, DeviceType.T4, DeviceType.T5, DeviceType.T6, DeviceType.T7],
  },

  // Feeder commands
  [FeederCommand.MANUAL_FEED]: {
    getEndpoint: getEndpointManualFeed,
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      name: '',
      time: '-1',
      ...(setting || {}),
    }),
    supportedDevices: DEVICES_FEEDER,
  },
  [FeederCommand.MANUAL_FEED_DUAL]: {
    endpoint: 'save_dailyfeed',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      name: '',
      time: '-1',
      amount1: (setting as { amount1?: number })?.amount1 || 1,
      amount2: (setting as { amount2?: number })?.amount2 || 1,
    }),
    supportedDevices: [DeviceType.D4S, DeviceType.D4SH],
  },
  [FeederCommand.CANCEL_MANUAL_FEED]: {
    getEndpoint: getEndpointCancelManualFeed,
    getParams: (device: DeviceEntity) => {
      const deviceType = device.deviceNfo.deviceType.toLowerCase();
      const params: Record<string, unknown> = {
        deviceId: device.deviceNfo.deviceId,
        day: getCurrentDateStr(),
      };
      // D4H, D4S, D4SH need the manual_feed_id
      if ([DeviceType.D4H, DeviceType.D4S, DeviceType.D4SH].includes(deviceType as DeviceType) && device.manualFeedId) {
        params.id = device.manualFeedId;
      }
      return params;
    },
    supportedDevices: DEVICES_FEEDER,
  },
  [FeederCommand.RESET_DESICCANT]: {
    getEndpoint: getEndpointResetDesiccant,
    getParams: (device: DeviceEntity) => ({ deviceId: device.deviceNfo.deviceId }),
    supportedDevices: DEVICES_FEEDER,
  },
  [FeederCommand.REMOVE_DAILY_FEED]: {
    endpoint: 'remove_dailyfeed',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      ...(setting || {}),
    }),
    supportedDevices: DEVICES_FEEDER,
  },
  [FeederCommand.RESTORE_DAILY_FEED]: {
    endpoint: 'restore_dailyfeed',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      deviceId: device.deviceNfo.deviceId,
      day: getCurrentDateStr(),
      ...(setting || {}),
    }),
    supportedDevices: DEVICES_FEEDER,
  },
  [FeederCommand.FOOD_REPLENISHED]: {
    endpoint: 'food_replenished',
    getParams: (device: DeviceEntity) => ({
      deviceId: device.deviceNfo.deviceId,
      noRemind: '3',
    }),
    supportedDevices: [DeviceType.D4H, DeviceType.D4S, DeviceType.D4SH],
  },
  [FeederCommand.CALIBRATION]: {
    endpoint: 'food_reset',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      deviceId: device.deviceNfo.deviceId,
      action: (setting as { action?: number })?.action || 0,
    }),
    supportedDevices: [DeviceType.FEEDER],
  },
  [FeederCommand.CALL_PET]: {
    endpoint: 'call_pet',
    getParams: (device: DeviceEntity) => ({ deviceId: device.deviceNfo.deviceId }),
    supportedDevices: [DeviceType.D3],
  },

  // Litter commands
  [LitterCommand.RESET_N50_DEODORIZER]: {
    endpoint: 'deodorizer_reset',
    getParams: (device: DeviceEntity) => ({ deviceId: device.deviceNfo.deviceId }),
    supportedDevices: [DeviceType.T4, DeviceType.T5, DeviceType.T6],
  },

  // Pet commands
  [PetCommand.PET_UPDATE_SETTING]: {
    endpoint: 'updatePet',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      petId: device.deviceNfo.deviceId,
      kv: JSON.stringify(setting),
    }),
    supportedDevices: [DeviceType.PET],
  },

  // Device actions (litter box / purifier)
  [DeviceAction.START]: {
    endpoint: 'controlDevice',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.START]: (setting as { cmd?: number })?.cmd ?? LBCommand.CLEANING }),
      type: 'start',
    }),
    supportedDevices: [...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER],
  },
  [DeviceAction.STOP]: {
    endpoint: 'controlDevice',
    getParams: (device: DeviceEntity) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.STOP]: LBCommand.RESETTING }),
      type: 'stop',
    }),
    supportedDevices: DEVICES_LITTER_BOX,
  },
  [DeviceAction.CONTINUE]: {
    endpoint: 'controlDevice',
    getParams: (device: DeviceEntity) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.CONTINUE]: 1 }),
      type: 'continue',
    }),
    supportedDevices: [...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER],
  },
  [DeviceAction.END]: {
    endpoint: 'controlDevice',
    getParams: (device: DeviceEntity) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.END]: 1 }),
      type: 'end',
    }),
    supportedDevices: [...DEVICES_LITTER_BOX, ...DEVICES_PURIFIER],
  },
  [DeviceAction.POWER]: {
    endpoint: 'controlDevice',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.POWER]: (setting as { power?: boolean })?.power ? 1 : 0 }),
      type: 'power',
    }),
    supportedDevices: DEVICES_PURIFIER,
  },
  [DeviceAction.MODE]: {
    endpoint: 'controlDevice',
    getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => ({
      id: device.deviceNfo.deviceId,
      kv: JSON.stringify({ [DeviceAction.MODE]: (setting as { mode?: number })?.mode ?? PurMode.AUTO_MODE }),
      type: 'mode',
    }),
    supportedDevices: [DeviceType.K2],
  },
};

// ============================================================================
// Device record event types enum
// ============================================================================

export enum DeviceRecordType {
  PET_OUT = 'pet_out',
  SPRAY_OVER = 'spray_over',
  CLEAN_OVER = 'clean_over',
}
