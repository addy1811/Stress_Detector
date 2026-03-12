import os
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset, random_split
from sklearn.preprocessing import StandardScaler
import joblib
 
FEATURES = [
    'hold_duration', 'latency', 'wpm', 'pauses', 'cpm', 'error_rate',
    'wpm_delta', 'hold_delta', 'latency_delta'
]
WINDOW_SIZE  = 50
STRIDE       = 10
EPOCHS       = 60
BATCH        = 16
LR           = 5e-4
TEMPERATURE  = 2.0
LABEL_SMOOTH = 0.15
CSV_PATH     = './data/keystroke_proper.csv'
MODEL_DIR    = './model'
 
def load_dataset() -> pd.DataFrame:
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"'{CSV_PATH}' not found.\n"
        )
 
    df = pd.read_csv(CSV_PATH)
 
    missing = [c for c in FEATURES + ['person_id', 'session_type', 'press_time']
               if c not in df.columns]
    if missing:
        raise ValueError(f"keystroke_proper.csv is missing columns: {missing}")
 
    print(f"✅ Loaded {CSV_PATH}")
    print(f"   {len(df)} rows | {df['person_id'].nunique()} people | "
          f"relaxed={(df['session_type']=='relaxed').sum()} | "
          f"stressed={(df['session_type']=='stressed').sum()}")
    return df
 
 
#    <<<<<<<<<<<<<<<       Sliding windows >>>>>>>>>>>>>>>>>>>>
def make_windows(sub_df, scaler=None, fit_scaler=True):
    X_list, y_list, p_list = [], [], []
 
    for (pid, stype), grp in sub_df.groupby(['person_id', 'session_type']):
        grp  = grp.sort_values('press_time').reset_index(drop=True)
        vals = grp[FEATURES].values.astype(np.float32)
        lbl  = 1.0 if stype == 'stressed' else 0.0
        for s in range(0, len(vals) - WINDOW_SIZE + 1, STRIDE):
            X_list.append(vals[s : s + WINDOW_SIZE])
            y_list.append(lbl)
            p_list.append(pid)
 
    if not X_list:
        empty = np.zeros((0, WINDOW_SIZE, len(FEATURES)), np.float32)
        return empty, np.zeros(0, np.float32), [], scaler or StandardScaler()
 
    X = np.stack(X_list)
    y = np.array(y_list, np.float32)
    N, W, F = X.shape
 
    if scaler is None:
        scaler = StandardScaler()
    if fit_scaler:
        X = scaler.fit_transform(X.reshape(-1, F)).reshape(N, W, F).astype(np.float32)
    else:
        X = scaler.transform(X.reshape(-1, F)).reshape(N, W, F).astype(np.float32)
 
    return X, y, p_list, scaler
 
 
# <<<<<<<<<<<<<<<<<      Model      >>>>>>>>>>>>>>>
class KeystrokeLSTM(nn.Module):
    def __init__(self, input_size, hidden=32, temp=2.0):
        super().__init__()
        self.temp = temp
        self.lstm = nn.LSTM(input_size, hidden, num_layers=1, batch_first=True)
        self.drop = nn.Dropout(0.5)
        self.bn   = nn.BatchNorm1d(hidden)
        self.fc   = nn.Linear(hidden, 1)
 
    def forward(self, x):
        _, (h, _) = self.lstm(x)
        return torch.sigmoid(self.fc(self.drop(self.bn(h[-1]))).squeeze(1) / self.temp)
 
 
class SmoothBCE(nn.Module):
    def __init__(self, s=0.15):
        super().__init__()
        self.s = s
 
    def forward(self, pred, target):
        t = target * (1 - self.s) + (1 - target) * self.s
        return nn.functional.binary_cross_entropy(pred, t)
 
 
# <<<<<<<<<<<<<<<<<<     Training loop  >>>>>>>>>>>>>>>>>>>
def train_model(X, y, device, epochs=EPOCHS):
    ds  = TensorDataset(torch.tensor(X), torch.tensor(y))
    vn  = max(2, int(0.15 * len(ds)))
    tds, vds = random_split(ds, [len(ds) - vn, vn],
                            generator=torch.Generator().manual_seed(42))
 
    tl = DataLoader(tds, BATCH, shuffle=True, drop_last=True)
    vl = DataLoader(vds, BATCH)
 
    model = KeystrokeLSTM(X.shape[2], temp=TEMPERATURE).to(device)
    crit  = SmoothBCE(LABEL_SMOOTH)
    opt   = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-3)
    sch   = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
 
    best, best_state, patience = 1e9, None, 0
 
    for ep in range(1, epochs + 1):
        model.train()
        for Xb, yb in tl:
            Xb, yb = Xb.to(device), yb.to(device)
            opt.zero_grad()
            crit(model(Xb), yb).backward()
            nn.utils.clip_grad_norm_(model.parameters(), 0.5)
            opt.step()
        sch.step()
 
        model.eval()
        vl_loss, tot = 0.0, 0
        with torch.no_grad():
            for Xb, yb in vl:
                Xb, yb = Xb.to(device), yb.to(device)
                vl_loss += crit(model(Xb), yb).item() * len(yb)
                tot     += len(yb)
        vl_loss /= tot
 
        if vl_loss < best:
            best, best_state, patience = vl_loss, model.state_dict(), 0
        else:
            patience += 1
            if patience >= 10:
                break
 
    model.load_state_dict(best_state)
    return model
 
 
def evaluate(model, X, y, device):
    model.eval()
    loader = DataLoader(TensorDataset(torch.tensor(X), torch.tensor(y)), BATCH)
    probs, correct, total = [], 0, 0
    with torch.no_grad():
        for Xb, yb in loader:
            Xb, yb = Xb.to(device), yb.to(device)
            p = model(Xb)
            probs.extend(p.cpu().numpy())
            correct += ((p >= 0.5).float() == yb).sum().item()
            total   += len(yb)
    return np.array(probs), correct / total
 
 
# <<<<<<<<<<<<<<<<<<<<     Leave-One-Person-Out >>>>>>>>>>>>>
def lopo_cv(df, device):
    persons   = sorted(df['person_id'].unique())
    fold_accs = []
 
    print(f"\n{'='*65}")
    print(f"LEAVE-ONE-PERSON-OUT CV  ({len(persons)} folds)")
    print(f"Train on {len(persons)-1} people → test on unseen person → rotate")
    print(f"{'='*65}")
 
    for pid in persons:
        Xtr, ytr, _, sc = make_windows(df[df['person_id'] != pid], fit_scaler=True)
        Xte, yte, _, _  = make_windows(df[df['person_id'] == pid], scaler=sc, fit_scaler=False)
 
        if len(Xtr) < 4 or len(Xte) < 2:
            print(f"  {pid}: skipped (too few windows)")
            continue
 
        model      = train_model(Xtr, ytr, device, epochs=30)
        probs, acc = evaluate(model, Xte, yte, device)
        fold_accs.append(acc)
 
        r_avg = probs[yte == 0].mean() if (yte == 0).any() else float('nan')
        s_avg = probs[yte == 1].mean() if (yte == 1).any() else float('nan')
        print(f"  {pid}: acc={acc:.3f}  "
              f"relaxed_pred={r_avg:.2f}  stressed_pred={s_avg:.2f}")
 
    mean = np.mean(fold_accs) if fold_accs else 0.0
    print(f"\n  LOPO mean accuracy = {mean:.3f}  (random baseline = 0.500)")
    return mean
 
 
# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}")
    os.makedirs(MODEL_DIR, exist_ok=True)

    df = load_dataset()
 
    print("\n=== PER-PERSON SIGNAL SEPARABILITY ===")
    print(f"  {'Person':<8} {'wpm':>8}  {'hold':>8}  {'latency':>10}  {'error':>9}")
    for pid in sorted(df['person_id'].unique()):
        r = df[(df['person_id'] == pid) & (df['session_type'] == 'relaxed')]
        s = df[(df['person_id'] == pid) & (df['session_type'] == 'stressed')]
        print(f"  {pid:<8} "
              f"{s['wpm'].mean()           - r['wpm'].mean():>+8.1f}  "
              f"{s['hold_duration'].mean() - r['hold_duration'].mean():>+8.4f}  "
              f"{s['latency'].mean()       - r['latency'].mean():>+10.4f}  "
              f"{s['error_rate'].mean()    - r['error_rate'].mean():>+9.4f}")
 
    lopo_acc = lopo_cv(df, device)
 
    print(f"\n{'='*65}")
    print("Final Model — all people")
    print(f"{'='*65}")
    X_all, y_all, _, scaler = make_windows(df, fit_scaler=True)
    print(f"Windows: {len(X_all)}  "
          f"relaxed={(y_all==0).sum()}  stressed={(y_all==1).sum()}")
 
    final_model = train_model(X_all, y_all, device, epochs=EPOCHS)
    probs, acc  = evaluate(final_model, X_all, y_all, device)
    print(f"\nTrain accuracy : {acc:.4f}")
    print(f"Prob range     : min={probs.min():.3f}  max={probs.max():.3f}  "
          f"mean={probs.mean():.3f}  std={probs.std():.3f}")
 
    # <<<<<<<<<<<  Save    >>>>>>>>>
    joblib.dump(scaler, f'{MODEL_DIR}/scaler.pkl')
    torch.save(final_model.state_dict(), f'{MODEL_DIR}/keystroke_lstm_model.pt')
    joblib.dump({
        'temperature':   TEMPERATURE,
        'lopo_accuracy': float(lopo_acc),
        'features':      FEATURES,
        'n_features':    len(FEATURES),
    }, f'{MODEL_DIR}/model_config.pkl')
 
    np.save('X_test.npy', X_all[-max(1, len(X_all) // 5):])
    np.save('y_test.npy', y_all[-max(1, len(y_all) // 5):])
 
    print(f"\n  {MODEL_DIR}/keystroke_lstm_model.pt")
    print(f" {MODEL_DIR}/scaler.pkl")
    print(f"  {MODEL_DIR}/model_config.pkl")
    print(f"\nLOPO accuracy: {lopo_acc:.3f}")
 
    if lopo_acc < 0.60:
        print("\n  Near-chance — model struggles to generalise across people.")
        print("   Frontend rule-based scorer will compensate.")
    elif lopo_acc < 0.75:
        print("\n Moderate — hybrid scorer will boost real-world performance.")
    else:
        print("\n  Good generalisation — model works for new users.")
 
 
if __name__ == '__main__':
    main()