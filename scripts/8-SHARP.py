import numpy as np
import torch
import torch.nn as nn
import matplotlib.pyplot as plt
from scipy.stats import pearsonr

FEATURES   = ['hold_duration', 'latency', 'wpm', 'pauses', 'cpm']
N_FEATURES = len(FEATURES)
WINDOW_SIZE = 50


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


def main():
    X_test = np.load('X_test.npy')  
    y_test = np.load('y_test.npy')  

    device = torch.device('cpu')
    model  = KeystrokeLSTM(N_FEATURES)
    model.load_state_dict(torch.load(
        './model/keystroke_lstm_model.pt', map_location=device, weights_only=True))
    model.eval()

    with torch.no_grad():
        y_pred = model(torch.tensor(X_test)).squeeze(1).numpy()

    X_agg = X_test.mean(axis=1)  

    corr_labels, corr_preds = [], []
    for i in range(N_FEATURES):
        corr_labels.append(pearsonr(X_agg[:, i], y_test)[0])
        corr_preds.append( pearsonr(X_agg[:, i], y_pred)[0])

    x_pos = np.arange(N_FEATURES)
    plt.figure(figsize=(10, 5))
    plt.bar(x_pos - 0.15, corr_labels, width=0.3, label='With True Labels')
    plt.bar(x_pos + 0.15, corr_preds,  width=0.3, label='With Model Predictions')
    plt.xticks(x_pos, FEATURES)
    plt.ylabel("Pearson Correlation")
    plt.title("Feature Correlation with True Labels vs Model Predictions")
    plt.legend()
    plt.tight_layout()
    plt.show()


if __name__ == '__main__':
    main()
