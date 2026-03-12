
import os
import numpy as np
import torch
import torch.nn as nn
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

FEATURES_FINAL = [
    'hold_duration', 'latency', 'wpm', 'pauses', 'cpm', 'error_rate',
    'wpm_delta', 'hold_delta', 'latency_delta'
]
N_FEATURES  = len(FEATURES_FINAL)   # 9
WINDOW_SIZE = 50


class KeystrokeLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=32, temperature=2.0):
        super().__init__()
        self.temperature = temperature
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers=1, batch_first=True)
        self.drop = nn.Dropout(0.5)
        self.bn   = nn.BatchNorm1d(hidden_size)
        self.fc   = nn.Linear(hidden_size, 1)

    def forward(self, x):
        _, (h, _) = self.lstm(x)
        return torch.sigmoid(self.fc(self.drop(self.bn(h[-1]))).squeeze(1) / self.temperature)


# <<<<<<<<<<<<<<<     Load        >>>>>>>>>>>>>>>>
BASE        = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(BASE, 'keystroke_lstm_model.pt')
SCALER_PATH = os.path.join(BASE, 'scaler.pkl')
CONFIG_PATH = os.path.join(BASE, 'model_config.pkl')

device      = torch.device('cpu')
temperature = 2.0

if os.path.exists(CONFIG_PATH):
    cfg         = joblib.load(CONFIG_PATH)
    temperature = cfg.get('temperature', 2.0)
    lopo        = cfg.get('lopo_accuracy', 'unknown')
    print(f" Config loaded — temperature={temperature}  LOPO_acc={lopo}")

model = KeystrokeLSTM(input_size=N_FEATURES, temperature=temperature)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=True))
model.eval()
print(f" Model loaded  — {MODEL_PATH}  ({N_FEATURES} features)")

scaler = joblib.load(SCALER_PATH)
print(f" Scaler loaded — {SCALER_PATH}")


# <<<<<<<<<<<<<<<<   Routes    >>>>>>>>>>>>>>>
@app.route('/predict', methods=['POST'])
def predict():
    data = request.json.get("features")

    if not data:
        return jsonify({"error": "No features provided"}), 400

    n_sent = len(data[0]) if data else 0
    if n_sent != N_FEATURES:
        return jsonify({
            "error": f"Expected {N_FEATURES} features, got {n_sent}",
            "expected": FEATURES_FINAL
        }), 400

    arr = np.array(data, dtype=np.float32)

    # Pad or trim to WINDOW_SIZE
    if len(arr) < WINDOW_SIZE:
        pad = np.zeros((WINDOW_SIZE - len(arr), N_FEATURES), dtype=np.float32)
        arr = np.vstack([pad, arr])
    else:
        arr = arr[-WINDOW_SIZE:]

    arr_scaled = scaler.transform(arr).astype(np.float32)
    tensor     = torch.tensor(arr_scaled).unsqueeze(0)

    with torch.no_grad():
        prob = float(model(tensor).item())

    label = "stressed" if prob >= 0.5 else "relaxed"
    return jsonify({"stress_prob": round(prob, 4), "label": label})


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "running", "features": FEATURES_FINAL,
                    "n_features": N_FEATURES, "temperature": temperature})


if __name__ == '__main__':
    app.run(debug=True)
