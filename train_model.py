import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import math

def train_pipeline():
    # 1. Load Data
    try:
        df = pd.read_csv("processed_reservations.csv")
    except FileNotFoundError:
        print("Error: Run process_kaggle_data.py first.")
        return
    
    # 2. Feature Engineering: Cyclical Time
    month_map = {
        'January':1, 'February':2, 'March':3, 'April':4, 'May':5, 'June':6,
        'July':7, 'August':8, 'September':9, 'October':10, 'November':11, 'December':12
    }
    df['month_num'] = df['arrival_date_month'].map(month_map).fillna(1)
    
    df['month_sin'] = np.sin(2 * math.pi * df['month_num'] / 12)
    df['month_cos'] = np.cos(2 * math.pi * df['month_num'] / 12)
    
    feature_cols = [
        'lead_time', 'party_size', 'deposit_paid', 
        'is_repeated_guest', 'previous_cancellations', 
        'total_of_special_requests', 'month_sin', 'month_cos'
    ]
    
    X = df[feature_cols]
    y = df['target']

    # 3. Split Data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # 4. Calculate Class Weight
    ratio = float(np.sum(y == 0)) / np.sum(y == 1)

    # 5. Wrap in DMatrix for Booster training
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dtest = xgb.DMatrix(X_test, label=y_test)

    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "scale_pos_weight": ratio,
        "max_depth": 4,
        "eta": 0.1,
    }

    evals = [(dtrain, "train"), (dtest, "test")]

    # 6. Train Booster model
    bst = xgb.train(
        params=params,
        dtrain=dtrain,
        num_boost_round=100,
        evals=evals
    )

    # 7. Evaluate
    probs = bst.predict(dtest)
    preds = (probs >= 0.5).astype(int)

    print("--- Model Evaluation ---")
    print(classification_report(y_test, preds))
    print(f"AUC-ROC Score: {roc_auc_score(y_test, probs):.4f}")

    # 8. Save Booster model
    bst.save_model("noshow_xgb.json")
    print("✅ Booster model saved to 'noshow_xgb.json'")

if __name__ == "__main__":
    train_pipeline()
