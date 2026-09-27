"""Typed failures for the optional Playwright collection foundation."""


class PlaywrightFoundationError(Exception):
    """Base error for the Playwright foundation."""


class PlaywrightDisabledError(PlaywrightFoundationError):
    """Raised when collection is requested while Playwright is disabled."""


class PlaywrightUnavailableError(PlaywrightFoundationError):
    """Raised when the optional Playwright package is not installed."""


class BrowserLaunchError(PlaywrightFoundationError):
    """Raised when the configured browser cannot be started."""


class BrowserCrashedError(PlaywrightFoundationError):
    """Raised when a browser process crashes during collection."""


class NavigationError(PlaywrightFoundationError):
    """Raised when navigation fails or leaves the configured source domains."""


class NavigationTimeoutError(NavigationError):
    """Raised when navigation exceeds the configured timeout."""


class SourceBlockedError(PlaywrightFoundationError):
    """Raised when a source rejects automation or presents a policy block."""


class ConcurrencyLimitError(PlaywrightFoundationError):
    """Raised when a caller requests work beyond configured capacity."""


class BrowserManagerClosedError(PlaywrightFoundationError):
    """Raised when work is submitted after a manager has been closed."""