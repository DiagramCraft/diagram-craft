import { describe, expect, it } from 'vitest';
import type { EntityDrawerProfile } from '@arch-register/api-types/entityDrawerConfiguration';
import {
  moveEntityDrawerProfileEntry,
  moveEntityDrawerProfileItem,
  updateEntityDrawerProfileBadge,
  updateEntityDrawerProfileItem,
  updateEntityDrawerProfileSection
} from './entityDrawerProfileUpdates';

const profileFixture = (): EntityDrawerProfile => ({
  header: { badges: [{ kind: 'metadata', slot: 'owner' }] },
  sections: [
    {
      id: 'section-one',
      title: 'One',
      showTitle: true,
      collapsible: true,
      items: [
        { kind: 'field', fieldId: 'name' },
        { kind: 'placeholder', message: 'Later' }
      ]
    },
    {
      id: 'section-two',
      title: 'Two',
      showTitle: true,
      collapsible: true,
      items: [{ kind: 'query', queryText: '<-"Owns"' }]
    }
  ]
});

describe('entity drawer profile updates', () => {
  it('updates a badge without mutating the original profile', () => {
    const profile = profileFixture();
    const updated = updateEntityDrawerProfileBadge(profile, 0, badge => ({
      ...badge,
      label: 'Owner'
    }));

    expect(updated.header.badges[0]).toEqual({ kind: 'metadata', slot: 'owner', label: 'Owner' });
    expect(profile.header.badges[0]).toEqual({ kind: 'metadata', slot: 'owner' });
  });

  it('updates a section and a nested item immutably', () => {
    const profile = profileFixture();
    const updatedSection = updateEntityDrawerProfileSection(profile, 'section-one', section => ({
      ...section,
      title: 'Overview'
    }));
    const updatedItem = updateEntityDrawerProfileItem(updatedSection, 'section-one', 1, item =>
      item.kind === 'placeholder' ? { ...item, message: 'Coming soon' } : item
    );

    expect(updatedItem.sections[0]?.title).toBe('Overview');
    expect(updatedItem.sections[0]?.items[1]).toEqual({
      kind: 'placeholder',
      message: 'Coming soon'
    });
    expect(profile.sections[0]?.title).toBe('One');
    expect(profile.sections[0]?.items[1]).toEqual({ kind: 'placeholder', message: 'Later' });
  });

  it('moves an item between sections and preserves order elsewhere', () => {
    const profile = profileFixture();
    const updated = moveEntityDrawerProfileItem(profile, 'section-one', 0, 'section-two');

    expect(updated.sections.map(section => section.items)).toEqual([
      [{ kind: 'placeholder', message: 'Later' }],
      [
        { kind: 'query', queryText: '<-"Owns"' },
        { kind: 'field', fieldId: 'name' }
      ]
    ]);
    expect(profile.sections[0]?.items[0]).toEqual({ kind: 'field', fieldId: 'name' });
  });

  it('leaves entries unchanged when a reorder would move beyond the list', () => {
    const entries = ['first', 'second'];

    expect(moveEntityDrawerProfileEntry(entries, 0, -1)).toBe(entries);
    expect(moveEntityDrawerProfileEntry(entries, 1, 1)).toBe(entries);
    expect(moveEntityDrawerProfileEntry(entries, 0, 1)).toEqual(['second', 'first']);
  });
});
