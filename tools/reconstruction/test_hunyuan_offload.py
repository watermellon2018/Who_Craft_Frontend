"""Regression test for the pinned Hunyuan CPU-offload adapter."""

from types import SimpleNamespace
import unittest

import run_hunyuan_multiview as benchmark


class CpuOffloadCompatibilityTests(unittest.TestCase):
    def test_missing_components_contract_is_populated(self) -> None:
        calls = []
        pipeline = SimpleNamespace(
            conditioner=object(),
            model=object(),
            vae=object(),
        )
        pipeline.enable_model_cpu_offload = lambda **kwargs: calls.append(kwargs)

        benchmark._enable_cpu_offload(pipeline)

        self.assertEqual(
            set(pipeline.components),
            {"conditioner", "model", "vae"},
        )
        self.assertEqual(calls, [{"device": "cuda"}])


if __name__ == "__main__":
    unittest.main()
