import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { browser } from "webextension-polyfill-ts";
import "@testing-library/jest-dom";
import Popup from "../Popup";

// Set test timeout to 40 seconds
jest.setTimeout(10000);

// Mock window.close
jest.spyOn(window, "close").mockImplementation(jest.fn());

// Mock browser API
jest.mock("webextension-polyfill-ts", () => ({
  browser: {
    tabs: {
      query: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
      onRemoved: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onCreated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
    windows: {
      getCurrent: jest.fn(),
      update: jest.fn(),
    },
    sessions: {
      getRecentlyClosed: jest.fn(),
    },
    history: {
      search: jest.fn(),
    },
    bookmarks: {
      search: jest.fn(),
      getRecent: jest.fn(),
    },
  },
}));

// Mock cmdk Command component
jest.mock("cmdk", () => ({
  Command: {
    ...jest.requireActual("cmdk").Command,
    Input: ({
      placeholder,
      onKeyDown,
      onValueChange,
    }: {
      placeholder: string;
      onKeyDown?: (e: any) => void;
      onValueChange?: (value: string) => void;
    }) => (
      <input
        data-testid={
          placeholder === "Search tabs..." ? "search-input" : "submenu-input"
        }
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onChange={(e) => onValueChange?.(e.target.value)}
      />
    ),
    List: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="command-list">{children}</div>
    ),
    Empty: () => <div data-testid="command-empty"></div>,
    Group: ({
      children,
      heading,
    }: {
      children: React.ReactNode;
      heading?: string;
    }) => (
      <div>
        {heading && <div>{heading}</div>}
        {children}
      </div>
    ),
    Item: ({
      children,
      onSelect,
      className,
      "data-title": dataTitle,
    }: {
      children: React.ReactNode;
      onSelect?: () => void;
      className?: string;
      "data-title"?: string;
    }) => (
      <div onClick={onSelect} className={className} title={dataTitle}>
        {children}
      </div>
    ),
    Separator: () => <hr />,
  },
}));

describe("Popup", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    (browser.tabs.query as jest.Mock).mockResolvedValue([]);
    (browser.sessions.getRecentlyClosed as jest.Mock).mockResolvedValue([]);
    (browser.history.search as jest.Mock).mockResolvedValue([]);
    (browser.bookmarks.getRecent as jest.Mock).mockResolvedValue([]);
    (browser.windows.getCurrent as jest.Mock).mockResolvedValue({ id: 1 });
  });

  it("renders without crashing", async () => {
    await act(async () => {
      render(<Popup />);
    });
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("shows and handles filter buttons correctly", async () => {
    await act(async () => {
      render(<Popup />);
    });

    // Verify all filter buttons exist
    const filterButtons = ["All", "Tab", "History", "Bookmark"];
    filterButtons.forEach((text) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });

    // Test filter button clicks
    const tabButton = screen.getByText("Tab");
    await act(async () => {
      await userEvent.click(tabButton);
    });
    expect(tabButton).toHaveClass("active");
    expect(screen.getByText("All")).not.toHaveClass("active");

    // Test returning to "All" filter
    const allButton = screen.getByText("All");
    await act(async () => {
      await userEvent.click(allButton);
    });
    expect(allButton).toHaveClass("active");
    expect(tabButton).not.toHaveClass("active");
  });
  
  it("handles search functionality correctly", async () => {
    const mockTabs = [
      {
        id: 1,
        title: "Test Tab", 
        url: "https://test.com",
        lastAccessed: Date.now(),
      },
      {
        id: 2,
        title: "Another Tab",
        url: "https://example.com", 
        lastAccessed: Date.now() - 1000,
      },
    ];
    (browser.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

    await act(async () => {
      render(<Popup />);
    });
    const searchInput = screen.getByTestId("search-input");

    // Test empty input state
    expect(screen.queryByText("Search google")).not.toBeInTheDocument();
    expect(screen.queryByText("Navigate to")).not.toBeInTheDocument();

    // Test non-URL search shows only Search google
    await act(async () => {
      await userEvent.type(searchInput, "test");
    });

    await waitFor(() => {
      expect(screen.getByText("Search google")).toBeInTheDocument();
      expect(screen.queryByText("Navigate to")).not.toBeInTheDocument();
    });

    // Test Ctrl+Enter search
    await act(async () => {
      searchInput.focus();
      fireEvent.keyDown(searchInput, {
        key: "Enter",
        code: "Enter",
        ctrlKey: true
      });
    });

    await waitFor(() => {
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: "https://www.google.com/search?q=test",
      });
    });

    // Test URL input shows both Search google and Navigate to
    await act(async () => {
      await userEvent.clear(searchInput);
      searchInput.focus();
      await userEvent.type(searchInput, "https://example.com");
    });

    await waitFor(() => {
      expect(screen.getByText("Search google")).toBeInTheDocument();
      expect(screen.getByText("Navigate to")).toBeInTheDocument();
    });

    // Test URL navigation with Ctrl+Shift+Enter
    await act(async () => {
      searchInput.focus();
      fireEvent.keyDown(searchInput, {
        key: "Enter",
        code: "Enter",
        ctrlKey: true,
        shiftKey: true
      });
    });

    await waitFor(() => {
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: "https://example.com",
      });
    });

    // Test Ctrl+Enter on URL triggers google search with encoded URL
    await act(async () => {
      await userEvent.clear(searchInput);
      searchInput.focus();
      await userEvent.type(searchInput, "https://example.com");
      fireEvent.keyDown(searchInput, {
        key: "Enter",
        code: "Enter",
        ctrlKey: true
      });
    });

    await waitFor(() => {
      expect(browser.tabs.create).toHaveBeenCalledWith({
        url: "https://www.google.com/search?q=https%3A%2F%2Fexample.com",
      });
    });

    // Test suggestions disappear after clearing input
    await act(async () => {
      await userEvent.clear(searchInput);
    });

    await waitFor(() => {
      expect(screen.queryByText("Search google")).not.toBeInTheDocument();
      expect(screen.queryByText("Navigate to")).not.toBeInTheDocument();
    });
  });

  it("handles keyboard shortcuts correctly", async () => {
    await act(async () => {
      render(<Popup />);
    });

    const searchInput = screen.getByPlaceholderText("Search tabs...");

    // Initially "all" filter should be active
    expect(screen.getByRole("button", { name: /all/i })).toHaveClass("active");
    expect(screen.getByRole("button", { name: /tab/i })).not.toHaveClass(
      "active"
    );
    expect(screen.getByRole("button", { name: /history/i })).not.toHaveClass(
      "active"
    );
    expect(screen.getByRole("button", { name: /bookmark/i })).not.toHaveClass(
      "active"
    );

    // Press Ctrl+2 to activate tab filter
    await act(async () => {
      fireEvent.keyDown(searchInput, {
        key: "2",
        code: "Digit2",
        ctrlKey: true,
      });
    });

    // Wait for state update - tab should be active, all inactive
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /tab/i })).toHaveClass(
        "active"
      );
      expect(screen.getByRole("button", { name: /all/i })).not.toHaveClass(
        "active"
      );
    });

    // Press Ctrl+2 again to toggle back to all
    await act(async () => {
      fireEvent.keyDown(searchInput, {
        key: "2",
        code: "Digit2",
        ctrlKey: true,
      });
    });

    // Wait for state update - all should be active, tab inactive
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /all/i })).toHaveClass(
        "active"
      );
      expect(screen.getByRole("button", { name: /tab/i })).not.toHaveClass(
        "active"
      );
    });
  });

  it("handles media tabs correctly", async () => {
    // Initially no media tabs
    (browser.tabs.query as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<Popup />);
    });

    // Media Tabs section should not exist initially
    expect(screen.queryByText("Media Tabs")).not.toBeInTheDocument();

    // Mock tabs with different media states
    const mockTabs = [
      {
        id: 1,
        title: "Audible Tab",
        url: "https://music.com",
        favIconUrl: "https://music.com/favicon.ico",
        audible: true,
        mutedInfo: { muted: false },
      },
      {
        id: 2,
        title: "Muted Tab",
        url: "https://video.com",
        favIconUrl: "https://video.com/favicon.ico",
        audible: false,
        mutedInfo: { muted: true },
      },
      {
        id: 3,
        title: "Normal Tab",
        url: "https://example.com",
        favIconUrl: "https://example.com/favicon.ico",
        audible: false,
        mutedInfo: { muted: false },
      },
    ];

    // Update tabs to include media tabs
    (browser.tabs.query as jest.Mock).mockResolvedValue(mockTabs);

    // Trigger tab update
    await act(async () => {
      const tabUpdateCallback = (
        browser.tabs.onUpdated.addListener as jest.Mock
      ).mock.calls[0][0];
      tabUpdateCallback();
    });

    // Verify Media Tabs section appears and contains only media tabs
    await waitFor(() => {
      expect(screen.getByText("Media Tabs")).toBeInTheDocument();
      expect(screen.getByText("Audible Tab")).toBeInTheDocument();
      expect(screen.getByText("Muted Tab")).toBeInTheDocument();
    });

    // Test mute toggle for audible tab
    const audibleTab = screen
      .getByText("Audible Tab")
      .closest(".media-tab-item");
    const muteButton = audibleTab?.querySelector(".tab-actions .action-button");
    expect(muteButton).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(muteButton!);
    });
    expect(browser.tabs.update).toHaveBeenCalledWith(1, { muted: true });

    // Test unmute toggle for muted tab
    const mutedTab = screen.getByText("Muted Tab").closest(".media-tab-item");
    const unmuteButton = mutedTab?.querySelector(".action-button");
    expect(unmuteButton).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(unmuteButton!);
    });
    expect(browser.tabs.update).toHaveBeenCalledWith(2, { muted: false });

    // Test closing a media tab
    const closeButton = audibleTab?.querySelectorAll(".action-button")[1];
    expect(closeButton).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(closeButton!);
    });
    expect(browser.tabs.remove).toHaveBeenCalledWith(1);

    // Test media tabs section disappears when no media tabs left
    (browser.tabs.query as jest.Mock).mockResolvedValue([mockTabs[2]]);
    await act(async () => {
      const tabUpdateCallback = (
        browser.tabs.onUpdated.addListener as jest.Mock
      ).mock.calls[0][0];
      tabUpdateCallback();
    });

    await waitFor(() => {
      expect(screen.queryByText("Media Tabs")).not.toBeInTheDocument();
    });
  });
});
