import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.preprocessing import LabelEncoder

df = pd.read_csv('keystroke_dataset.csv')

features = ['hold_duration', 'latency', 'error_rate', 'wpm']
for col in features:
    df[col] = pd.to_numeric(df[col], errors='coerce')
df = df.dropna(subset=features)

le = LabelEncoder()
df['session_code'] = le.fit_transform(df['session_type'])

X = df[features]
y = df['session_code']

rf = RandomForestClassifier(random_state=42)
rf.fit(X, y)

importances = rf.feature_importances_
importance_df = pd.DataFrame({'feature': features, 'importance': importances})
importance_df = importance_df.sort_values(by='importance', ascending=False)
print("Feature Importances:\n", importance_df)

plt.figure(figsize=(6,4))
plt.bar(importance_df['feature'], importance_df['importance'])
plt.title('Feature Importances')
plt.show()

selected_features = importance_df[importance_df['importance'] >= 0.1]['feature'].tolist()
print("Selected features:", selected_features)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(df[selected_features])

pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_scaled)

print(f"Explained variance ratios by PCA components: {pca.explained_variance_ratio_}")

plt.figure(figsize=(8,6))
for label, color in zip(le.classes_, ['blue', 'red']):
    plt.scatter(
        X_pca[df['session_code'] == le.transform([label])[0], 0],
        X_pca[df['session_code'] == le.transform([label])[0], 1],
        label=label,
        alpha=0.6,
        c=color
    )
plt.xlabel('PCA Component 1')
plt.ylabel('PCA Component 2')
plt.title('PCA of Selected Features')
plt.legend()
plt.show()

X_train, X_test, y_train, y_test = train_test_split(df[selected_features], y, test_size=0.2, random_state=42, stratify=y)
rf2 = RandomForestClassifier(random_state=42)
rf2.fit(X_train, y_train)
y_pred = rf2.predict(X_test)
print(classification_report(y_test, y_pred))
