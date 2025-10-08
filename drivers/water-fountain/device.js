'use strict';

const Homey = require('homey');
const PetkitAPI = require('../../lib/petkit-api');

class WaterFountainDevice extends Homey.Device {

  async onInit() {
    this.log('Petkit Water Fountain Device has been initialized');

    const store = this.getStore();
    const region = this.homey.settings.get('api_region') || 'DE';
    this.api = new PetkitAPI({
      username: store.username,
      password: store.password,
      region: region
    });

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    // Add custom capabilities
    if (!this.hasCapability('measure_water_level')) {
      await this.addCapability('measure_water_level');
    }
    if (!this.hasCapability('meter_filter_life')) {
      await this.addCapability('meter_filter_life');
    }
    if (!this.hasCapability('fountain_mode')) {
      await this.addCapability('fountain_mode');
    }

    // Start polling for device status
    this.startPolling();

    this.log('Water fountain device initialized with ID:', this.getData().id);
  }

  async onAdded() {
    this.log('Petkit Water Fountain has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Petkit Water Fountain settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(name) {
    this.log('Petkit Water Fountain was renamed');
  }

  async onDeleted() {
    this.log('Petkit Water Fountain has been deleted');
    this.stopPolling();
  }

  async onCapabilityOnoff(value, opts) {
    try {
      const mode = value ? 1 : 0; // 1 = smart mode (pump on), 0 = normal mode (pump off)
      return this.setFountainMode(mode);
    } catch (error) {
      this.error('Failed to set pump state:', error);
      throw error;
    }
  }

  async setFountainMode(mode) {
    try {
      const deviceId = this.getData().id;
      await this.api.setFountainMode(deviceId, mode);

      this.log(`Fountain mode set to: ${mode}`);

      // Update capabilities
      await this.setCapabilityValue('onoff', mode === 1);
      await this.setCapabilityValue('fountain_mode', mode.toString());

      // Trigger flow
      await this.homey.flow.getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: mode === 1 ? 'pump_on' : 'pump_off' });

      return true;
    } catch (error) {
      this.error('Failed to set fountain mode:', error);
      throw error;
    }
  }

  async updateDeviceStatus() {
    try {
      const deviceId = this.getData().id;
      const status = await this.api.getFountainStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_water_level', status.waterLevel);
      await this.setCapabilityValue('meter_filter_life', status.filterLife);
      await this.setCapabilityValue('onoff', status.pumpRunning);
      await this.setCapabilityValue('fountain_mode', status.mode.toString());

      // Check for low water alert
      const settings = this.getSettings();
      const lowWaterThreshold = settings.low_water_threshold || 20;

      if (status.waterLevel <= lowWaterThreshold) {
        // Trigger low water flow
        await this.homey.flow.getDeviceTriggerCard('fountain_low_water')
          .trigger(this, { water_level: status.waterLevel });
      }

      // Update availability
      await this.setAvailable();

      this.log('Device status updated:', status);
    } catch (error) {
      this.error('Failed to update device status:', error);
      await this.setUnavailable(this.homey.__('device.unavailable'));
    }
  }

  startPolling() {
    this.stopPolling();

    const settings = this.getSettings();
    const interval = (settings.poll_interval || 300) * 1000; // Convert to milliseconds

    this.pollInterval = setInterval(() => {
      this.updateDeviceStatus();
    }, interval);

    // Initial update
    this.updateDeviceStatus();
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

}

module.exports = WaterFountainDevice;