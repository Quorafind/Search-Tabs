import React, { useEffect, useRef } from "react";
import { browser } from "webextension-polyfill-ts";
import { Command } from "cmdk";
import { Play, Pause, X, Earth } from "lucide-react";
import "./styles.scss";

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

// Add this helper function to extract domain from URL
const extractDomain = (url: string) => {
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
  const [sessionsError, setSessionsError] = React.useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Get open tabs
  const fetchOpenTabs = async () => {
    const tabs = await browser.tabs.query({});
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

  React.useEffect(() => {
    fetchOpenTabs();
    fetchRecentlyClosedTabs();
  }, []);

  const mediaTabs = openTabs.filter((tab) => tab.audible);
  const activeTabs = openTabs.filter((tab) => !tab.audible && !tab.active);

  return (
    <div className={`tab-search`}>
      <Command>
        <div cmdk-tab-search-top-shine="" />
        <Command.Input
          ref={inputRef}
          placeholder="Search tabs..."
          autoFocus
          inputMode="search"
          onValueChange={() => {
            // Reset scroll position when search value changes
            if (listRef.current) {
              listRef.current.scrollTop = 0;
            }
          }}
        />
        <hr cmdk-tab-search-loader="" />
        <Command.List ref={listRef}>
          <Command.Empty>No matching tabs found</Command.Empty>

          {mediaTabs.length > 0 && (
            <Command.Group heading="Media Tabs">
              {mediaTabs.map((tab, index) => (
                <Command.Item
                  className="media-tab-item"
                  key={tab.id}
                  value={tab.title + tab.id + index}
                  keywords={[tab.url || ""]}
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

          <Command.Group heading="Opened Tabs">
            {activeTabs.map((tab, index) => (
              <Command.Item
                key={tab.id}
                value={tab.title + tab.id + index}
                keywords={[tab.url || ""]}
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

          {!sessionsError && (
            <Command.Group heading="Recently Closed Tabs">
              {recentlyClosedTabs.map((tab, index) => (
                <Command.Item
                  key={index}
                  value={tab.title + tab.id + index}
                  keywords={[tab.url || ""]}
                  onSelect={() => tab.url && reopenTab(tab.url)}
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

export default Popup;
