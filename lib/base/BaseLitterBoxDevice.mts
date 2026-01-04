import Homey from 'homey';
import { PetKitClient, LitterStatus } from '../petkit-api/index.mjs';

export interface LitterBoxDeviceData {
  id: number;
  type: string;
}

export interface LitterBoxDeviceStore {
  // Credentials are now stored in app settings (petkit_username, petkit_password)
}

export interface LitterBoxDeviceSettings {
  poll_interval?: number;
  high_waste_threshold?: number;
}

/**
 * Base class for all PetKit litter box devices.
 * Handles common functionality like polling, status updates, and cleaning commands.
 * Model-specific devices should extend this class.
 */
abstract class BaseLitterBoxDevice extends Homey.Device {
  protected api!: PetKitClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Override in subclass to return the model name for logging
   */
  protected abstract getModelName(): string;

  async onInit(): Promise<void> {
    this.log(`${this.getModelName()} Device has been initialized`);

    // Initialize API client with credentials from app settings
    this.initializeApiClient();

    // Listen for credential changes in app settings
    this.homey.settings.on('set', (key: string) => {
      if (key === 'petkit_username' || key === 'petkit_password') {
        this.log('Credentials changed, reinitializing API client');
        this.initializeApiClient();
      }
    });

    // Register capability listeners (subclasses add their own)
    await this.registerCapabilityListeners();

    // Ensure capabilities are added
    await this.ensureCapabilities();

    // Start polling for device status
    this.startPolling();

    const deviceData = this.getData() as LitterBoxDeviceData;
    this.log(`${this.getModelName()} device initialized with ID:`, deviceData.id);
  }

  /**
   * Initialize or reinitialize the API client with credentials from app settings
   */
  private initializeApiClient(): void {
    const username = this.homey.settings.get('petkit_username') as string;
    const password = this.homey.settings.get('petkit_password') as string;
    const region = this.homey.settings.get('api_region') as string || 'DE';

    if (!username || !password) {
      this.error('PetKit credentials not found in app settings');
      return;
    }

    this.api = new PetKitClient({
      username,
      password,
      region,
    });
  }

  /**
   * Override in subclass to add model-specific capabilities
   */
  protected async ensureCapabilities(): Promise<void> {
    if (!this.hasCapability('measure_litter_level')) {
      await this.addCapability('measure_litter_level');
    }
    if (!this.hasCapability('measure_waste_level')) {
      await this.addCapability('measure_waste_level');
    }
  }

  async onAdded(): Promise<void> {
    this.log(`${this.getModelName()} has been added`);
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: LitterBoxDeviceSettings;
    newSettings: LitterBoxDeviceSettings;
    changedKeys: string[];
  }): Promise<void> {
    this.log(`${this.getModelName()} settings were changed`);

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(_name: string): Promise<void> {
    this.log(`${this.getModelName()} was renamed`);
  }

  async onDeleted(): Promise<void> {
    this.log(`${this.getModelName()} has been deleted`);
    this.stopPolling();
  }

  /**
   * Override in subclass to register model-specific capability listeners
   */
  protected async registerCapabilityListeners(): Promise<void> {
    // Default implementation does nothing
    // Subclasses should override to register their button handlers
  }

  /**
   * Get the device ID for API calls
   */
  protected getDeviceId(): number {
    const deviceData = this.getData() as LitterBoxDeviceData;
    return deviceData.id;
  }

  /**
   * Override in subclass to handle model-specific status fields
   */
  protected async updateDeviceStatus(): Promise<void> {
    try {
      const deviceData = this.getData() as LitterBoxDeviceData;
      const deviceId = deviceData.id;
      const status: LitterStatus = await this.api.getLitterStatus(deviceId);

      // Update common capabilities
      await this.setCapabilityValue('measure_litter_level', status.litterLevel);
      await this.setCapabilityValue('measure_waste_level', status.wasteLevel);

      // Check for high waste alert
      const settings = this.getSettings() as LitterBoxDeviceSettings;
      const highWasteThreshold = settings.high_waste_threshold || 80;

      if (status.wasteLevel >= highWasteThreshold) {
        await this.setCapabilityValue('alarm_generic', true);

        // Trigger needs cleaning flow
        await this.homey.flow
          .getDeviceTriggerCard('litter_needs_cleaning')
          .trigger(this, { waste_level: status.wasteLevel });
      } else {
        await this.setCapabilityValue('alarm_generic', false);
      }

      // Allow subclasses to handle model-specific status
      await this.onStatusUpdate(status);

      // Update availability
      await this.setAvailable();

      this.log('Device status updated:', status);
    } catch (error) {
      this.error('Failed to update device status:', error);
      await this.setUnavailable(this.homey.__('device.unavailable'));
    }
  }

  /**
   * Override in subclass to handle model-specific status updates
   */
  protected async onStatusUpdate(_status: LitterStatus): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override to handle model-specific fields
  }

  protected startPolling(): void {
    this.stopPolling();

    const settings = this.getSettings() as LitterBoxDeviceSettings;
    const interval = (settings.poll_interval || 300) * 1000;

    this.pollInterval = setInterval(() => {
      this.updateDeviceStatus();
    }, interval);

    // Initial update
    this.updateDeviceStatus();
  }

  protected stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export default BaseLitterBoxDevice;
