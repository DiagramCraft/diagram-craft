export const TEST_CASES = {
  OnEdge: {
    p1: 'M 0,0 L 0,1 L 1,1 L 1,0 L 0,0',
    p1Offset: -0.3,
    p2: 'M 0,0.5 L 0.5,0 L 1,0.5 L 0.3,1 L 0,0.5',
    p2Offset: -0.6
  },
  OnEdge2: {
    p1: 'M 0,0 L 0,1 L 1,1 L 1,0 L 0,0',
    p1Offset: -0.3,
    p2: 'M 0.4,0.2 L 0.8,0 L 1,0.5 L 0.3,1 L 0.4,0.2',
    p2Offset: -0.6
  },
  NonIntersecting: {
    p1: 'M 0,0 L 0,0.5 L 0.5,0.5 L 0.5,0 L 0,0',
    p1Offset: -0.5,
    p2: 'M 0.6,0.6 L 0.6,1 L 1,1 L 1,0.6 L 0.6,0.6',
    p2Offset: -0.5
  }
};
