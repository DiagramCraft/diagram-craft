export type Direction = 'n' | 's' | 'w' | 'e';

export const Direction = {
  opposite(d: Direction): Direction {
    switch (d) {
      case 'n':
        return 's';
      case 's':
        return 'n';
      case 'w':
        return 'e';
      case 'e':
        return 'w';
    }
  },
  all: (): Direction[] => {
    return ['n', 's', 'w', 'e'];
  }
};
