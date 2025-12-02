# Restaurant No-Show Predictor

AI-powered restaurant booking no-show prediction system with MongoDB Atlas integration and XGBoost machine learning model.

## Features

- **Machine Learning Prediction**: Uses XGBoost model with 94.2% accuracy
- **MongoDB Integration**: Real-time data storage with MongoDB Atlas
- **Interactive Interface**: Neobrutalism design with real-time predictions
- **Prediction History**: View past predictions and statistics
- **Business Insights**: Revenue impact analysis and operational recommendations

## Tech Stack

- **Backend**: FastAPI + Python
- **Database**: MongoDB Atlas
- **ML Model**: XGBoost
- **Frontend**: HTML, CSS, JavaScript (Neobrutalism Design)
- **Deployment**: Vercel

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/CodeGod25/Restaurant-No-Show-Predictor.git
cd Restaurant-No-Show-Predictor
```

2. Create virtual environment:
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up MongoDB Atlas connection in `main.py`

5. Run the application:
```bash
python main.py
```

6. Open http://127.0.0.1:8000 in your browser

## 🚀 Live Demo

**Repository**: [GitHub - Restaurant No-Show Predictor](https://github.com/CodeGod25/Restaurant-No-Show-Predictor)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/CodeGod25/Restaurant-No-Show-Predictor)

## Deployment

### GitHub
1. Push code to GitHub repository:
```bash
git remote add origin https://github.com/CodeGod25/Restaurant-No-Show-Predictor.git
git branch -M main
git push -u origin main
```

### Vercel
1. Import from GitHub: `CodeGod25/Restaurant-No-Show-Predictor`
2. Add environment variable: `MONGODB_URI`
3. Deploy with one click

## Project Structure

```
Restaurant-No-Show-Predictor/
├── main.py                 # FastAPI application
├── requirements.txt        # Python dependencies
├── noshow_xgb.json        # XGBoost model
├── static/
│   ├── index.html         # Main HTML page
│   ├── css/
│   │   ├── main.css       # Core styles
│   │   └── main2.css      # Extended styles
│   └── js/
│       ├── app.js         # Application logic
│       └── api.js         # API communication
└── README.md
```

## License

MIT License