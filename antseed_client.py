"""Antseed transport and free-offer discovery, adapted from the issue-workbench study."""

from __future__ import annotations
import json
import os
import socket
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = os.environ.get("ANTSEED_BASE_URL", "http://127.0.0.1:8377").rstrip("/")
KEY_FILE = os.environ.get("ANTSEED_KEY_FILE")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AntseedError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        action: str = "Refresh offers and try again.",
        status: int = 502,
        details: dict | None = None,
    ):
        super().__init__(message)
        self.code, self.message, self.action = code, message, action
        self.status, self.details = status, details or {}

    def public(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "action": self.action,
            "details": self.details,
        }


def api_key() -> str | None:
    if KEY_FILE:
        try:
            return json.loads(Path(KEY_FILE).read_text())["apiKey"]
        except (OSError, ValueError, KeyError) as error:
            raise AntseedError(
                "key_configuration",
                "The configured gateway key file could not be read.",
                "Check ANTSEED_KEY_FILE or supply ANTSEED_API_KEY on the local server.",
            ) from error
    return os.environ.get("ANTSEED_API_KEY")


def upstream_error(status: int, data: dict) -> AntseedError:
    error = data.get("error", {})
    if not isinstance(error, dict):
        error = {"message": str(error)}
    code = error.get("code") or f"http_{status}"
    if code == "spend_limit_reached":
        return AntseedError(
            code,
            "The gateway blocked this request under its spending limit.",
            "A temporary hold can exceed a small key limit even with $0 spent. Wait for holds to settle, or review the limit with the gateway owner. A hold is not a charge.",
            402,
            error.get("limit") or {},
        )
    if status == 401:
        return AntseedError(
            code,
            "The gateway did not accept the API key.",
            "Set a valid ANTSEED_API_KEY on the local server, then refresh offers.",
            401,
        )
    if status == 429:
        return AntseedError(
            code,
            "This provider is temporarily rate limited.",
            "Try another eligible free offer, or wait before retrying.",
            429,
        )
    return AntseedError(
        code, error.get("message") or f"Antseed returned HTTP {status}.", status=status
    )


def antseed_request(path: str, payload: dict | None = None) -> tuple[dict, dict]:
    headers = {"Content-Type": "application/json"}
    if key := api_key():
        headers["Authorization"] = "Bearer " + key
    request = urllib.request.Request(
        BASE_URL + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers=headers,
        method="POST" if payload is not None else "GET",
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw, status, response_headers = (
                response.read(),
                response.status,
                response.headers,
            )
    except urllib.error.HTTPError as error:
        raw, status, response_headers = error.read(), error.code, error.headers
    except (urllib.error.URLError, TimeoutError, socket.timeout) as error:
        timeout = isinstance(error, (TimeoutError, socket.timeout)) or isinstance(
            getattr(error, "reason", None), (TimeoutError, socket.timeout)
        )
        raise AntseedError(
            "timeout" if timeout else "connection_failed",
            (
                "The provider did not answer within 60 seconds."
                if timeout
                else "The local Antseed connection is unavailable."
            ),
            (
                "Try another eligible free offer."
                if timeout
                else "Start your Antseed buyer or gateway, check ANTSEED_BASE_URL, then refresh offers."
            ),
        ) from error
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as error:
        raise AntseedError(
            "invalid_response", "Antseed returned a response this app could not read."
        ) from error
    if not isinstance(data, dict):
        raise AntseedError(
            "invalid_response", "Antseed returned an unexpected response format."
        )
    if status != 200:
        raise upstream_error(status, data)
    return data, {
        "status": status,
        "seconds": round(time.monotonic() - started, 2),
        "peer": response_headers.get("x-antseed-peer-id"),
        "model": data.get("model"),
        "usage": data.get("usage"),
    }


def eligible_offers(catalog: dict) -> list[dict]:
    offers = {}
    for model in catalog.get("data", []):
        if model.get("type") != "text":
            continue
        for peer in model.get("peers", []):
            tier = (peer.get("freeTier") or {}).get("base") or {}
            protocols = peer.get("protocols") or [peer.get("protocol")]
            categories = set(peer.get("categories") or [])
            if (
                peer.get("inputUsdPerMillion") != 0
                or peer.get("outputUsdPerMillion") != 0
                or peer.get("reputationScore", 0) < 60
                or tier.get("stakersOnly")
                or not peer.get("peerId")
                or "openai-chat-completions" not in protocols
                or (
                    categories
                    and not categories.intersection(
                        {"chat", "tasks", "coding", "reasoning", "agents"}
                    )
                )
            ):
                continue
            route = f"{peer['peerId']}@{model['id']}"
            offers[route] = {
                "id": route,
                "model": model["id"],
                "peer": peer["peerId"],
                "service_id": peer.get("serviceId"),
                "max_output_tokens": (peer.get("capabilities") or {}).get(
                    "maxOutputTokens"
                ),
                "provider": peer.get("displayName") or peer["peerId"][:10],
                "reputation": round(peer["reputationScore"], 1),
                "accepts_image": "image"
                in ((peer.get("capabilities") or {}).get("inputs") or []),
                "input_usd_per_million": 0,
                "output_usd_per_million": 0,
            }
    return sorted(offers.values(), key=lambda offer: (offer["model"], offer["peer"]))


def ranked(offers: list[dict], preferences: tuple[str, ...]) -> list[dict]:
    def preference(offer):
        names = {offer["model"], offer.get("service_id")}
        return min(
            (preferences.index(name) for name in names if name in preferences),
            default=len(preferences),
        )

    return sorted(
        offers, key=lambda offer: (preference(offer), -offer["reputation"], offer["id"])
    )
