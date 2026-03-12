import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

df = pd.read_csv('./data/keystroke_dataset.csv')

cols = ['hold_duration', 'latency', 'error_rate', 'wpm']
for col in cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')

df = df.dropna(subset=cols)

duplicates = df.duplicated().sum()
print(f"Duplicate rows: {duplicates}")

le = LabelEncoder()
df['session_code'] = le.fit_transform(df['session_type'])

plt.figure(figsize=(8,6))
corr = df[cols + ['session_code']].corr()
sns.heatmap(corr, annot=True, cmap='coolwarm')
plt.title('Feature Correlation Matrix')
plt.show()

X = df[cols]
y = df['session_code']

rf = RandomForestClassifier(random_state=42)
rf.fit(X, y)

importance_df = pd.DataFrame({
    'feature': cols,
    'importance': rf.feature_importances_
}).sort_values(by='importance', ascending=False)

plt.figure(figsize=(6,4))
sns.barplot(x='importance', y='feature', data=importance_df)
plt.title('Feature Importance from Random Forest')
plt.show()

X_train, X_test, y_train, y_test = train_test_split(X, y, stratify=y, random_state=42, test_size=0.2)
lr = LogisticRegression(max_iter=1000)
lr.fit(X_train, y_train)
y_pred = lr.predict(X_test)

print("\nClassification Report (Logistic Regression):")
print(classification_report(y_test, y_pred, target_names=le.classes_))
