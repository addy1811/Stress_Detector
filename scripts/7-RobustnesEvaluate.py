import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import matplotlib.pyplot as plt

FEATURES   = ['hold_duration', 'latency', 'wpm', 'pauses', 'cpm']
N_FEATURES = len(FEATURES)


class KeystrokeLSTM(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 64):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size,
                            num_layers=2, batch_first=True, dropout=0.3)
        self.drop = nn.Dropout(0.3)
        self.fc   = nn.Linear(hidden_size, 1)

    def forward(self, x):
        _, (h_n, _) = self.lstm(x)
        return torch.sigmoid(self.fc(self.drop(h_n[-1])))


def evaluate_robustness(model, X_test, y_test, device):
    noise_levels = np.linspace(0, 0.1, 11)
    accuracies   = []

    model.eval()
    for nl in noise_levels:
        X_noisy = X_test + np.random.normal(0, nl, X_test.shape).astype(np.float32)
        ds      = TensorDataset(torch.tensor(X_noisy), torch.tensor(y_test))
        loader  = DataLoader(ds, batch_size=64)
        correct, total = 0, 0
        with torch.no_grad():
            for Xb, yb in loader:
                Xb, yb = Xb.to(device), yb.to(device)
                preds   = (model(Xb).squeeze(1) >= 0.5).float()
                correct += (preds == yb).sum().item()
                total   += len(yb)
        acc = correct / total
        print(f"Noise {nl:.3f} → accuracy {acc:.4f}")
        accuracies.append(acc)

    plt.figure(figsize=(8, 4))
    plt.plot(noise_levels, accuracies, marker='o')
    plt.title("Model Robustness to Input Noise")
    plt.xlabel("Noise level (stddev)")
    plt.ylabel("Test Accuracy")
    plt.grid(True)
    plt.tight_layout()
    plt.show()


def main():
    device = torch.device('cpu')

    model = KeystrokeLSTM(N_FEATURES)
    model.load_state_dict(torch.load(
        './model/keystroke_lstm_model.pt', map_location=device, weights_only=True))

    X_test = np.load('X_test.npy')
    y_test = np.load('y_test.npy')

    evaluate_robustness(model, X_test, y_test, device)


if __name__ == '__main__':
    main()
