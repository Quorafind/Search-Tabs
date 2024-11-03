import React, { useEffect, useRef } from "react";
import { browser } from "webextension-polyfill-ts";
import { Command } from "cmdk";
import { Play, Pause, X } from "lucide-react";
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

// Create a function to generate default icon DOM element
const createDefaultIconElement = () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "currentColor");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M14.9 7.489A7 7 0 0 0 1.1 7.489a.5.5 0 0 0 .4.6.5.5 0 0 0 .6-.4 6 6 0 0 1 11.8 0 .5.5 0 0 0 .6.4.5.5 0 0 0 .4-.6zM8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
  );

  svg.appendChild(path);
  return svg;
};

// JSX version of default icon (for initial rendering)
const DefaultIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
  >
    <path d="M14.9 7.489A7 7 0 0 0 1.1 7.489a.5.5 0 0 0 .4.6.5.5 0 0 0 .6-.4 6 6 0 0 1 11.8 0 .5.5 0 0 0 .6.4.5.5 0 0 0 .4-.6zM8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
  </svg>
);

const useDarkMode = () => {
  const [isDark, setIsDark] = React.useState(
    window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDark;
};

const Popup: React.FC = () => {
  const isDark = useDarkMode();
  const [openTabs, setOpenTabs] = React.useState<TabItem[]>([]);
  const [recentlyClosedTabs, setRecentlyClosedTabs] = React.useState<TabItem[]>(
    []
  );
  const [sessionsError, setSessionsError] = React.useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.remove("dark");
    if (isDark) {
      document.body.classList.add("dark");
    }
  }, [isDark]);

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
  const activeTabs = openTabs.filter((tab) => !tab.audible);

  return (
    <div className={`tab-search`}>
      <Command>
        <div cmdk-tab-search-top-shine="" />
        <Command.Input ref={inputRef} placeholder="Search tabs..." autoFocus />
        <hr cmdk-tab-search-loader="" />
        <Command.List>
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
                      <img
                        src={tab.favIconUrl}
                        alt=""
                        width={16}
                        height={16}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const iconElement = createDefaultIconElement();
                          e.currentTarget.parentElement?.appendChild(
                            iconElement
                          );
                        }}
                      />
                    ) : (
                      <DefaultIcon />
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
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      width={16}
                      height={16}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const iconElement = createDefaultIconElement();
                        e.currentTarget.parentElement?.appendChild(iconElement);
                      }}
                    />
                  ) : (
                    <DefaultIcon />
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
                      <img
                        src={tab.favIconUrl}
                        alt=""
                        width={16}
                        height={16}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const iconElement = createDefaultIconElement();
                          e.currentTarget.parentElement?.appendChild(
                            iconElement
                          );
                        }}
                      />
                    ) : (
                      <DefaultIcon />
                    )}
                  </Logo>
                  <div className="tab-content">
                    <div className="tab-title">{tab.title}</div>
                    <div className="tab-url">
                      {tab.url ? extractDomain(tab.url) : ""}
                    </div>
                  </div>
                  <div className="tab-actions">
                  </div>
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
