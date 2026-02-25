const { formatMediaRow } = require('../../utils/formatMediaRow');

describe('formatMediaRow', () => {
  it('formats a full media row', () => {
    const media = {
      mediaType: 'movies',
      title: 'Inception',
      tier: 'S',
      toDo: false,
      year: new Date('2010-01-01'),
      tags: ['sci-fi', 'action'],
      description: 'A dream heist'
    };
    const row = formatMediaRow(media);
    expect(row).toContain('movies');
    expect(row).toContain('"Inception"');
    expect(row).toContain('S');
    expect(row).toContain('No');
    expect(row).toContain('2010-01-01');
    expect(row).toContain('"sci-fi, action"');
    expect(row).toContain('"A dream heist"');
  });

  it('escapes double quotes in title and description', () => {
    const media = {
      mediaType: 'movies',
      title: 'Say "Hello"',
      tier: '',
      toDo: false,
      year: null,
      tags: [],
      description: 'Quote: "test"'
    };
    const row = formatMediaRow(media);
    expect(row).toContain('""Hello""');
    expect(row).toContain('"Quote: ""test"""');
  });

  it('handles missing optional fields', () => {
    const media = {
      mediaType: 'tv',
      title: '',
      tier: 'A',
      toDo: true,
      year: null,
      tags: [],
      description: ''
    };
    const row = formatMediaRow(media);
    expect(row).toContain('tv');
    expect(row).toContain('Yes');
  });
});
