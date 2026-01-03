import Homey from 'homey';
import { PetKitClient, FeederStatus } from '../../lib/petkit-api/index.mjs';

interface DeviceData {
  id: number;
  type: string;
}

interface DeviceStore {
  username: string;
  password: string;
}

interface DeviceSettings {
  poll_interval?: number;
  low_food_threshold?: number;
}

class FeederDevice extends Homey.Device {
  private api!: PetKitClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  async onInit(): Promise<void> {
    this.log('Petkit Feeder Device has been initialized');

    const store = this.getStore() as DeviceStore;
    const region = this.homey.settings.get('api_region') as string || 'DE';
    this.api = new PetKitClient({
      username: store.username,
      password: store.password,
      region: region,
    });

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    // Add custom capability for food level
    if (!this.hasCapability('meter_food_level')) {
      await this.addCapability('meter_food_level');
    }

    // Start polling for device status
    this.startPolling();

    const deviceData = this.getData() as DeviceData;
    this.log('Feeder device initialized with ID:', deviceData.id);
  }

  async onAdded(): Promise<void> {
    this.log('Petkit Feeder has been added');
  }

  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: DeviceSettings;
    newSettings: DeviceSettings;
    changedKeys: string[];
  }): Promise<void> {
    this.log('Petkit Feeder settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(_name: string): Promise<void> {
    this.log('Petkit Feeder was renamed');
  }

  async onDeleted(): Promise<void> {
    this.log('Petkit Feeder has been deleted');
    this.stopPolling();
  }

  private async onCapabilityOnoff(value: boolean, _opts: object): Promise<void> {
    if (value) {
      // Trigger manual feed when turned "on"
      await this.feedManual(1);
    }
  }

  async feedManual(amount: number = 1): Promise<boolean> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;
      await this.api.feedManual(deviceId, amount);

      this.log(`Manual feed triggered: ${amount} portion(s)`);

      // Trigger flow
      await this.homey.flow
        .getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: 'feeding' });

      // Reset onoff capability after feeding
      setTimeout(() => {
        this.setCapabilityValue('onoff', false).catch(this.error.bind(this));
      }, 1000);

      return true;
    } catch (error) {
      this.error('Failed to feed manually:', error);
      throw error;
    }
  }

  private async updateDeviceStatus(): Promise<void> {
    try {
      const deviceData = this.getData() as DeviceData;
      const deviceId = deviceData.id;
      const status: FeederStatus = await this.api.getFeederStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_battery', status.batteryLevel);
      await this.setCapabilityValue('meter_food_level', status.foodLevel);

      // Check for low food alert
      const settings = this.getSettings() as DeviceSettings;
      const lowFoodThreshold = settings.low_food_threshold || 20;

      if (status.foodLevel <= lowFoodThreshold) {
        await this.setCapabilityValue('alarm_generic', true);

        // Trigger low food flow
        await this.homey.flow
          .getDeviceTriggerCard('feeder_low_food')
          .trigger(this, { food_level: status.foodLevel });
      } else {
        await this.setCapabilityValue('alarm_generic', false);
      }

      // Update availability
      await this.setAvailable();

      this.log('Device status updated:', status);
    } catch (error) {
      this.error('Failed to update device status:', error);
      await this.setUnavailable(this.homey.__('device.unavailable'));
    }
  }

  private startPolling(): void {
    this.stopPolling();

    const settings = this.getSettings() as DeviceSettings;
    const interval = (settings.poll_interval || 300) * 1000; // Convert to milliseconds

    this.pollInterval = setInterval(() => {
      this.updateDeviceStatus();
    }, interval);

    // Initial update
    this.updateDeviceStatus();
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export default FeederDevice;
