import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import LabelEncoder

df = pd.read_csv('./data/keystroke_dataset.csv')

numeric_cols = ['hold_duration', 'latency', 'error_rate', 'wpm']
for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')
df = df.dropna(subset=numeric_cols)

le = LabelEncoder()
df['session_type_code'] = le.fit_transform(df['session_type'])

X = df[numeric_cols].values
y = df['session_type_code'].values

skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

models = {
    'Random Forest': RandomForestClassifier(random_state=42),
    'Gradient Boosting': GradientBoostingClassifier(random_state=42),
    'SVM (RBF Kernel)': SVC(kernel='rbf', random_state=42)
}

for name, model in models.items():
    cv_scores = cross_val_score(model, X, y, cv=skf, scoring='accuracy')
    print(f'{name} 5-fold CV accuracy scores: {cv_scores}')
    print(f'{name} Mean CV accuracy: {cv_scores.mean():.4f}\n')
