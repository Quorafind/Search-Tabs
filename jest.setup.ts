import "@testing-library/jest-dom";
import React from "react";

// Mock cmdk
jest.mock("cmdk", () => ({
  Command: {
    Input: "input",
    List: "div",
    Empty: "div",
    Group: "div",
    Item: "div",
    Separator: "hr",
  },
}));

// Mock Popover from radix-ui
jest.mock("@radix-ui/react-popover", () => ({
  Root: ({ children }: { children: React.ReactNode }): JSX.Element =>
    React.createElement("div", null, children),
  Trigger: ({ children }: { children: React.ReactNode }): JSX.Element =>
    React.createElement("div", null, children),
  Content: ({ children }: { children: React.ReactNode }): JSX.Element =>
    React.createElement("div", null, children),
  __esModule: true,
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Play: () => "Play Icon",
  Pause: () => "Pause Icon",
  X: () => "X Icon",
  Earth: () => "Earth Icon",
  Search: () => "Search Icon",
  ArrowRight: () => "ArrowRight Icon",
}));
