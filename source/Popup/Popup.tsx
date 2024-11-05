import React, { useEffect, useRef, KeyboardEvent } from "react";
import { browser } from "webextension-polyfill-ts";
import { Command } from "cmdk";
import { Play, Pause, X, Earth, Search, ArrowRight } from "lucide-react";
import "./styles.scss";
import * as Popover from "@radix-ui/react-popover";

interface TabItem {
  id?: number;
  title: string;
  url: string;
  favIconUrl?: string;
  lastAccessed?: number;
  active?: boolean;
  audible?: boolean;
  mutedInfo?: {
    muted: boolean;
  };
}

interface HistoryItem {
  id: string;
  url?: string;
  title?: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
}

interface BookmarkItem {
  id: string;
  url?: string;
  title: string;
  dateAdded?: number;
}

const isUrl = (value: string) => {
  return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(
    value
  );
};

// Add this helper function to extract domain from URL
const extractDomain = (url: string) => {
  if (url.startsWith("about:")) {
    return url;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const Popup: React.FC = () => {
  const [openTabs, setOpenTabs] = React.useState<TabItem[]>([]);
  const [recentlyClosedTabs, setRecentlyClosedTabs] = React.useState<TabItem[]>(
    []
  );
  const [historyItems, setHistoryItems] = React.useState<HistoryItem[]>([]);
  const [bookmarkItems, setBookmarkItems] = React.useState<BookmarkItem[]>([]);
  const [filters, setFilters] = React.useState<{
    all: boolean;
    tab: boolean;
    history: boolean;
    bookmark: boolean;
  }>({
    all: true,
    tab: false,
    history: false,
    bookmark: false,
  });

  const [sessionsError, setSessionsError] = React.useState<string>("");
  const [searchValue, setSearchValue] = React.useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleFilterClick = (
    filter: "all" | "tab" | "history" | "bookmark"
  ) => {
    if (filter === "all") {
      setFilters({
        all: true,
        tab: false,
        history: false,
        bookmark: false,
      });
    } else {
      const newFilters = {
        ...filters,
        all: false,
        [filter]: !filters[filter],
      };
      // If no filters selected, default to all
      if (!newFilters.tab && !newFilters.history && !newFilters.bookmark) {
        newFilters.all = true;
      }
      setFilters(newFilters);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Get open tabs
  const fetchOpenTabs = async () => {
    const tabs = await browser.tabs.query({
      currentWindow: true,
    });
    const sortedTabs = (tabs as TabItem[]).sort((a, b) => {
      return (b.lastAccessed || 0) - (a.lastAccessed || 0);
    });
    setOpenTabs(sortedTabs);
  };

  // Get recently closed tabs
  const fetchRecentlyClosedTabs = async () => {
    try {
      if (!browser.sessions) {
        const error =
          "Cannot access recently closed tabs. Please ensure necessary permissions are granted.";
        console.warn("Sessions API is not available");
        setSessionsError(error);
        return;
      }

      const sessions = await browser.sessions.getRecentlyClosed({
        maxResults: 25,
      });

      const closedTabs = sessions
        .filter((session) => session.tab)
        .map((session) => session.tab as TabItem)
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      setRecentlyClosedTabs(closedTabs);
      setSessionsError("");
    } catch (error) {
      const errorMessage = "Error fetching recently closed tabs";
      console.error(errorMessage, error);
      setSessionsError(errorMessage);
      setRecentlyClosedTabs([]);
    }
  };

  // Get history items
  const fetchHistoryItems = async (query: string = "") => {
    try {
      const items = await browser.history.search({
        text: query,
        maxResults: 20,
        startTime: 0,
      });
      setHistoryItems(items);
    } catch (error) {
      console.error("Error fetching history:", error);
      setHistoryItems([]);
    }
  };

  // Get bookmark items
  const fetchBookmarkItems = async () => {
    try {
      if (searchValue) {
        const items = await browser.bookmarks.search({
          query: searchValue,
        });
        const filteredItems = items.filter((item) => item.url);
        setBookmarkItems(filteredItems);
      } else {
        const items = await browser.bookmarks.getRecent(10);
        const filteredItems = items.filter((item) => item.url);
        setBookmarkItems(filteredItems);
      }
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      setBookmarkItems([]);
    }
  };

  // Switch to specified tab
  const switchToTab = async (tabId: number) => {
    await browser.tabs.update(tabId, { active: true });
    const win = await browser.windows.getCurrent();
    await browser.windows.update(win.id!, { focused: true });
    window.close();
  };

  // Reopen closed tab
  const reopenTab = async (url: string) => {
    await browser.tabs.create({ url });
    window.close();
  };

  // Media controls
  const toggleMute = async (tabId: number, muted: boolean) => {
    await browser.tabs.update(tabId, { muted: !muted });
    fetchOpenTabs();
  };

  // Handle search with specified search engine
  const handleSearch = async (searchEngine: string) => {
    if (searchValue) {
      let searchUrl = "";
      switch (searchEngine) {
        case "google":
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchValue)}`;
          break;
        case "bing":
          searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchValue)}`;
          break;
        case "duckduckgo":
          searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchValue)}`;
          break;
        default:
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchValue)}`;
      }
      await browser.tabs.create({ url: searchUrl });
      window.close();
    }
  };

  // Handle direct URL navigation
  const handleUrlNavigation = async (url: string) => {
    // Add https if no protocol specified
    const urlWithProtocol = url.match(/^https?:\/\//) ? url : `https://${url}`;
    await browser.tabs.create({ url: urlWithProtocol });
    window.close();
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (isUrl(searchValue) && e.shiftKey) {
        handleUrlNavigation(searchValue);
      } else {
        handleSearch("google");
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Switch filter
      switch (e.key) {
        case "1":
          e.preventDefault();
          e.stopPropagation();
          handleFilterClick("all");
          break;
        case "2":
          e.preventDefault();
          e.stopPropagation();
          handleFilterClick("tab");
          break;
        case "3":
          e.preventDefault();
          e.stopPropagation();
          handleFilterClick("history");
          break;
        case "4":
          e.preventDefault();
          e.stopPropagation();
          handleFilterClick("bookmark");
          break;
        default:
          break;
      }
    }
  };

  React.useEffect(() => {
    fetchOpenTabs();
    fetchRecentlyClosedTabs();
    fetchHistoryItems();
    fetchBookmarkItems();

    // Listen for tab changes
    const handleTabChange = () => {
      fetchOpenTabs();
      fetchRecentlyClosedTabs();
    };

    browser.tabs.onRemoved.addListener(handleTabChange);
    browser.tabs.onCreated.addListener(handleTabChange);
    browser.tabs.onUpdated.addListener(handleTabChange);

    return () => {
      browser.tabs.onRemoved.removeListener(handleTabChange);
      browser.tabs.onCreated.removeListener(handleTabChange);
      browser.tabs.onUpdated.removeListener(handleTabChange);
    };
  }, []);

  React.useEffect(() => {
    fetchBookmarkItems();
    fetchHistoryItems(searchValue);
    // Scroll to top when search value changes
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [searchValue]);

  const mediaTabs = openTabs.filter(
    (tab) => tab.audible || tab.mutedInfo?.muted
  );
  const activeTabs = openTabs.filter(
    (tab) => !tab.audible && !tab.mutedInfo?.muted && !tab.active
  );

  return (
    <div className={`tab-search`}>
      <Command loop>
        <div cmdk-tab-search-top-shine="" />
        <Command.Input
          ref={inputRef}
          placeholder="Search tabs..."
          autoFocus
          inputMode="search"
          value={searchValue}
          onKeyDown={handleKeyDown}
          onValueChange={(value) => {
            setSearchValue(value);
            if (listRef.current) {
              listRef.current.scrollTop = 0;
            }
          }}
        />

        <hr cmdk-tab-search-loader="" />

        <div cmdk-tab-search-header="">
          <button
            className={filters.all ? "active" : ""}
            onClick={() => handleFilterClick("all")}
            aria-pressed={filters.all}
            cmdk-tab-search-filter-button=""
          >
            All
          </button>
          <button
            className={filters.tab ? "active" : ""}
            onClick={() => handleFilterClick("tab")}
            aria-pressed={filters.tab}
            cmdk-tab-search-filter-button=""
          >
            Tab
          </button>
          <button
            className={filters.history ? "active" : ""}
            onClick={() => handleFilterClick("history")}
            aria-pressed={filters.history}
            cmdk-tab-search-filter-button=""
          >
            History
          </button>
          <button
            className={filters.bookmark ? "active" : ""}
            onClick={() => handleFilterClick("bookmark")}
            aria-pressed={filters.bookmark}
            cmdk-tab-search-filter-button=""
          >
            Bookmark
          </button>
        </div>

        <Command.List ref={listRef}>
          <Command.Empty>No matching tabs found</Command.Empty>

          {searchValue && (
            <Command.Group heading={searchValue ? "" : "Quick Actions"}>
              <Command.Item
                key={"search-google"}
                value={`Search google with ${searchValue}`}
                onSelect={() => handleSearch("google")}
              >
                <Logo>
                  <Search size={16} />
                </Logo>
                <div className="tab-content">
                  <div className="tab-title">Search google</div>
                  <div className="tab-url">{`Search web with ${searchValue}`}</div>
                </div>
                <div className="tab-actions"></div>
              </Command.Item>
              {isUrl(searchValue) && (
                <Command.Item
                  key={"navigate-to"}
                  value={`Navigate to ${searchValue}`}
                  onSelect={() => handleUrlNavigation(searchValue)}
                >
                  <Logo>
                    <ArrowRight size={16} />
                  </Logo>
                  <div className="tab-content">
                    <div className="tab-title">Navigate to</div>
                    <div className="tab-url">{`Navigate to ${searchValue}`}</div>
                  </div>
                  <div className="tab-actions"></div>
                </Command.Item>
              )}
            </Command.Group>
          )}

          {(filters.all || filters.tab) && mediaTabs.length > 0 && (
            <Command.Group heading={"Media Tabs"}>
              {mediaTabs.map((tab, index) => (
                <Command.Item
                  data-title={tab.title}
                  className="media-tab-item"
                  key={tab.id}
                  value={tab.title + tab.id + index}
                  keywords={[tab.title || "", extractDomain(tab.url || "")]}
                  onSelect={() => tab.id && switchToTab(tab.id)}
                >
                  <Logo>
                    {tab.favIconUrl ? (
                      <img src={tab.favIconUrl} alt="" width={16} height={16} />
                    ) : (
                      <Earth size={16} />
                    )}
                  </Logo>
                  <div className="tab-content">
                    <div className="tab-title">{tab.title}</div>
                    <div className="tab-url">
                      {tab.url ? extractDomain(tab.url) : ""}
                    </div>
                  </div>
                  <div className="tab-actions">
                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        tab.id &&
                          toggleMute(tab.id, tab.mutedInfo?.muted || false);
                      }}
                    >
                      {tab.mutedInfo?.muted ? (
                        <Play size={12} />
                      ) : (
                        <Pause size={12} />
                      )}
                    </button>
                    <button
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        tab.id && browser.tabs.remove(tab.id);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {(filters.all || filters.tab) && (
            <>
              <Command.Group heading={searchValue ? "" : "Opened Tabs"}>
                {activeTabs.map((tab, index) => (
                  <Command.Item
                    key={tab.id}
                    value={tab.title + tab.id + index}
                    keywords={[tab.title || "", extractDomain(tab.url || "")]}
                    onSelect={() => tab.id && switchToTab(tab.id)}
                  >
                    <Logo>
                      {tab.favIconUrl ? (
                        <img
                          src={tab.favIconUrl}
                          alt=""
                          width={16}
                          height={16}
                        />
                      ) : (
                        <Earth size={16} />
                      )}
                    </Logo>
                    <div className="tab-content">
                      <div className="tab-title">{tab.title}</div>
                      <div className="tab-url">
                        {tab.url ? extractDomain(tab.url) : ""}
                      </div>
                    </div>
                    <div className="tab-actions">
                      <button
                        className="action-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          tab.id && browser.tabs.remove(tab.id);
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Separator />
            </>
          )}

          {(filters.all || filters.tab) && !sessionsError && (
            <>
              <Command.Group
                heading={searchValue ? "" : "Recently Closed Tabs"}
              >
                {recentlyClosedTabs.map((tab, index) => (
                  <Command.Item
                    key={tab.id}
                    value={(tab.title || "blank") + tab.id + index}
                    keywords={[tab.title || "", extractDomain(tab.url || "")]}
                    onSelect={() => tab.url && reopenTab(tab.url)}
                  >
                    <Logo>
                      {tab.favIconUrl ? (
                        <img
                          src={tab.favIconUrl}
                          alt=""
                          width={16}
                          height={16}
                        />
                      ) : (
                        <Earth size={16} />
                      )}
                    </Logo>
                    <div className="tab-content">
                      <div className="tab-title">{tab.title}</div>
                      <div className="tab-url">
                        {tab.url ? extractDomain(tab.url) : ""}
                      </div>
                    </div>
                    <div className="tab-actions"></div>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Separator />
            </>
          )}

          {(filters.all || filters.bookmark) && bookmarkItems.length > 0 && (
            <>
              <Command.Group heading={"Bookmarks"}>
                {bookmarkItems.map((item, index) => (
                  <Command.Item
                    key={item.id}
                    value={(item.title || "blank") + item.id + index}
                    keywords={[item.title || "", extractDomain(item.url || "")]}
                    onSelect={() => item.url && reopenTab(item.url)}
                  >
                    <Logo>
                      <Earth size={16} />
                    </Logo>
                    <div className="tab-content">
                      <div className="tab-title">{item.title}</div>
                      <div className="tab-url">
                        {item.url ? extractDomain(item.url) : ""}
                      </div>
                    </div>
                    <div className="tab-actions"></div>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Separator />
            </>
          )}

          {(filters.all || filters.history) && historyItems.length > 0 && (
            <Command.Group heading={"History"}>
              {historyItems.map((item, index) => (
                <Command.Item
                  key={item.id}
                  value={(item.title || "blank") + item.id + index}
                  keywords={[item.title || "", extractDomain(item.url || "")]}
                  onSelect={() => item.url && reopenTab(item.url)}
                >
                  <Logo>
                    <Earth size={16} />
                  </Logo>
                  <div className="tab-content">
                    <div className="tab-title">{item.title}</div>
                    <div className="tab-url">
                      {item.url ? extractDomain(item.url) : ""}
                    </div>
                  </div>
                  <div className="tab-actions"></div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {sessionsError && (
            <Command.Item value="error" disabled>
              <p className="error-message">{sessionsError}</p>
            </Command.Item>
          )}
        </Command.List>

        <div cmdk-tab-search-footer="">
          <div cmdk-tab-search-open-trigger="">
            Open Tab
            <kbd>↵</kbd>
          </div>

          <hr />

          <SubCommand
            listRef={listRef}
            selectedValue={searchValue}
            inputRef={inputRef}
            handleNavigateTo={handleUrlNavigation}
            handleSearch={handleSearch}
          />
        </div>
      </Command>
    </div>
  );
};

export function Logo({
  children,
  size = "20px",
}: {
  children: React.ReactNode;
  size?: string;
}) {
  return (
    <div
      className="blurLogo"
      style={{
        width: size,
        height: size,
      }}
    >
      <div className="inner">{children}</div>
    </div>
  );
}

function SubCommand({
  inputRef,
  listRef,
  selectedValue,
  handleNavigateTo,
  handleSearch,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  listRef: React.RefObject<HTMLElement>;
  selectedValue: string;
  handleNavigateTo: (url: string) => void;
  handleSearch: (searchEngine: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function listener(e: globalThis.KeyboardEvent) {
      if (e.key === "o" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
    }

    document.addEventListener("keydown", listener);

    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);

  React.useEffect(() => {
    const el = listRef.current;

    if (!el) return;

    if (open) {
      el.style.overflow = "hidden";
    } else {
      el.style.overflow = "";
    }
  }, [open, listRef]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal>
      <Popover.Trigger
        cmdk-tab-search-subcommand-trigger=""
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        Actions
        <kbd>⌘</kbd>
        <kbd>O</kbd>
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="end"
        className="tab-search-submenu"
        sideOffset={16}
        alignOffset={0}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          inputRef?.current?.focus();
        }}
      >
        <Command>
          <Command.List cmdk-tab-search-submenu-list="">
            <Command.Group heading={"Trigger Actions"}>
              <SubItem
                shortcut="⌘ ↵"
                disabled={!selectedValue}
                onSelect={() => handleSearch("google")}
              >
                <Earth />
                Search web
              </SubItem>
              <SubItem
                shortcut="⌘ ⇧ ↵"
                disabled={!isUrl(selectedValue)}
                onSelect={() => handleNavigateTo(selectedValue)}
              >
                <ArrowRight />
                Open URL
              </SubItem>
            </Command.Group>
          </Command.List>
          <Command.Input placeholder="Search for actions..." />
        </Command>
      </Popover.Content>
    </Popover.Root>
  );
}

function SubItem({
  children,
  shortcut,
  disabled = false,
  onSelect,
}: {
  children: React.ReactNode;
  shortcut: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <Command.Item disabled={disabled} onSelect={onSelect}>
      {children}
      <div cmdk-tab-search-submenu-shortcuts="">
        {shortcut.split(" ").map((key) => {
          return <kbd key={key}>{key}</kbd>;
        })}
      </div>
    </Command.Item>
  );
}

export default Popup;
