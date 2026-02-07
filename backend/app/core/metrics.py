from __future__ import annotations

from typing import Union

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(mean_absolute_error(y_true, y_pred))


def parse_test_size(value: Union[str, int, float], n_rows: int) -> int:
    if isinstance(value, (int, float)):
        if isinstance(value, float) and 0 < value < 1:
            return max(1, int(round(n_rows * value)))
        weeks = int(value)
        return max(1, min(weeks, n_rows - 1))

    try:
        frac = float(value)
        if 0 < frac < 1:
            return max(1, int(round(n_rows * frac)))
    except ValueError:
        pass

    try:
        weeks = int(value)
        return max(1, min(weeks, n_rows - 1))
    except ValueError as exc:
        raise ValueError("test_size must be a fraction or integer weeks") from exc
