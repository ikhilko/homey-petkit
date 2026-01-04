import Homey from 'homey';
import { PetKitClient, LitterStatus } from '../petkit-api/index.mjs';

export interface LitterBoxDeviceData {
  id: number;
  type: string;
}

export interface LitterBoxDeviceStore {
  username: string;
  password: string;
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

    const store = this.getStore() as LitterBoxDeviceStore;
    const region = this.homey.settings.get('api_region') as string || 'DE';
    this.api = new PetKitClient({
      username: store.username,
      password: store.password,
      region: region,
    });

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    // Ensure capabilities are added
    await this.ensureCapabilities();

    // Start polling for device status
    this.startPolling();

    const deviceData = this.getData() as LitterBoxDeviceData;
    this.log(`${this.getModelName()} device initialized with ID:`, deviceData.id);
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

  private async onCapabilityOnoff(value: boolean, _opts: object): Promise<void> {
    if (value) {
      await this.startCleaning();
    }
  }

  async startCleaning(): Promise<boolean> {
    try {
      const deviceData = this.getData() as LitterBoxDeviceData;
      const deviceId = deviceData.id;
      await this.api.startCleaning(deviceId);

      this.log('Cleaning cycle started');

      // Trigger flow
      await this.homey.flow
        .getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: 'cleaning' });

      // Reset onoff capability after starting cleaning
      setTimeout(() => {
        this.setCapabilityValue('onoff', false).catch(this.error.bind(this));
      }, 1000);

      return true;
    } catch (error) {
      this.error('Failed to start cleaning:', error);
      throw error;
    }
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
