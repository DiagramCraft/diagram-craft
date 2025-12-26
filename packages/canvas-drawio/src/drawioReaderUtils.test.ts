// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import {
  angleFromDirection,
  isStencilString,
  parseStencilString,
  MxPoint,
  MxGeometry,
  hasValue,
  deflate
} from './drawioReaderUtils';

describe('angleFromDirection', () => {
  test('returns -Math.PI/2 for north', () => {
    expect(angleFromDirection('north')).toBe(-Math.PI / 2);
  });

  test('returns Math.PI/2 for south', () => {
    expect(angleFromDirection('south')).toBe(Math.PI / 2);
  });

  test('returns 0 for east', () => {
    expect(angleFromDirection('east')).toBe(0);
  });

  test('returns Math.PI for west', () => {
    expect(angleFromDirection('west')).toBe(Math.PI);
  });

  test('returns 0 for unknown direction', () => {
    expect(angleFromDirection('unknown')).toBe(0);
  });

  test('returns 0 for empty string', () => {
    expect(angleFromDirection('')).toBe(0);
  });

  test('returns 0 for null-like value', () => {
    expect(angleFromDirection('northeast')).toBe(0);
  });
});

describe('isStencil', () => {
  test('returns true for stencil string', () => {
    expect(isStencilString('stencil(abc123)')).toBe(true);
  });

  test('returns true for stencil with complex data', () => {
    expect(
      isStencilString(
        'stencil(tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==)'
      )
    ).toBe(true);
  });

  test('returns false for non-stencil string', () => {
    expect(isStencilString('rect')).toBe(false);
  });

  test('returns undefined for undefined', () => {
    expect(isStencilString(undefined)).toBeUndefined();
  });

  test('returns false for empty string', () => {
    expect(isStencilString('')).toBe(false);
  });

  test('returns false for string starting with stencil but not stencil(', () => {
    expect(isStencilString('stencilShape')).toBe(false);
  });
});

describe('parseStencilString', () => {
  test('returns undefined for undefined input', () => {
    expect(parseStencilString(undefined)).toBeUndefined();
  });

  test('extracts content from valid stencil format', () => {
    const stencilData = 'eNqLjgUAARUAuQ==';
    const result = parseStencilString(`stencil(${stencilData})`);
    expect(result).toBe(stencilData);
  });

  test('extracts complex stencil data', () => {
    const stencilData =
      'tZPtDoIgFIavhv8IZv1tVveBSsm0cPjZ3QeCNlBytbU5tvc8x8N74ABwXOekogDBHOATQCiAUK5S944mdUXTRgc7IhhJSqpJ3Qhe0J5ljanBHjkVrFEUnwE8yhz14TghaXETvH1kDgDo4mVXLugKmHBF1LYLMOE771R3g3Zmenk6vcntP5RIW6FrBHYRIyOjB2RjI8MJY613E8c2/85DsLdNhI6JmdumfCZ+8nDAtgfHwoz/exAQbpwEdC4kcny8E9zAhpOS19SbNc60ZzblTLOy1M9mpcD462Lqx6h+rGPgBQ==';
    const result = parseStencilString(`stencil(${stencilData})`);
    expect(result).toBe(stencilData);
  });

  test('handles stencil with special characters', () => {
    const stencilData = 'abc123+/=';
    const result = parseStencilString(`stencil(${stencilData})`);
    expect(result).toBe(stencilData);
  });
});

describe('MxPoint', () => {
  const createMockElement = (x?: number, y?: number): Element => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<mxPoint/>', 'text/xml');
    const element = doc.documentElement;
    if (x !== undefined) element.setAttribute('x', x.toString());
    if (y !== undefined) element.setAttribute('y', y.toString());
    return element;
  };

  test('extracts x and y from element', () => {
    const element = createMockElement(10, 20);
    const point = MxPoint.pointFrom(element);
    expect(point).toEqual({ x: 10, y: 20 });
  });

  test('uses 0 as default for missing x', () => {
    const element = createMockElement(undefined, 20);
    const point = MxPoint.pointFrom(element);
    expect(point).toEqual({ x: 0, y: 20 });
  });

  test('uses 0 as default for missing y', () => {
    const element = createMockElement(10, undefined);
    const point = MxPoint.pointFrom(element);
    expect(point).toEqual({ x: 10, y: 0 });
  });

  test('uses 0 for both x and y when missing', () => {
    const element = createMockElement();
    const point = MxPoint.pointFrom(element);
    expect(point).toEqual({ x: 0, y: 0 });
  });

  test('handles negative coordinates', () => {
    const element = createMockElement(-15, -25);
    const point = MxPoint.pointFrom(element);
    expect(point).toEqual({ x: -15, y: -25 });
  });

  test('handles decimal coordinates', () => {
    const element = createMockElement(10.5, 20.75);
    const point = MxPoint.pointFrom(element);
    expect(point).toEqual({ x: 10.5, y: 20.75 });
  });
});

describe('MxGeometry', () => {
  const createMockElement = (x?: number, y?: number, width?: number, height?: number): Element => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<mxGeometry/>', 'text/xml');
    const element = doc.documentElement;
    if (x !== undefined) element.setAttribute('x', x.toString());
    if (y !== undefined) element.setAttribute('y', y.toString());
    if (width !== undefined) element.setAttribute('width', width.toString());
    if (height !== undefined) element.setAttribute('height', height.toString());
    return element;
  };

  test('extracts bounds from element', () => {
    const element = createMockElement(10, 20, 100, 50);
    const bounds = MxGeometry.boundsFrom(element);
    expect(bounds).toEqual({ x: 10, y: 20, w: 100, h: 50, r: 0 });
  });

  test('uses 0 as default for missing x and y', () => {
    const element = createMockElement(undefined, undefined, 100, 50);
    const bounds = MxGeometry.boundsFrom(element);
    expect(bounds).toEqual({ x: 0, y: 0, w: 100, h: 50, r: 0 });
  });

  test('uses 100 as default for missing width and height', () => {
    const element = createMockElement(10, 20, undefined, undefined);
    const bounds = MxGeometry.boundsFrom(element);
    expect(bounds).toEqual({ x: 10, y: 20, w: 100, h: 100, r: 0 });
  });

  test('uses all defaults when attributes are missing', () => {
    const element = createMockElement();
    const bounds = MxGeometry.boundsFrom(element);
    expect(bounds).toEqual({ x: 0, y: 0, w: 100, h: 100, r: 0 });
  });

  test('handles negative coordinates', () => {
    const element = createMockElement(-10, -20, 100, 50);
    const bounds = MxGeometry.boundsFrom(element);
    expect(bounds).toEqual({ x: -10, y: -20, w: 100, h: 50, r: 0 });
  });

  test('handles decimal values', () => {
    const element = createMockElement(10.5, 20.75, 100.25, 50.5);
    const bounds = MxGeometry.boundsFrom(element);
    expect(bounds).toEqual({ x: 10.5, y: 20.75, w: 100.25, h: 50.5, r: 0 });
  });

  test('always sets r to 0', () => {
    const element = createMockElement(10, 20, 100, 50);
    const bounds = MxGeometry.boundsFrom(element);
    expect(bounds.r).toBe(0);
  });
});

describe('hasValue', () => {
  test('returns false for undefined', () => {
    expect(hasValue(undefined)).toBe(false);
  });

  test('returns false for null', () => {
    expect(hasValue(null)).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(hasValue('')).toBe(false);
  });

  test('returns false for whitespace-only string', () => {
    expect(hasValue('   ')).toBe(false);
  });

  test('returns false for string with tabs and newlines', () => {
    expect(hasValue('\t\n  \n')).toBe(false);
  });

  test('returns true for non-empty string', () => {
    expect(hasValue('hello')).toBe(true);
  });

  test('returns true for string with leading/trailing whitespace', () => {
    expect(hasValue('  hello  ')).toBe(true);
  });

  test('returns true for HTML with img tag', () => {
    expect(hasValue('<div><img src="test.png"/></div>')).toBe(true);
  });

  test('returns true for HTML with text content', () => {
    expect(hasValue('<div>Hello World</div>')).toBe(true);
  });

  test('returns true for HTML with nested text content', () => {
    expect(hasValue('<div><span>Text</span></div>')).toBe(true);
  });

  test('returns false for HTML with only whitespace content', () => {
    expect(hasValue('<div>   </div>')).toBe(false);
  });

  test('returns false for HTML with only tags and no content', () => {
    expect(hasValue('<div></div>')).toBe(false);
  });

  test('returns false for HTML with nested empty tags', () => {
    expect(hasValue('<div><span></span></div>')).toBe(false);
  });

  test('returns true for HTML with mixed content including img', () => {
    expect(hasValue('<div>Some text<img src="test.png"/>more text</div>')).toBe(true);
  });

  test('returns true for self-closing img tag', () => {
    expect(hasValue('<img src="test.png"/>')).toBe(true);
  });
});

// Helper to create test data by compressing and encoding
async function createCompressedData(input: string): Promise<string> {
  // URI encode
  const uriEncoded = encodeURIComponent(input);

  // Convert to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(uriEncoded);

  // Compress using deflate-raw
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();

  const compressed = await new Response(cs.readable).arrayBuffer();

  // Convert to base64
  const bytes = new Uint8Array(compressed);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    // @ts-expect-error
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

describe('deflate', () => {
  test('decompresses simple text', async () => {
    const input = 'Hello World';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses text with special characters', async () => {
    const input = 'Hello @#$%^&*()';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses text with spaces', async () => {
    const input = 'This is a test with spaces';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses text with newlines', async () => {
    const input = 'Line 1\nLine 2\nLine 3';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses text with Unicode characters', async () => {
    const input = 'Hello 世界 🌍';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses XML-like content', async () => {
    const input = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses text with URI-encodable characters', async () => {
    const input = 'test=value&key=data';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses empty string', async () => {
    const input = '';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses single character', async () => {
    const input = 'A';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses long text', async () => {
    const input = 'a'.repeat(1000);
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('decompresses JSON-like content', async () => {
    const input = '{"key":"value","number":123}';
    const compressed = await createCompressedData(input);
    const result = await deflate(compressed);
    expect(result).toBe(input);
  });

  test('throws error for invalid base64', async () => {
    await expect(deflate('not-valid-base64!!!')).rejects.toThrow();
  });

  test('throws error for valid base64 but invalid deflate data', async () => {
    // Valid base64 that's not deflate-compressed
    const invalidData = btoa('just plain text');
    await expect(deflate(invalidData)).rejects.toThrow();
  });
});
