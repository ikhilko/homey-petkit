/**
 * TypeScript type definitions for the PetKit API
 */

// ============================================================================
// Client Configuration Types
// ============================================================================

import { DeviceRecordType } from "./constants.mjs";

/**
 * Options for creating a PetKitClient instance
 */
export interface PetKitClientOptions {
  username: string;
  password: string;
  region?: string;
  timezone?: string;
}

/**
 * Session data returned after successful login
 */
export interface Session {
  id: string;
  userId: number;
  expiresIn: number;
  region: string;
  createdAt: string;
  refreshedAt?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  result?: T;
  error?: ApiError;
}

/**
 * API error structure
 */
export interface ApiError {
  code: number;
  msg: string;
}

/**
 * Region server information
 */
export interface RegionServer {
  id: string;
  name: string;
  gateway: string;
}

/**
 * Region servers response
 */
export interface RegionServersResponse {
  list: RegionServer[];
}

/**
 * Login response structure
 */
export interface LoginResponse {
  session: {
    id: string;
    userId: number;
    expiresIn: number;
    region: string;
    createdAt: string;
  };
}

// ============================================================================
// Device Types
// ============================================================================

/**
 * Device information (deviceNfo)
 */
export interface DeviceNfo {
  deviceType: string;
  deviceId: number;
  createdAt?: string;
  deviceName: string;
  mac?: string;
  sn?: string;
  hardware?: number;
  firmware?: string;
  timezone?: string;
  locale?: string;
  typeCode?: number;
  familyId?: number;
  groupId?: number;
  type?: number;
  uniqueId?: string;
}

/**
 * Basic device from family list
 */
export interface BasicDevice {
  deviceId: number;
  deviceName?: string;
  deviceType?: string;
}

/**
 * Detailed device state
 */
export interface DeviceState {
  // Common state properties
  pim?: number;
  power?: number;
  wifi?: {
    ssid?: string;
    rssi?: number;
  };

  // Feeder-specific
  batteryPower?: number;
  battery_power?: number;
  battery?: number;
  food?: number;
  food1?: number;
  food2?: number;
  desiccantLeftDays?: number;

  // Litter box-specific
  sandPercent?: number;
  sand_percent?: number;
  box?: number;
  boxFull?: boolean;
  liquid?: number;
  liquidEmpty?: boolean;
  deodorantLeftDays?: number;
  litterType?: number;
  workState?: {
    workMode?: number;
    workProcess?: number;
    workReason?: number;
  };

  // Water fountain-specific
  filterPercent?: number;
  filter_percent?: number;
  runStatus?: number;
  run_status?: number;
  mode?: number;
  ledMode?: number;

  // Purifier-specific
  humidity?: number;
  leftDay?: number;
  left_day?: number;
  refresh?: number;
  airQuality?: number;

  // Generic
  [key: string]: unknown;
}

/**
 * Device settings
 */
export interface DeviceSettings {
  autoWork?: number;
  fixedTime?: number;
  downpos?: number;
  sandType?: number;
  manualLock?: number;
  lightMode?: number;
  lightRange?: [number, number];
  autoClean?: number;
  autoOdor?: number;
  stillTime?: number;
  unit?: number;
  [key: string]: unknown;
}

/**
 * Device entity - the main device object stored in petkitEntities
 */
export interface DeviceEntity extends DeviceState {
  type: string;
  deviceNfo: DeviceNfo;
  settings?: DeviceSettings;
  k3Device?: DeviceEntity;
  rawDevice?: RawDevice;
  deviceRecords?: DeviceRecord[];
  deviceStats?: DeviceStatistics;
  devicePetGraphOut?: PetOutGraph;
  liveFeed?: LiveFeedData;
  manualFeedId?: number;
  petDetails?: PetDetails;
}

/**
 * Raw device data from API
 */
export interface RawDevice {
  id: number;
  createdAt: string;
  name: string;
  mac?: string;
  sn?: string;
  hardware?: number;
  firmware?: string;
  timezone?: string;
  locale?: string;
  typeCode?: number;
  familyId?: number;
  state?: DeviceState;
  settings?: DeviceSettings;
  k3Device?: RawDevice;
  [key: string]: unknown;
}

// ============================================================================
// Pet Types
// ============================================================================

/**
 * Pet data from family list
 */
export interface PetData {
  petId: number;
  petName: string;
  sn?: number;
  createdAt?: string;
  avatar?: string;
  gender?: number;
  birthday?: string;
  weight?: number;
  breedId?: number;
  breedName?: string;
  [key: string]: unknown;
}

/**
 * Detailed pet information
 */
export interface PetDetails {
  id: number;
  name?: string;
  gender?: number;
  birthday?: string;
  weight?: number;
  breedId?: number;
  breedName?: string;
  avatar?: string;
  [key: string]: unknown;
}

// ============================================================================
// Account/Family Types
// ============================================================================

/**
 * Account/family data structure
 */
export interface AccountData {
  familyId?: number;
  familyName?: string;
  deviceList?: BasicDevice[];
  petList?: PetData[];
  [key: string]: unknown;
}

// ============================================================================
// Record Types
// ============================================================================

/**
 * Content for pet_out events
 */
export interface PetOutContent {
  timeIn: number;
  timeOut: number;
  autoClear: number;
  interval: number;
  petWeight: number;
}

/**
 * Content for spray_over events
 */
export interface SprayOverContent {
  startTime: number;
  startReason: number;
  result: number;
  liquid: number;
  fromClear: number;
  liquidLack: boolean;
}

/**
 * Content for clean_over events
 */
export interface CleanOverContent {
  startTime?: number;
  startReason?: number;
  result?: number;
  litterPercent: number;
  box: number;
  boxFull: boolean;
}

/**
 * Base device record properties shared by all event types
 */
interface BaseDeviceRecord {
  id?: number;
  deviceId?: number;
  timestamp?: number;
  eventType?: number;
  duration?: number;
  userId?: string;
  petId?: string;
  subContent?: DeviceRecord[];
}

/**
 * Device record (events) - discriminated union based on enumEventType
 */
export type DeviceRecord =
  | (BaseDeviceRecord & {
      enumEventType: 'pet_out';
      content?: PetOutContent;
    })
  | (BaseDeviceRecord & {
      enumEventType: 'spray_over';
      content?: SprayOverContent;
    })
  | (BaseDeviceRecord & {
      enumEventType: 'clean_over';
      content?: CleanOverContent;
    })
  | (BaseDeviceRecord & {
      enumEventType?: DeviceRecordType;
      content?: Record<string, unknown>;
    });

/**
 * Device statistics
 */
export interface DeviceStatistics {
  totalTimes?: number;
  avgDuration?: number;
  [key: string]: unknown;
}

/**
 * Pet out graph data
 */
export interface PetOutGraph {
  petId?: number;
  data?: Array<{
    time?: number;
    duration?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Live feed data
 */
export interface LiveFeedData {
  streamUrl?: string;
  rtmpUrl?: string;
  hlsUrl?: string;
  [key: string]: unknown;
}

// ============================================================================
// Status Types (simplified for capabilities)
// ============================================================================

/**
 * Litter box status
 */
export interface LitterStatus {
  litterLevel: number;
  wasteLevel: number;
  batteryLevel: number;
  _raw: DeviceEntity;
}

/**
 * Feeder status
 */
export interface FeederStatus {
  batteryLevel: number;
  foodLevel: number;
  _raw: DeviceEntity;
}

/**
 * Water fountain status
 */
export interface FountainStatus {
  waterLevel: number;
  filterLife: number;
  pumpRunning: boolean;
  mode: string;
  _raw: DeviceEntity;
}

/**
 * Air purifier status
 */
export interface PurifierStatus {
  airQuality: number;
  filterLife: number;
  mode: number;
  fanSpeed: number;
  _raw: DeviceEntity;
}

// ============================================================================
// Action/Command Types
// ============================================================================

/**
 * Action configuration for ACTIONS_MAP
 */
export interface ActionConfig {
  endpoint?: string;
  getEndpoint?: (deviceType: string) => string;
  getParams: (device: DeviceEntity, setting?: Record<string, unknown>) => Record<string, unknown>;
  supportedDevices: readonly string[];
}

/**
 * Generic command setting
 */
export type CommandSetting = Record<string, unknown>;
