const mongoose = require('mongoose');
const Media = require('../../models/Media');

// Test year setter and defaults without a real DB by using a new document (setters run on assign)
describe('Media model', () => {
  const baseDoc = {
    userID: 'user1',
    ID: 1,
    mediaType: 'movies',
    title: 'Test',
    tier: 'S',
    toDo: false
  };

  describe('year setter', () => {
    it('converts number (1000-3000) to Jan 1 Date', () => {
      const doc = new Media({ ...baseDoc, year: 2020 });
      expect(doc.year).toBeInstanceOf(Date);
      expect(doc.year.getFullYear()).toBe(2020);
      expect(doc.year.getMonth()).toBe(0);
      expect(doc.year.getDate()).toBe(1);
    });

    it('converts 4-digit string to Jan 1 Date', () => {
      const doc = new Media({ ...baseDoc, year: '2021' });
      expect(doc.year).toBeInstanceOf(Date);
      expect(doc.year.getFullYear()).toBe(2021);
    });

    it('does not convert number out of range to year Date', () => {
      const doc = new Media({ ...baseDoc, year: 999 });
      // Setter returns v (999); Mongoose may still cast to Date (timestamp ms). Ensure it's not year 999 AD.
      expect(doc.year.getFullYear ? doc.year.getFullYear() : doc.year).not.toBe(999);
    });

    it('leaves non-4-digit string as undefined or unchanged', () => {
      const doc = new Media({ ...baseDoc, year: '21' });
      // Schema type is Date; invalid string may be undefined or left as-is
      expect(doc.year === undefined || doc.year === '21').toBe(true);
    });

    it('leaves null/undefined as-is when not set', () => {
      const doc = new Media(baseDoc);
      expect(doc.year).toBeUndefined();
    });
  });

  describe('orderIndex default', () => {
    it('defaults orderIndex to 0', () => {
      const doc = new Media(baseDoc);
      expect(doc.orderIndex).toBe(0);
    });
  });
});
