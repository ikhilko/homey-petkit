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
      await this.startCleaning();
    });

    this.registerCapabilityListener('start_dumping', async () => {
      await this.startDumping();
    });

    this.registerCapabilityListener('odor_removal', async () => {
      await this.startOdorRemoval();
    });

    this.registerCapabilityListener('level_litter', async () => {
      await this.levelLitter();
    });

    this.registerCapabilityListener('button.calibrate_litter', async () => {
      await this.calibrateLitter();
    });
  }

  async startCleaning(): Promise<boolean> {
    await this.api.startCleaning(this.getDeviceId());
    this.log('Cleaning cycle started');
    return true;
  }

  async startDumping(): Promise<boolean> {
    await this.api.startDumping(this.getDeviceId());
    this.log('Dumping started');
    return true;
  }

  async startOdorRemoval(): Promise<boolean> {
    await this.api.startOdorRemoval(this.getDeviceId());
    this.log('Odor removal started');
    return true;
  }

  async levelLitter(): Promise<boolean> {
    await this.api.levelLitter(this.getDeviceId());
    this.log('Leveling litter started');
    return true;
  }

  async calibrateLitter(): Promise<boolean> {
    await this.api.calibrateLitter(this.getDeviceId());
    this.log('Calibrating litter started');
    return true;
  }
}

export default PuraMaxDevice;
