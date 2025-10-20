import { unique } from '@diagram-craft/utils/array';
import type { Property, PropertyInfo } from '@diagram-craft/model/property';

export abstract class MultiProperty<T> implements Property<T> {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  protected constructor(protected readonly props: Array<Property<any>>) {}

  abstract get val(): T;
  abstract set(val: T | undefined): void;

  abstract formatAsString(val: unknown[]): string;

  get isSet() {
    return this.props.some(p => p.isSet);
  }

  get hasMultipleValues() {
    return this.props.some(p => p.hasMultipleValues);
  }

  get info() {
    const info: PropertyInfo<string> = [];

    // Default value
    let values: string[] = [];
    for (const p of this.props) {
      values.push(p.info?.find(i => i.type === 'default')?.val ?? undefined);
    }
    info.push({
      val: this.formatAsString(values),
      type: 'default'
    });

    // Style value
    values = [];
    for (const p of this.props) {
      values.push(p.info?.find(i => i.type === 'style')?.val ?? '');
    }
    info.push({
      val: this.formatAsString(values),
      type: 'style'
    });

    // Text style value
    values = [];
    for (const p of this.props) {
      values.push(p.info?.find(i => i.type === 'textStyle')?.val ?? '');
    }
    info.push({
      val: this.formatAsString(values),
      type: 'textStyle'
    });

    // Stored
    values = [];
    for (const p of this.props) {
      values.push(p.info?.find(i => i.type === 'stored')?.val ?? '');
    }
    info.push({
      val: this.formatAsString(values),
      type: 'stored'
    });

    // Rules
    for (const ruleId of unique(
      this.props.flatMap(p => p.info?.filter(i => i.type === 'rule') ?? []).map(r => r.id)
    )) {
      values = [];
      for (const p of this.props) {
        values.push(p.info?.find(i => i.type === 'rule' && i.id === ruleId)?.val ?? '');
      }
      info.push({
        val: this.formatAsString(values),
        type: 'rule',
        id: ruleId
      });
    }

    // TODO: This is not entirely correct to cast as <T>
    return info.filter(e => e.val !== '') as PropertyInfo<T>;
  }
}
