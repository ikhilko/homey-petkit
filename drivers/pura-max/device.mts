import { BaseLitterBoxDevice } from '../../lib/base/index.mjs';

/**
 * PetKit Pura MAX (T4) Litter Box Device
 */
class PuraMaxDevice extends BaseLitterBoxDevice {
  protected getModelName(): string {
    return 'Pura MAX';
  }

  protected async registerCapabilityListeners(): Promise<void> {
    this.registerCapabilityListener('start_cleaning', async () => {
      await this.api.startCleaning(this.getDeviceId());
      this.log('Cleaning cycle started');
    });

    this.registerCapabilityListener('start_dumping', async () => {
      await this.api.startDumping(this.getDeviceId());
      this.log('Dumping started');
    });

    this.registerCapabilityListener('odor_removal', async () => {
      await this.api.startOdorRemoval(this.getDeviceId());
      this.log('Odor removal started');
    });

    this.registerCapabilityListener('level_litter', async () => {
      await this.api.levelLitter(this.getDeviceId());
      this.log('Leveling litter started');
    });

    this.registerCapabilityListener('button.calibrate_litter', async () => {
      await this.api.calibrateLitter(this.getDeviceId());
      this.log('Calibrating litter started');
    });
  }

  /**
   * Start cleaning - used by flow action card
   */
  async startCleaning(): Promise<boolean> {
    await this.api.startCleaning(this.getDeviceId());
    this.log('Cleaning cycle started');
    return true;
  }
}

export default PuraMaxDevice;
