import type {
  EntityDrawerBadge,
  EntityDrawerItem,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';

type EntityDrawerSection = EntityDrawerProfile['sections'][number];

export const updateEntityDrawerProfileBadges = (
  profile: EntityDrawerProfile,
  updater: (badges: EntityDrawerBadge[]) => EntityDrawerBadge[]
): EntityDrawerProfile => ({
  ...profile,
  header: { ...profile.header, badges: updater(profile.header.badges) }
});

export const updateEntityDrawerProfileBadge = (
  profile: EntityDrawerProfile,
  badgeIndex: number,
  updater: (badge: EntityDrawerBadge) => EntityDrawerBadge
): EntityDrawerProfile =>
  updateEntityDrawerProfileBadges(profile, badges =>
    badges.map((badge, index) => (index === badgeIndex ? updater(badge) : badge))
  );

export const updateEntityDrawerProfileSections = (
  profile: EntityDrawerProfile,
  updater: (sections: EntityDrawerSection[]) => EntityDrawerSection[]
): EntityDrawerProfile => ({ ...profile, sections: updater(profile.sections) });

export const updateEntityDrawerProfileSection = (
  profile: EntityDrawerProfile,
  sectionId: string,
  updater: (section: EntityDrawerSection) => EntityDrawerSection
): EntityDrawerProfile =>
  updateEntityDrawerProfileSections(profile, sections =>
    sections.map(section => (section.id === sectionId ? updater(section) : section))
  );

export const updateEntityDrawerProfileItem = (
  profile: EntityDrawerProfile,
  sectionId: string,
  itemIndex: number,
  updater: (item: EntityDrawerItem) => EntityDrawerItem
): EntityDrawerProfile =>
  updateEntityDrawerProfileSection(profile, sectionId, section => ({
    ...section,
    items: section.items.map((item, index) => (index === itemIndex ? updater(item) : item))
  }));

export const moveEntityDrawerProfileItem = (
  profile: EntityDrawerProfile,
  sectionId: string,
  itemIndex: number,
  targetSectionId: string
): EntityDrawerProfile => {
  if (sectionId === targetSectionId) return profile;
  const source = profile.sections.find(section => section.id === sectionId);
  const target = profile.sections.find(section => section.id === targetSectionId);
  const item = source?.items[itemIndex];
  if (!source || !target || !item) return profile;

  return updateEntityDrawerProfileSections(profile, sections =>
    sections.map(section =>
      section.id === sectionId
        ? { ...section, items: section.items.filter((_, index) => index !== itemIndex) }
        : section.id === targetSectionId
          ? { ...section, items: [...section.items, item] }
          : section
    )
  );
};

export const moveEntityDrawerProfileEntry = <T>(
  entries: T[],
  index: number,
  direction: -1 | 1
): T[] => {
  const target = index + direction;
  if (index < 0 || index >= entries.length || target < 0 || target >= entries.length)
    return entries;
  const next = [...entries];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
};
