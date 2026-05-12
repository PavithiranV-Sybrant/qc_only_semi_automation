"""
Sliding-window rate limiter for Groq API.
openai/gpt-oss-120b: 30 RPM, 6K TPM, no TPD limit.
"""
import time
import threading
from collections import deque
from datetime import datetime, date
from typing import Optional


GROQ_LIMITS = {
    "openai/gpt-oss-120b":   {"rpm": 30, "tpm": 6_000,  "tpd": None},
    "openai/gpt-oss-20b":    {"rpm": 30, "tpm": 6_000,  "tpd": None},
    "llama-3.3-70b-versatile": {"rpm": 30, "tpm": 12_000, "tpd": 100_000},
    "llama-3.1-8b-instant":  {"rpm": 30, "tpm": 6_000,  "tpd": 500_000},
    "groq/compound":         {"rpm": 30, "tpm": 70_000, "tpd": None},
}
_DEFAULT = {"rpm": 30, "tpm": 6_000, "tpd": None}


class RateLimitExhausted(Exception):
    pass


class RateLimiter:
    def __init__(self, rpm: int, tpm: int, tpd: Optional[int] = None):
        self.rpm = rpm
        self.tpm = tpm
        self.tpd = tpd
        self._lock = threading.Lock()
        self._req_window: deque = deque()
        self._tok_window: deque = deque()
        self._daily_tokens = 0
        self._daily_date: date = datetime.now().date()

    def wait_if_needed(self, estimated_tokens: int = 300) -> None:
        while True:
            with self._lock:
                self._evict_old()
                self._check_daily_reset()
                if self.tpd and (self._daily_tokens + estimated_tokens) > self.tpd:
                    raise RateLimitExhausted("Daily token limit reached.")
                rpm_ok = len(self._req_window) < self.rpm
                tpm_ok = self._window_tokens() + estimated_tokens <= self.tpm
                if rpm_ok and tpm_ok:
                    self._req_window.append(time.monotonic())
                    return
                sleep_s = self._next_slot_in(estimated_tokens)
            time.sleep(min(sleep_s, 5.0))

    def record_usage(self, actual_tokens: int) -> None:
        with self._lock:
            self._check_daily_reset()
            self._tok_window.append((actual_tokens, time.monotonic()))
            self._daily_tokens += actual_tokens

    def get_status(self) -> dict:
        with self._lock:
            self._evict_old()
            return {
                "rpm_used": len(self._req_window),
                "rpm_limit": self.rpm,
                "tpm_used": self._window_tokens(),
                "tpm_limit": self.tpm,
            }

    def _evict_old(self):
        cutoff = time.monotonic() - 60.0
        while self._req_window and self._req_window[0] < cutoff:
            self._req_window.popleft()
        while self._tok_window and self._tok_window[0][1] < cutoff:
            self._tok_window.popleft()

    def _window_tokens(self) -> int:
        return sum(t for t, _ in self._tok_window)

    def _check_daily_reset(self):
        today = datetime.now().date()
        if today != self._daily_date:
            self._daily_tokens = 0
            self._daily_date = today

    def _next_slot_in(self, estimated_tokens: int) -> float:
        now = time.monotonic()
        waits = []
        if len(self._req_window) >= self.rpm and self._req_window:
            waits.append(60.0 - (now - self._req_window[0]))
        temp = self._window_tokens()
        for tok, ts in self._tok_window:
            if temp + estimated_tokens <= self.tpm:
                break
            temp -= tok
            waits.append(60.0 - (now - ts))
        return max(0.1, min(waits)) if waits else 1.0


def make_rate_limiter(model: str) -> RateLimiter:
    limits = GROQ_LIMITS.get(model, _DEFAULT)
    return RateLimiter(rpm=limits["rpm"], tpm=limits["tpm"], tpd=limits.get("tpd"))
