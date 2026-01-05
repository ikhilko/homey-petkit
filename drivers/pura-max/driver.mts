import { BaseLitterBoxDriver } from '../../lib/base/index.mjs';
import { DeviceType } from '../../lib/petkit-api/index.mjs';
import PuraMaxDevice from './device.mjs';

interface FlowActionArgs {
  device: PuraMaxDevice;
}

/**
 * PetKit Pura MAX (T4) Litter Box Driver
 */
class PuraMaxDriver extends BaseLitterBoxDriver {
  protected getModelName(): string {
    return 'Pura MAX';
  }

  protected getSupportedDeviceTypes(): DeviceType[] {
    return [DeviceType.T4];
  }

  async onInit(): Promise<void> {
    await super.onInit();

    // Register Pura MAX specific flow card actions
    this.homey.flow
      .getActionCard('start_dumping')
      .registerRunListener(async (args: FlowActionArgs): Promise<boolean> => {
        return args.device.startDumping();
      });

    this.homey.flow
      .getActionCard('odor_removal')
      .registerRunListener(async (args: FlowActionArgs): Promise<boolean> => {
        return args.device.startOdorRemoval();
      });

    this.homey.flow
      .getActionCard('level_litter')
      .registerRunListener(async (args: FlowActionArgs): Promise<boolean> => {
        return args.device.levelLitter();
      });

    this.homey.flow
      .getActionCard('calibrate_litter')
      .registerRunListener(async (args: FlowActionArgs): Promise<boolean> => {
        return args.device.calibrateLitter();
      });
  }
}

export default PuraMaxDriver;
