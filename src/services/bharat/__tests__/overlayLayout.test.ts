import { chooseImageSpace, layoutOverlays } from '../overlayLayout';

const blk = (left: number, top: number, width: number, height: number, translated = 'अनुवाद') => ({
  left, top, width, height, text: 'x', translated,
});

describe('chooseImageSpace', () => {
  const upright = { w: 3000, h: 4000 };

  it('keeps the file size when every box fits inside it', () => {
    const r = chooseImageSpace(upright, [blk(100, 200, 800, 120), blk(150, 3000, 900, 100)]);
    expect(r).toMatchObject({ w: 3000, h: 4000, adjusted: false });
  });

  it('tries the other orientation when the boxes only fit that way', () => {
    // boxes reach x = 3800, which a 3000-wide photo cannot hold, but a 4000-wide one can
    const r = chooseImageSpace(upright, [blk(3000, 100, 800, 100)]);
    expect(r).toMatchObject({ w: 4000, h: 3000, adjusted: true });
  });

  it('falls back to a space that contains the boxes when neither orientation does', () => {
    const r = chooseImageSpace(upright, [blk(5000, 100, 1000, 100)]);
    expect(r.adjusted).toBe(true);
    expect(r.w).toBeGreaterThanOrEqual(6000 / 1.02 - 1);
  });
});

describe('layoutOverlays', () => {
  it('never lets a box run past the photo edge (the clipped-on-the-right bug)', () => {
    // a wide block that starts at 155 on a 625-wide photo
    const [p] = layoutOverlays([blk(155, 255, 614, 33, 'decodePcm16() इसे Int16Array में बदलता है')], 1, 1, 625, 833);
    expect(p.left + p.width).toBeLessThanOrEqual(625);
    expect(p.top + p.height).toBeLessThanOrEqual(833);
  });

  it('grows a box downward into free space when the translation is longer', () => {
    const long = 'यह एक काफी लंबा अनुवाद है जो मूल अंग्रेज़ी पंक्ति से ज़्यादा जगह लेता है और कई पंक्तियों में फैलेगा';
    const [p] = layoutOverlays([blk(20, 100, 200, 20, long)], 1, 1, 400, 600);
    expect(p.height).toBeGreaterThan(20);
    expect(p.height).toBeLessThanOrEqual(20 * 2.5);
  });

  it('does not grow into the block below it', () => {
    const long = 'यह एक काफी लंबा अनुवाद है जो मूल अंग्रेज़ी पंक्ति से ज़्यादा जगह लेता है और कई पंक्तियों में फैलेगा';
    const [a, b] = layoutOverlays([blk(20, 100, 200, 20, long), blk(20, 125, 200, 20, 'अगला')], 1, 1, 400, 600);
    expect(a.top + a.height).toBeLessThanOrEqual(b.top);
  });

  it('keeps short text at a comfortable size and the font within bounds', () => {
    const [p] = layoutOverlays([blk(20, 100, 300, 40, 'नमस्ते')], 1, 1, 400, 600);
    expect(p.fontSize).toBeGreaterThanOrEqual(7);
    expect(p.fontSize).toBeLessThanOrEqual(16);
    expect(p.fontSize).toBeGreaterThanOrEqual(12);
  });

  it('applies the photo-to-screen scale', () => {
    const [p] = layoutOverlays([blk(1000, 2000, 600, 100, 'ठीक')], 0.1, 0.1, 400, 600);
    expect(p.left).toBeCloseTo(100);
    expect(p.top).toBeCloseTo(200);
    expect(p.width).toBeCloseTo(60);
  });

  it('handles no blocks and tiny boxes without throwing', () => {
    expect(layoutOverlays([], 1, 1, 400, 600)).toEqual([]);
    const [p] = layoutOverlays([blk(399, 599, 1, 1, 'क')], 1, 1, 400, 600);
    expect(p.left + p.width).toBeLessThanOrEqual(400 + 24); // minimum box, still anchored on the photo
    expect(Number.isFinite(p.fontSize)).toBe(true);
  });
});
