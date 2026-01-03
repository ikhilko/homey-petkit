/**
 * Custom error classes for the PetKit API
 */

/**
 * Base error class for PetKit API errors
 */
export class PetkitAPIError extends Error {
  public readonly code: number | null;

  constructor(message: string, code: number | null = null) {
    super(message);
    this.name = 'PetkitAPIError';
    this.code = code;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PetkitAPIError);
    }
  }
}

/**
 * Error thrown when authentication fails
 */
export class PetkitAuthenticationError extends PetkitAPIError {
  constructor(message: string) {
    super(message);
    this.name = 'PetkitAuthenticationError';
  }
}

/**
 * Error thrown when the session has expired
 */
export class PetkitSessionExpiredError extends PetkitAPIError {
  constructor(message: string) {
    super(message);
    this.name = 'PetkitSessionExpiredError';
  }
}

/**
 * Error thrown when the server is busy
 */
export class PetkitServerBusyError extends PetkitAPIError {
  constructor(message: string) {
    super(message);
    this.name = 'PetkitServerBusyError';
  }
}

/**
 * Error thrown when the regional server is not found
 */
export class PetkitRegionalServerNotFoundError extends PetkitAPIError {
  public readonly region: string;

  constructor(region: string) {
    super(`Regional server not found for region: ${region}`);
    this.name = 'PetkitRegionalServerNotFoundError';
    this.region = region;
  }
}

/**
 * Error thrown when a device is not found
 */
export class PetkitDeviceNotFoundError extends PetkitAPIError {
  public readonly deviceId: number;

  constructor(deviceId: number) {
    super(`Device with ID ${deviceId} not found`);
    this.name = 'PetkitDeviceNotFoundError';
    this.deviceId = deviceId;
  }
}

/**
 * Error thrown when an action is not supported for a device type
 */
export class PetkitUnsupportedActionError extends PetkitAPIError {
  public readonly action: string;
  public readonly deviceType: string;
  public readonly supportedDevices: readonly string[];

  constructor(action: string, deviceType: string, supportedDevices: readonly string[]) {
    super(
      `Action '${action}' is not supported for device type '${deviceType}'. ` +
      `Supported devices: ${supportedDevices.join(', ')}`
    );
    this.name = 'PetkitUnsupportedActionError';
    this.action = action;
    this.deviceType = deviceType;
    this.supportedDevices = supportedDevices;
  }
}
