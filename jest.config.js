module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(gif|ttf|eot|svg|png)$": "<rootDir>/test/__mocks__/fileMock.js",
    // '^webextension-polyfill-ts$': '<rootDir>/source/__mocks__/webextension-polyfill-ts.ts'
  },
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "source/**/*.{ts,tsx}",
    "!source/**/*.d.ts",
    "!source/manifest.json",
    "!source/types/**/*",
  ],
  testMatch: [
    "<rootDir>/source/**/__tests__/**/*.{ts,tsx}",
    "<rootDir>/source/**/*.{spec,test}.{ts,tsx}",
  ],
};
