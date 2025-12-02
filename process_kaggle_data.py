import pandas as pd
import numpy as np

def prepare_dataset():
    # 1. Load Kaggle Dataset
    # Expect the CSV to be in the same folder as this script
    try:
        df = pd.read_csv(r"C:\\Users\\vedul\\OneDrive\\Documents\\NoSQL PROJECT\\hotel_bookings.csv")
    except FileNotFoundError:
        print("Error: Please place 'hotel_bookings.csv' in this project folder.")
        return

    print(f"Raw data shape: {df.shape}")

    # 2. Filter Target Scope: keep Check-Out and No-Show only
    df = df[df['reservation_status'].isin(["Check-Out", "No-Show"])].copy()
    
    # 3. Create Target Variable (1 = No-Show, 0 = Show)
    df['target'] = (df['reservation_status'] == 'No-Show').astype(int)
    
    # 4. Feature Engineering
    # Handle missing children safely before adding
    df['children'] = df['children'].fillna(0)
    df['party_size'] = df['adults'] + df['children']

    # Deposit paid binary flag
    df['deposit_paid'] = df['deposit_type'].apply(
        lambda x: 0 if x == 'No Deposit' else 1
    )
    
    cols = [
        'lead_time', 
        'party_size', 
        'deposit_paid', 
        'is_repeated_guest', 
        'previous_cancellations', 
        'total_of_special_requests', 
        'arrival_date_month', 
        'target'
    ]
    
    final_df = df[cols].fillna(0)
    
    # Save dataset in the same project folder
    final_df.to_csv(r"C:\\Users\\vedul\\OneDrive\\Documents\\NoSQL PROJECT\\processed_reservations.csv", index=False)
    print(f"✅ Saved 'processed_reservations.csv' with {len(final_df)} rows.")
    print(f"📊 No-Show Rate: {final_df['target'].mean():.2%}")

if __name__ == "__main__":
    prepare_dataset()
