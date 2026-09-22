import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isGatewayCheckout } from '../src/lib/settle.js';
import { calculateStudioCreditPack } from '../src/lib/studio.js';
import { makeGiftCode, makeLicenseCode, slugify, timingSafeEqual } from '../src/lib/utils.js';

describe('studio credit pricing', () => {
  it('prices every default pack to end in a 9', () => {
    assert.deepEqual(
      [500, 1000, 2500, 5000].map(credits => calculateStudioCreditPack(credits).amountInr),
      [349, 599, 1339, 2559]
    );
  });

  it('always covers provider cost plus the platform margin', () => {
    for (const credits of [1, 250, 500, 7777, 20000]) {
      const pack = calculateStudioCreditPack(credits);
      assert.ok(pack.amountInr * 0.97 >= pack.providerCostInr + pack.platformMarginInr - 10, `credits=${credits}`);
    }
  });
});

describe('payment references', () => {
  it('tells unpaid online checkouts from manual transfers', () => {
    assert.equal(isGatewayCheckout('order_Nx81kLq'), true);
    assert.equal(isGatewayCheckout('plink_Nx81kLq'), true);
    assert.equal(isGatewayCheckout('412398765432'), false);
    assert.equal(isGatewayCheckout('pay_Nx81kLq'), false);
  });
});

describe('codes', () => {
  it('issues 8-character license codes without ambiguous glyphs', () => {
    for (let i = 0; i < 200; i += 1) assert.match(makeLicenseCode(), /^[A-HJ-NP-Z2-9]{8}$/);
  });

  it('issues gift codes in the GIFT-XXXXXXXX-XXXX shape', () => {
    assert.match(makeGiftCode(), /^GIFT-[0-9A-F]{8}-[0-9A-F]{4}$/);
  });

  it('slugifies course titles', () => {
    assert.equal(slugify('  Cinematic AI: Malayalam Batch 02 '), 'cinematic-ai-malayalam-batch-02');
  });

  it('compares secrets safely across lengths', () => {
    assert.equal(timingSafeEqual('abc', 'abc'), true);
    assert.equal(timingSafeEqual('abc', 'abd'), false);
    assert.equal(timingSafeEqual('abc', 'abcd'), false);
  });
});
