import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import make_scorer, recall_score

df = pd.read_csv('./data/keystroke_dataset.csv')

numeric_cols = ['hold_duration', 'latency', 'error_rate', 'wpm']
for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')
df = df.dropna(subset=numeric_cols)

le = LabelEncoder()
df['session_type_code'] = le.fit_transform(df['session_type'])

X = df[numeric_cols]
y = df['session_type_code']

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

rf_param_dist = {
    'n_estimators': [50, 100, 200, 300],
    'max_depth': [None, 5, 10, 20],
    'min_samples_split': [2, 5, 10],
    'min_samples_leaf': [1, 2, 4],
    'bootstrap': [True, False]
}

gb_param_dist = {
    'n_estimators': [50, 100, 150],
    'learning_rate': [0.01, 0.1, 0.2],
    'max_depth': [3, 5, 8],
    'subsample': [0.7, 0.8, 1.0],
    'min_samples_split': [2, 5, 10]
}

scorer = make_scorer(recall_score, pos_label=1)

rf = RandomForestClassifier(random_state=42)
rf_random_search = RandomizedSearchCV(
    estimator=rf, param_distributions=rf_param_dist,
    n_iter=20, scoring=scorer, cv=cv, verbose=2,
    random_state=42, n_jobs=-1
)
rf_random_search.fit(X, y)
print("Best Random Forest params:", rf_random_search.best_params_)
print("Best Random Forest recall:", rf_random_search.best_score_)

gb = GradientBoostingClassifier(random_state=42)
gb_random_search = RandomizedSearchCV(
    estimator=gb, param_distributions=gb_param_dist,
    n_iter=20, scoring=scorer, cv=cv, verbose=2,
    random_state=42, n_jobs=-1
)
gb_random_search.fit(X, y)
print("Best Gradient Boosting params:", gb_random_search.best_params_)
print("Best Gradient Boosting recall:", gb_random_search.best_score_)
