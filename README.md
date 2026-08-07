# Keystroke Stress Monitor ⌨️🧠

*Your typing already tells the story — this just reads it back to you.*

A real-time stress-detection tool that watches *how* you type — not what you type — and turns keystroke timing into a live cognitive-load readout. No wearables, no camera, no sensors: just a text box, a trained LSTM, and a rule-based scorer that reacts before the model even finishes loading.

Built as a Flask + PyTorch backend with a React/Vite frontend.

---

## What it does

- **Two scorers, blended live** — a hybrid score combines a fast rule-based scorer (75% weight) with a person-agnostic LSTM classifier (25% weight), so the UI stays responsive even before the model has anything meaningful to say.
- **Personal baseline calibration** — a 15-second "type relaxed" calibration step learns *your* normal WPM, hold time, and latency, so stress is measured as a deviation from you specifically, not a fixed global threshold.
- **Graceful model fallback** — if the Flask API is unreachable, the frontend automatically drops to rules-only scoring and shows a visible "Model offline" notice instead of breaking.
- **Live reactive background** — a hand-written WebGL/GLSL shader shifts color (cyan → red) and animation speed in real time as your stress score changes.
- **Signal transparency** — a breakdown panel shows exactly which signals (error rate, speed deviation, rhythm irregularity) are driving the current score, not just a single opaque number.
- **Idle detection** — the score clears itself if you stop typing for 15 seconds, so a stale reading never lingers on screen.
- **Full model-development pipeline included** — EDA, cross-validation, leakage checks, hyperparameter tuning, feature selection, LSTM training with Leave-One-Person-Out validation, robustness testing, and feature-correlation analysis, all as standalone runnable scripts.

---

## Tech stack

**Backend**
- Python 3, Flask + Flask-CORS
- PyTorch (LSTM inference)
- scikit-learn, joblib (scaler + config persistence)
- Model dev pipeline: pandas, matplotlib, seaborn, scipy

**Frontend**
- React 19 + Vite 7
- Axios for API calls
- Chart.js (`react-chartjs-2`) for feature-trend plots
- Raw WebGL + GLSL for the animated shader background (no Three.js/library dependency)
- Plain inline-style theming (`styles.js`) — glassmorphism cards, a shared stress-color scale

**Infra**
- Backend: any Python host capable of running Flask (dev server via `python app.py`; use gunicorn/uWSGI for production)
- Frontend: static build via `vite build`, deployable to Vercel/Netlify/any static host

---

## How the hybrid score actually works

This is worth explaining because it's the core design decision of the project.

Keystroke-stress LSTMs trained via Leave-One-Person-Out cross-validation tend to generalize only moderately to brand-new people — stress "looks" different across individuals. Rather than trust the model outright, `stressScorer.js` treats it as a **minority signal**:

- **`RealTimeTypingBox`** batches raw `keydown`/`keyup` events every 3 seconds and hands them to `App.jsx`.
- **`featureEngine.js`** turns that batch into two things: a 9-feature-per-timestep window (`extractFeatures`, sent to the model) and a set of session-level summary metrics (`extractMetrics`, used for rules).
- **`stressScorer.js`** maintains an EWMA baseline (`α = 0.05` once warmed up, `0.15` during warm-up) of your WPM, hold time, latency CV, and pause rate from your *own* typing history — separate from, and layered on top of, the explicit calibration step.
- The **rule-based score** weights backspace/error rate (45%), WPM deviation from baseline (20%), latency coefficient-of-variation / rhythm irregularity (25%), and pause-rate delta (10%).
- The **model score** (`POST /predict`) only receives 25% weight once your baseline is "ready" (≥80 events observed) — and 10% before that, since an untrained baseline makes the model's per-person calibration meaningless too.
- Both scores are clamped to `[0, 1]`, blended, then smoothed again in `App.jsx` with a final EWMA (`α = 0.20`) purely for display, so the number on screen doesn't jitter on every 3-second batch.

The backend's job is intentionally narrow: `app.py` does nothing but load `keystroke_lstm_model.pt` + `scaler.pkl` + `model_config.pkl` once at startup and serve `/predict`. All baseline logic, calibration, and blending live client-side.

---

## Project structure

```
StressDetection/
├── backend/
│   ├── app.py                    # Flask inference API (/predict, /health)
│   ├── keystroke_features.py     # Standalone Python-side feature extractor (legacy/offline capture)
│   ├── keystroke_lstm_model.pt   # Trained LSTM weights
│   ├── model_config.pkl          # temperature, LOPO accuracy, feature list
│   ├── scaler.pkl                # fitted StandardScaler for inference-time normalization
│   ├── requirements.txt
│   └── data/
│       ├── keystroke_dataset.csv # raw exploratory dataset
│       └── keystroke_proper.csv  # cleaned dataset used for LSTM training
│
├── frontend/
│   └── src/
│       ├── App.jsx                    # top-level state, calibration timer, idle detection, layout
│       ├── main.jsx
│       ├── index.css / styles.js      # glassmorphism theme, stress color scale
│       ├── components/
│       │   ├── ShaderBackground.jsx    # WebGL/GLSL background reacting to live stress level
│       │   ├── RealTimeTypingBox.jsx   # captures keydown/keyup, batches every 3s
│       │   ├── StressDisplay.jsx       # big % readout, label badge, progress bar
│       │   ├── SignalBreakdown.jsx     # per-signal contribution bars
│       │   ├── CalibrationPanel.jsx    # 15s baseline calibration flow
│       │   ├── StatsRow.jsx            # ⚠️ currently a duplicate of StressDisplay — see Known gaps
│       │   └── FeaturePlot.jsx         # Chart.js trend chart (hold/latency/WPM/pauses/CPM)
│       └── utils/
│           ├── featureEngine.js        # raw key events → 9-dim feature windows + summary metrics
│           └── stressScorer.js         # hybrid rule + model scoring, baseline EWMA
│
├── scripts/                      # model development pipeline (run in order)
│   ├── 1-EDA.py                        # exploratory analysis, baseline RandomForest classifier
│   ├── 2-5FoldCrossValidation.py       # RF / Gradient Boosting / SVM comparison, stratified 5-fold CV
│   ├── 3-checkLeakageDuplicate.py      # duplicate/leakage check, correlation heatmap, feature importance
│   ├── 4-hyperparameterTuning.py       # RandomizedSearchCV for RF and GB (optimized for recall)
│   ├── 5-FeatureSelection.py           # feature importance + PCA visualization
│   ├── 6-LSTM.py                       # trains the final KeystrokeLSTM w/ Leave-One-Person-Out CV
│   ├── 7-RobustnesEvaluate.py          # accuracy under injected Gaussian noise
│   └── 8-SHARP.py                      # feature correlation vs. true labels/model predictions
│
├── model/                        # output of 6-LSTM.py (weights, scaler, config)
├── X_test.npy / y_test.npy       # held-out test windows for scripts 7 & 8
└── README.md
```

---

## The model

**`KeystrokeLSTM`** — a single-layer LSTM classifier trained on sliding windows of keystroke features.

| | |
|---|---|
| Input | `(batch, 50, 9)` — 50-timestep window × 9 features |
| Features | `hold_duration, latency, wpm, pauses, cpm, error_rate, wpm_delta, hold_delta, latency_delta` |
| Architecture | `LSTM(hidden=32) → Dropout(0.5) → BatchNorm1d → Linear(32→1) → sigmoid(x / temperature)` |
| Loss | Label-smoothed BCE (`smoothing = 0.15`) |
| Validation | Leave-One-Person-Out CV — train on all-but-one person, test on the held-out person |
| Calibration | Temperature scaling (`T = 2.0`) to soften overconfident predictions before blending |

Windows are built with a **50-step window, 10-step stride** per `(person_id, session_type)` group, then scaled with a `StandardScaler` fit on the training split only (never on held-out people, to avoid leakage across the LOPO folds).

`6-LSTM.py` prints per-fold LOPO accuracy and a final message calibrated to how well the model generalized:
- `< 0.60` — near chance; the frontend's rule-based scorer is expected to carry most of the weight
- `0.60–0.75` — moderate; hybrid scoring meaningfully helps
- `> 0.75` — good generalization to new users

---

## Getting started

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Starts on `http://localhost:5000`.

```env
# no environment variables required — model paths are resolved
# relative to app.py's own directory at startup
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173` (default Vite port). Requires the backend running at `http://localhost:5000` for the model component of the score — the URL is currently hardcoded in `App.jsx` rather than read from an env variable (see Known gaps).

### Retraining the model

```bash
cd scripts
python 1-EDA.py                    # optional: sanity-check the raw data
python 6-LSTM.py                   # trains & saves model/, scaler.pkl, model_config.pkl
python 7-RobustnesEvaluate.py      # optional: noise-robustness curve
python 8-SHARP.py                  # optional: feature correlation analysis
```

`6-LSTM.py` expects `data/keystroke_proper.csv` with columns `person_id`, `session_type` (`relaxed`/`stressed`), `press_time`, plus the 9 feature columns. It writes trained artifacts to `model/` and saves a held-out test split to `X_test.npy`/`y_test.npy` for the evaluation scripts. Copy the three output files (`keystroke_lstm_model.pt`, `scaler.pkl`, `model_config.pkl`) into `backend/` to deploy a retrained model.

---

## API overview

**Inference** (`app.py`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/predict` | Body: `{ "features": [[...9 floats...], ...] }`. Pads/trims to a 50-step window, scales, runs the LSTM. Returns `{ stress_prob, label }`. |
| GET | `/health` | Returns model status, expected feature list, and the loaded temperature — useful for a quick liveness check. |

---

## Security & privacy notes

- All keystroke processing happens **client-side** in `featureEngine.js` — raw key events (which keys, not just timing) never leave the browser; only the derived numeric feature windows are sent to `/predict`.
- The Flask API has no authentication — it's a stateless, single-purpose inference endpoint with no persistence, but it should sit behind a reverse proxy or be network-restricted before any public deployment.
- `flask-cors` currently allows all origins (`CORS(app)` with no restriction) — tighten this to a specific origin list before deploying publicly.
- No typing content, only timing metadata, is used for scoring — the model architecture has no path to see or store what was typed.

---

## Known gaps

- **`StatsRow.jsx` is a dead duplicate.** It's imported and rendered in `App.jsx` for its intended purpose (a stats strip), but the file's actual contents are a byte-for-byte copy of `StressDisplay.jsx` (it even has `StressDisplay.jsx`'s header comment at the top). It should be replaced with real summary-stats content or removed from `App.jsx`.
- **Backend and evaluation scripts have drifted apart.** `keystroke_features.py`, `7-RobustnesEvaluate.py`, and `8-SHARP.py` all reference an older 5-feature architecture (`hold_duration, latency, wpm, pauses, cpm`, `hidden_size=64`, 2-layer LSTM), while the production model (`app.py`, `6-LSTM.py`) uses 9 features and a 1-layer, 32-hidden-unit LSTM. Running `7-` or `8-` against the current `model/keystroke_lstm_model.pt` will fail on a shape mismatch until they're updated.
- **API base URL is hardcoded.** `App.jsx` calls `http://localhost:5000/predict` directly rather than reading from a Vite env variable (`import.meta.env.VITE_API_URL`), so deploying the frontend and backend to different hosts requires a code change, not just a config change.
- **No production WSGI server.** `app.py` runs via Flask's built-in dev server (`debug=True`) — fine for local development, but should run behind gunicorn/uWSGI (and with `debug=False`) in production.
- **Stress labels are self-reported/session-based**, not clinically validated — `relaxed`/`stressed` reflects how a session was labeled during data collection, not a diagnosed physiological state.

---

## Roadmap

- [ ] Replace `StatsRow.jsx` with real content, or remove the redundant import
- [ ] Sync `keystroke_features.py` / `7-RobustnesEvaluate.py` / `8-SHARP.py` with the current 9-feature model architecture
- [ ] Move the API base URL into a Vite env variable
- [ ] Add a production WSGI entrypoint (gunicorn config) for the backend
- [ ] Persist calibration baselines across sessions (currently reset on page reload)
- [ ] Restrict CORS to a specific frontend origin before any public deployment

---

## License

This project is currently private/unlicensed. Add a license here if you plan to open-source it.
