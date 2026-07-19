import { httpAssert } from './httpAssert';
import { orpcAssert } from './orpcAssert';

const testHttpAssertNarrowing = () => {
  const present: string | null | undefined = Math.random() > 0.5 ? 'value' : null;
  httpAssert.present(present);
  present.toUpperCase();

  const truth: boolean = Math.random() > 0.5;
  httpAssert.true(truth);
  const exactTrue: true = truth;

  const stringValue: unknown = 'value';
  httpAssert.string(stringValue);
  stringValue.toUpperCase();

  const booleanValue: unknown = true;
  httpAssert.boolean(booleanValue);
  const narrowedBoolean: boolean = booleanValue;

  const arrayValue: number[] | undefined = [1, 2, 3];
  httpAssert.array(arrayValue);
  const narrowedArray: number[] = arrayValue;

  const jsonValue: Record<string, unknown> | null = {};
  httpAssert.json(jsonValue);
  jsonValue['key'];

  void exactTrue;
  void narrowedBoolean;
  void narrowedArray;
};

const testOrpcAssertNarrowing = () => {
  const present: string | null | undefined = Math.random() > 0.5 ? 'value' : null;
  orpcAssert.present(present);
  present.toUpperCase();

  const truth: boolean = Math.random() > 0.5;
  orpcAssert.true(truth);
  const exactTrue: true = truth;

  const stringValue: unknown = 'value';
  orpcAssert.string(stringValue);
  stringValue.toUpperCase();

  const booleanValue: unknown = true;
  orpcAssert.boolean(booleanValue);
  const narrowedBoolean: boolean = booleanValue;

  const arrayValue: number[] | undefined = [1, 2, 3];
  orpcAssert.array(arrayValue);
  const narrowedArray: number[] = arrayValue;

  const jsonValue: Record<string, unknown> | null = {};
  orpcAssert.json(jsonValue);
  jsonValue['key'];

  void exactTrue;
  void narrowedBoolean;
  void narrowedArray;
};

void testHttpAssertNarrowing;
void testOrpcAssertNarrowing;
