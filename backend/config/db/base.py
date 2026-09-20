import ipaddress
import socket
import subprocess
import time

from django.db.backends.postgresql.base import DatabaseWrapper as PostgreSQLDatabaseWrapper

DNS_ERROR_MARKERS = (
    "failed to resolve host",
    "nodename nor servname provided",
    "name or service not known",
    "temporary failure in name resolution",
    "could not translate host name",
    "could not resolve host",
)

MAX_ATTEMPTS = 4
BACKOFF_SECONDS = 2

# Cache of {host: (ipv4, fetched_at)} so a DNS outage does not spawn a `dig`
# process for every single connection attempt.
_HOST_IP_CACHE = {}
HOST_IP_CACHE_TTL = 600


def _is_dns_error(exc):
    message = str(exc).lower()
    return any(marker in message for marker in DNS_ERROR_MARKERS)


def _is_ipv4(text):
    try:
        ipaddress.IPv4Address(text.strip())
        return True
    except ipaddress.AddressValueError:
        return False


def _dig_ipv4(host):
    # macOS's unified resolver (mDNSResponder) intermittently returns SERVFAIL
    # for a hostname that the upstream DNS server resolves fine. `dig` talks to
    # the resolver directly and keeps working in that case, so use it to bypass
    # the broken application-level lookup.
    cached = _HOST_IP_CACHE.get(host)
    if cached and time.monotonic() - cached[1] < HOST_IP_CACHE_TTL:
        return cached[0]
    try:
        result = subprocess.run(
            ["dig", "+short", "+time=5", "+tries=2", host, "A"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception:
        return None
    ip = next((line.strip() for line in result.stdout.splitlines() if _is_ipv4(line)), None)
    if ip:
        _HOST_IP_CACHE[host] = (ip, time.monotonic())
    return ip


class DatabaseWrapper(PostgreSQLDatabaseWrapper):
    """PostgreSQL backend that survives transient DNS resolution failures.

    The managed Neon database hostname intermittently returns SERVFAIL through
    the system resolver on some networks. Connections are retried a few times,
    and if the OS resolver stays broken the hostname is resolved via `dig` and
    the connection is made straight to that IP (hostaddr) instead.
    """

    def get_new_connection(self, conn_params):
        attempts = 0
        host = conn_params.get("host")
        while True:
            attempts += 1
            try:
                return super().get_new_connection(conn_params)
            except self.Database.OperationalError as exc:
                dns_failure = _is_dns_error(exc)

                # Broken OS resolver: resolve via `dig` and connect to the IP
                # directly, bypassing getaddrinfo/mDNSResponder.
                if dns_failure and host and "hostaddr" not in conn_params:
                    ip = _dig_ipv4(host)
                    if ip:
                        conn_params["hostaddr"] = ip
                        continue

                if not dns_failure:
                    raise
                if attempts >= MAX_ATTEMPTS:
                    raise
                time.sleep(BACKOFF_SECONDS * attempts)