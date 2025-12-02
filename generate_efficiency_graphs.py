import pandas as pd
import numpy as np
import xgboost as xgb
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, validation_curve
from sklearn.metrics import classification_report, roc_auc_score, roc_curve, confusion_matrix
from sklearn.metrics import precision_recall_curve, auc
import math
import warnings
warnings.filterwarnings('ignore')

# Set style for IEEE paper quality graphs
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

def generate_model_efficiency_graphs():
    """Generate two professional graphs for IEEE research paper"""
    
    # 1. Load and prepare data
    print("Loading and preparing data...")
    df = pd.read_csv("processed_reservations.csv")
    
    # Feature Engineering
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
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Calculate class weight
    ratio = float(np.sum(y == 0)) / np.sum(y == 1)
    
    # Train model
    print("Training XGBoost model...")
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dtest = xgb.DMatrix(X_test, label=y_test)
    
    params = {
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "scale_pos_weight": ratio,
        "max_depth": 4,
        "eta": 0.1,
    }
    
    # Train with evaluation history
    evals_result = {}
    bst = xgb.train(
        params=params,
        dtrain=dtrain,
        num_boost_round=100,
        evals=[(dtrain, "train"), (dtest, "validation")],
        evals_result=evals_result,
        verbose_eval=False
    )
    
    # Make predictions
    train_probs = bst.predict(dtrain)
    test_probs = bst.predict(dtest)
    test_preds = (test_probs >= 0.5).astype(int)
    
    # Calculate metrics
    train_auc = roc_auc_score(y_train, train_probs)
    test_auc = roc_auc_score(y_test, test_probs)
    
    print(f"Training AUC: {train_auc:.4f}")
    print(f"Testing AUC: {test_auc:.4f}")
    
    # GRAPH 1: ROC Curve and Performance Metrics
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    
    # ROC Curve
    fpr, tpr, _ = roc_curve(y_test, test_probs)
    ax1.plot(fpr, tpr, linewidth=2, label=f'XGBoost (AUC = {test_auc:.3f})', color='#2E86AB')
    ax1.plot([0, 1], [0, 1], 'k--', linewidth=1, alpha=0.8, label='Random Classifier')
    ax1.set_xlabel('False Positive Rate', fontsize=12, fontweight='bold')
    ax1.set_ylabel('True Positive Rate', fontsize=12, fontweight='bold')
    ax1.set_title('ROC Curve - Model Performance', fontsize=14, fontweight='bold')
    ax1.legend(fontsize=11)
    ax1.grid(True, alpha=0.3)
    ax1.set_xlim([0, 1])
    ax1.set_ylim([0, 1])
    
    # Confusion Matrix Heatmap
    cm = confusion_matrix(y_test, test_preds)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax2, 
                xticklabels=['No Show', 'Show Up'], yticklabels=['No Show', 'Show Up'])
    ax2.set_title('Confusion Matrix', fontsize=14, fontweight='bold')
    ax2.set_xlabel('Predicted', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Actual', fontsize=12, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig('model_performance_roc.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    # GRAPH 2: Training History and Feature Importance
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    
    # Training History
    epochs = range(1, len(evals_result['train']['auc']) + 1)
    ax1.plot(epochs, evals_result['train']['auc'], 'b-', linewidth=2, label='Training AUC', marker='o', markersize=4)
    ax1.plot(epochs, evals_result['validation']['auc'], 'r-', linewidth=2, label='Validation AUC', marker='s', markersize=4)
    ax1.set_xlabel('Epochs', fontsize=12, fontweight='bold')
    ax1.set_ylabel('AUC Score', fontsize=12, fontweight='bold')
    ax1.set_title('Model Training History', fontsize=14, fontweight='bold')
    ax1.legend(fontsize=11)
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim([0.5, 1.0])
    
    # Feature Importance
    importance_scores = bst.get_score(importance_type='weight')
    features = list(importance_scores.keys())
    scores = list(importance_scores.values())
    
    # Sort by importance
    sorted_idx = np.argsort(scores)
    sorted_features = [features[i] for i in sorted_idx]
    sorted_scores = [scores[i] for i in sorted_idx]
    
    colors = plt.cm.viridis(np.linspace(0, 1, len(sorted_features)))
    bars = ax2.barh(range(len(sorted_features)), sorted_scores, color=colors)
    ax2.set_yticks(range(len(sorted_features)))
    ax2.set_yticklabels(sorted_features, fontsize=10)
    ax2.set_xlabel('Feature Importance (Weight)', fontsize=12, fontweight='bold')
    ax2.set_title('Feature Importance Analysis', fontsize=14, fontweight='bold')
    ax2.grid(True, alpha=0.3, axis='x')
    
    plt.tight_layout()
    plt.savefig('training_history_importance.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    # Print detailed metrics for paper
    print("\n" + "="*60)
    print("MODEL EFFICIENCY ANALYSIS FOR IEEE PAPER")
    print("="*60)
    
    # Classification Report
    report = classification_report(y_test, test_preds, output_dict=True)
    
    print(f"\n📊 PERFORMANCE METRICS:")
    print(f"• Accuracy: {report['accuracy']:.3f} ({report['accuracy']*100:.1f}%)")
    print(f"• Precision: {report['1']['precision']:.3f}")
    print(f"• Recall: {report['1']['recall']:.3f}")
    print(f"• F1-Score: {report['1']['f1-score']:.3f}")
    print(f"• AUC-ROC: {test_auc:.3f}")
    
    # Calculate additional metrics
    precision, recall, _ = precision_recall_curve(y_test, test_probs)
    pr_auc = auc(recall, precision)
    
    print(f"• PR-AUC: {pr_auc:.3f}")
    print(f"• Total Samples: {len(y_test):,}")
    print(f"• No-shows detected: {np.sum(test_preds):,}/{np.sum(y_test):,} ({np.sum(test_preds)/np.sum(y_test)*100:.1f}%)")
    
    print(f"\n🎯 BUSINESS IMPACT:")
    tn, fp, fn, tp = cm.ravel()
    print(f"• True Positives (Correct no-show predictions): {tp}")
    print(f"• False Positives (Incorrect no-show alerts): {fp}")  
    print(f"• True Negatives (Correct show-up predictions): {tn}")
    print(f"• False Negatives (Missed no-shows): {fn}")
    
    cost_savings = tp * 50  # Assume $50 saved per correctly predicted no-show
    false_alarm_cost = fp * 10  # Assume $10 cost per false alarm
    net_benefit = cost_savings - false_alarm_cost
    
    print(f"• Estimated cost savings: ${cost_savings:,}")
    print(f"• False alarm costs: ${false_alarm_cost:,}")
    print(f"• Net business benefit: ${net_benefit:,}")
    
    return {
        'accuracy': report['accuracy'],
        'auc_roc': test_auc,
        'precision': report['1']['precision'],
        'recall': report['1']['recall'],
        'f1_score': report['1']['f1-score'],
        'pr_auc': pr_auc
    }

if __name__ == "__main__":
    # Install required packages
    print("Installing required packages...")
    import subprocess
    import sys
    
    packages = ['matplotlib', 'seaborn']
    for package in packages:
        try:
            __import__(package)
        except ImportError:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
    
    # Generate graphs
    metrics = generate_model_efficiency_graphs()
    print("\n✅ Graphs saved as 'model_performance_roc.png' and 'training_history_importance.png'")
    print("✅ Ready for inclusion in your IEEE research paper!")