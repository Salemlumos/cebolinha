import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter } from '../../src/services/transcriber/rate-limiter.js';

describe('createRateLimiter', () => {
  it('não espera na primeira chamada', async () => {
    let currentTime = 0;
    const sleepFn = vi.fn(async (ms) => {
      currentTime += ms;
    });
    const limiter = createRateLimiter({ maxPerMinute: 20, sleepFn, now: () => currentTime });

    await limiter.acquire();

    expect(sleepFn).not.toHaveBeenCalled();
  });

  it('espaça chamadas sequenciais pra respeitar o limite por minuto', async () => {
    let currentTime = 0;
    const sleepFn = vi.fn(async (ms) => {
      currentTime += ms;
    });
    const limiter = createRateLimiter({ maxPerMinute: 20, sleepFn, now: () => currentTime });

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    // 20/min -> 3000ms de intervalo mínimo entre chamadas
    expect(sleepFn).toHaveBeenNthCalledWith(1, 3000);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 3000);
  });

  it('não espera se o tempo já passou o suficiente entre chamadas', async () => {
    let currentTime = 0;
    const sleepFn = vi.fn(async (ms) => {
      currentTime += ms;
    });
    const limiter = createRateLimiter({ maxPerMinute: 20, sleepFn, now: () => currentTime });

    await limiter.acquire();
    currentTime += 10_000; // bem mais que o intervalo mínimo (3000ms)
    await limiter.acquire();

    expect(sleepFn).toHaveBeenCalledTimes(0);
  });

  it('serializa chamadas concorrentes reservando slots sequenciais', async () => {
    let currentTime = 0;
    const sleepFn = vi.fn(async (ms) => {
      currentTime += ms;
    });
    const limiter = createRateLimiter({ maxPerMinute: 20, sleepFn, now: () => currentTime });

    await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);

    expect(sleepFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(3000);
  });
});
