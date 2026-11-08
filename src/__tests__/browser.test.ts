import { describe, expect, it } from '@rstest/core';
import { z } from 'zod';

import { create, mock } from '../index';

describe('browser environment', () => {
  it('provides the browser globals the library relies on', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
    expect(typeof btoa).toBe('function');
    expect(typeof atob).toBe('function');
    expect(typeof File).toBe('function');
  });

  it('generates values with browser APIs', () => {
    const schema = z.object({
      email: z.email(),
      file: z.file(),
      jwt: z.jwt(),
      base64: z.base64(),
      url: z.url(),
    });

    const init = create(schema);
    expect(schema.safeParse(init).success).toBe(true);
    expect(init.file).toBeInstanceOf(File);

    const fixture = mock(schema, { seed: 42 });
    expect(schema.safeParse(fixture).success).toBe(true);
    expect(fixture.file).toBeInstanceOf(File);
  });
});
