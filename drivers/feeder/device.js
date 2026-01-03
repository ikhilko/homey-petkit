'use strict';

const Homey = require('homey');
const { PetKitClient } = require('../../lib/petkit-api');

class FeederDevice extends Homey.Device {

  async onInit() {
    this.log('Petkit Feeder Device has been initialized');

    const store = this.getStore();
    const region = this.homey.settings.get('api_region') || 'DE';
    this.api = new PetKitClient({
      username: store.username,
      password: store.password,
      region: region
    });

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));

    // Add custom capability for food level
    if (!this.hasCapability('meter_food_level')) {
      await this.addCapability('meter_food_level');
    }

    // Start polling for device status
    this.startPolling();

    this.log('Feeder device initialized with ID:', this.getData().id);
  }

  async onAdded() {
    this.log('Petkit Feeder has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Petkit Feeder settings were changed');

    if (changedKeys.includes('poll_interval')) {
      this.startPolling();
    }
  }

  async onRenamed(name) {
    this.log('Petkit Feeder was renamed');
  }

  async onDeleted() {
    this.log('Petkit Feeder has been deleted');
    this.stopPolling();
  }

  async onCapabilityOnoff(value, opts) {
    if (value) {
      // Trigger manual feed when turned "on"
      return this.feedManual(1);
    }
    return Promise.resolve();
  }

  async feedManual(amount = 1) {
    try {
      const deviceId = this.getData().id;
      await this.api.feedManual(deviceId, amount);

      this.log(`Manual feed triggered: ${amount} portion(s)`);

      // Trigger flow
      await this.homey.flow.getDeviceTriggerCard('device_status_changed')
        .trigger(this, { status: 'feeding' });

      // Reset onoff capability after feeding
      setTimeout(() => {
        this.setCapabilityValue('onoff', false).catch(this.error);
      }, 1000);

      return true;
    } catch (error) {
      this.error('Failed to feed manually:', error);
      throw error;
    }
  }

  async updateDeviceStatus() {
    try {
      const deviceId = this.getData().id;
      const status = await this.api.getFeederStatus(deviceId);

      // Update capabilities
      await this.setCapabilityValue('measure_battery', status.batteryLevel);
      await this.setCapabilityValue('meter_food_level', status.foodLevel);

      // Check for low food alert
      const settings = this.getSettings();
      const lowFoodThreshold = settings.low_food_threshold || 20;

      if (status.foodLevel <= lowFoodThreshold) {
        await this.setCapabilityValue('alarm_generic', true);

        // Trigger low food flow
        await this.homey.flow.getDeviceTriggerCard('feeder_low_food')
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

module.exports = FeederDevice;