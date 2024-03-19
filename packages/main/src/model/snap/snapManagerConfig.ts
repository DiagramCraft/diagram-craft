import { MagnetType } from './magnet.ts';
import { EventEmitter } from '../../utils/event.ts';

export interface SnapManagerConfigProps {
  threshold: number;
  enabled: boolean;
  magnetTypes: ReadonlyArray<MagnetType>;
}

export class SnapManagerConfig
  extends EventEmitter<{
    change: { after: SnapManagerConfigProps };
  }>
  implements SnapManagerConfigProps
{
  magnetTypes: ReadonlyArray<MagnetType> = [];
  enabled: boolean = true;
  threshold: number = 5;

  constructor(magnetTypes: ReadonlyArray<MagnetType>) {
    super();

    this.magnetTypes = magnetTypes;
    this.threshold = 5;
  }

  commit(): void {
    this.emit('change', { after: this });
  }
}
