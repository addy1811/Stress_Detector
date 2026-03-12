import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score


df = pd.read_csv('./data/keystroke_dataset.csv') 

numeric_cols = ['hold_duration', 'latency', 'error_rate', 'wpm']
for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors='coerce')
df = df.dropna(subset=numeric_cols)

plt.figure(figsize=(12, 6))
sns.boxplot(x='session_type', y='hold_duration', data=df)
plt.title('Hold Duration Distribution by Session Type')
plt.show()

le = LabelEncoder()
df['session_type_code'] = le.fit_transform(df['session_type'])

features = numeric_cols
X = df[features]
y = df['session_type_code']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, stratify=y, test_size=0.2, random_state=42)

clf = RandomForestClassifier(random_state=42)
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
print("Accuracy:", accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred))
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))
