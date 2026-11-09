jest.mock('@dr.pogodin/react-native-fs', () => ({ read: jest.fn() }), { virtual: true });
import { photoSpace } from '../photoSpace';
import fixtures from './fixtures.json';

const read = (key: keyof typeof fixtures) => async () => fixtures[key];

describe('photoSpace', () => {
  it('returns the upright size from the file, whatever the image component says', async () => {
    const s = await photoSpace('file:///x.jpg', [{ left: 5, top: 5, width: 20, height: 10 }], read('rot6_64x48'));
    expect(s).toMatchObject({ w: 48, h: 64, imageW: 48, imageH: 64 });
    expect(s!.note).toContain('exif=6');
  });

  it('strips file:// before reading', async () => {
    const spy = jest.fn(async () => fixtures.plain_64x48);
    await photoSpace('file:///data/p.jpg', [], spy);
    expect(spy).toHaveBeenCalledWith('/data/p.jpg', expect.any(Number));
  });

  it('is null for a file it cannot read as a JPEG', async () => {
    expect(await photoSpace('file:///x.png', [], async () => 'iVBORw0KGgo=')).toBeNull();
  });

  it('flags a correction when the boxes do not fit', async () => {
    const s = await photoSpace('file:///x.jpg', [{ left: 60, top: 0, width: 4, height: 4 }], read('rot6_64x48'));
    expect(s!.note).toContain('boxes did not fit');
    expect(s).toMatchObject({ imageW: 48, imageH: 64 }); // the photo itself is not reshaped
  });
});
