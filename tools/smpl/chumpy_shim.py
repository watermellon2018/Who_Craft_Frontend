"""Minimal `chumpy` stand-in so the SMPL ``.pkl`` files unpickle without the
real (Python-2-era) chumpy package.

The official SMPL model files store a few arrays — notably ``shapedirs`` — as
``chumpy.Ch`` objects. ``chumpy`` is unmaintained and only installs on old
Python/NumPy; the project's pin forbids dragging it in. But we never need
chumpy's autodiff machinery: we only want the underlying value array, which
chumpy pickles under ``x`` in the instance ``__dict__``.

So we register a tiny module tree named ``chumpy`` whose ``Ch`` is a plain
object (NOT an ``ndarray`` subclass — the files pickle Ch via the old-style
``copyreg._reconstructor``, which rejects ndarray subclasses). After unpickling,
:func:`as_array` pulls the captured value out of any Ch instance.

Import this module BEFORE ``pickle.load`` on an SMPL file. Deterministic and
side-effect-free beyond the module registration.
"""
from __future__ import annotations

import sys
import types

import numpy as np


class Ch:
    """Plain placeholder for ``chumpy.Ch``; captures its pickled state."""

    def __setstate__(self, state) -> None:  # noqa: ANN001 - pickle protocol
        if isinstance(state, dict):
            self.__dict__.update(state)

    @property
    def x_array(self):
        """The materialised value array chumpy stored under ``x`` (or None)."""
        value = self.__dict__.get("x")
        return None if value is None else np.asarray(value)


def as_array(value):
    """Return a plain ``np.ndarray`` for either a real array or a shim ``Ch``."""
    if isinstance(value, Ch):
        arr = value.x_array
        if arr is None:
            raise ValueError("chumpy Ch had no 'x' value array to extract")
        return arr
    return np.asarray(value)


def install() -> None:
    """Register the fake ``chumpy`` module tree on ``sys.modules`` (idempotent)."""
    if isinstance(sys.modules.get("chumpy"), types.ModuleType) and getattr(
        sys.modules["chumpy"], "_smpl_shim", False
    ):
        return
    chumpy = types.ModuleType("chumpy")
    chumpy._smpl_shim = True  # type: ignore[attr-defined]
    chumpy.Ch = Ch  # type: ignore[attr-defined]
    sys.modules["chumpy"] = chumpy
    # Submodules the SMPL pickles reference by dotted path.
    for sub in ("ch", "reordering", "utils", "optimization", "ch_ops"):
        module = types.ModuleType(f"chumpy.{sub}")
        module.Ch = Ch  # type: ignore[attr-defined]
        sys.modules[f"chumpy.{sub}"] = module
