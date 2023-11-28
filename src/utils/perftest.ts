export interface PerformanceTest {
  setup(): void;
  testCases(): {
    label: string;
    run: () => number;
  }[];
}

export const perftest = (test: PerformanceTest) => {
  test.setup();

  for (const testCase of test.testCases()) {
    console.profile(testCase.label);
    for (let i = 0; i < 3; i++) {
      const s = new Date().getTime();
      const iter = testCase.run();
      console.log(
        `${testCase.label},${new Date().getTime() - s},${
          (new Date().getTime() - s) / iter
        },${Math.floor(iter / ((new Date().getTime() - s) / 1000))}`
      );
    }

    console.profileEnd(testCase.label);
  }
};
