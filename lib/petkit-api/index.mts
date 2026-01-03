/**
 * PetKit API - Main barrel file
 * Re-exports all public API components
 */

// ============================================================================
// Types
// ============================================================================

export type {
  PetKitClientOptions,
  Session,
  ApiResponse,
  ApiError,
  RegionServer,
  RegionServersResponse,
  LoginResponse,
  DeviceNfo,
  BasicDevice,
  DeviceState,
  DeviceSettings,
  DeviceEntity,
  RawDevice,
  PetData,
  PetDetails,
  AccountData,
  DeviceRecord,
  DeviceStatistics,
  PetOutGraph,
  LiveFeedData,
  LitterStatus,
  FeederStatus,
  FountainStatus,
  PurifierStatus,
  ActionConfig,
  CommandSetting,
} from './types.mjs';

// ============================================================================
// Constants and Enums
// ============================================================================

export {
  // Default configuration
  DEFAULT_COUNTRY,
  DEFAULT_TZ,
  RES_KEY,
  ERR_KEY,

  // Device type enum
  DeviceType,

  // Device groups
  DEVICES_LITTER_BOX,
  LITTER_WITH_CAMERA,
  LITTER_NO_CAMERA,
  FEEDER_WITH_CAMERA,
  DEVICES_FEEDER,
  DEVICES_WATER_FOUNTAIN,
  DEVICES_PURIFIER,

  // Command enums
  DeviceCommand,
  FeederCommand,
  LitterCommand,
  PetCommand,
  LBCommand,
  PurMode,
  DeviceAction,
  FountainAction,

  // Fountain BLE commands
  FOUNTAIN_COMMAND,

  // API configuration
  PetkitDomain,
  PetkitEndpoint,
  HEADERS,
  CLIENT_NFO,
  LOGIN_DATA,

  // Endpoint helpers
  getEndpointManualFeed,
  getEndpointCancelManualFeed,
  getEndpointResetDesiccant,
  getEndpointUpdateSetting,
  getCurrentDateStr,

  // Actions map
  ACTIONS_MAP,
} from './constants.mjs';

// ============================================================================
// Errors
// ============================================================================

export {
  PetkitAPIError,
  PetkitAuthenticationError,
  PetkitSessionExpiredError,
  PetkitServerBusyError,
  PetkitRegionalServerNotFoundError,
  PetkitDeviceNotFoundError,
  PetkitUnsupportedActionError,
} from './errors.mjs';

// ============================================================================
// Client
// ============================================================================

export { PetKitClient } from './client.mjs';
