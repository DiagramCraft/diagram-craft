export interface PerformanceTest {
  setup(): void;
  testCases(): {
    label: string;
    run: () => void;
  }[];
}

export const perftest = (test: PerformanceTest) => {
  test.setup();

  for (const testCase of test.testCases()) {
    console.log(testCase.label);
    console.profile(testCase.label);
    for (let i = 0; i < 20; i++) {
      const s = new Date().getTime();
      testCase.run();
      console.log(new Date().getTime() - s);
    }

    console.profileEnd(testCase.label);
  }
};
