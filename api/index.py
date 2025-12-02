import uvicorn
import xgboost as xgb
import pandas as pd
import numpy as np
import math
import os
import logging
from bson import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hotel No-Show Prediction API - MongoDB Atlas")

# Mount static files for frontend (adjust path for Vercel)
try:
    # Try to mount static files, but don't fail if directory doesn't exist
    import os
    if os.path.exists("static"):
        app.mount("/static", StaticFiles(directory="static"), name="static")
    elif os.path.exists("../static"):
        app.mount("/static", StaticFiles(directory="../static"), name="static")
except Exception as e:
    print(f"Static files mounting failed: {e}")
    # For Vercel deployment, static files are handled by vercel.json routes

# --- ATLAS CONFIG ---
# MongoDB URI - use environment variable for production
MONGO_URI = os.getenv("MONGODB_URI", "mongodb+srv://Narasimha:Narasimha25@hotel-booking-cluster.zbedtur.mongodb.net/restaurant_predictions?retryWrites=true&w=majority")
DB_NAME = "restaurant_db"

print(f"🔗 Connecting to Atlas: {MONGO_URI[:50]}...")

# --- LOAD RESOURCES ---
# MongoDB client with connection timeout settings
client = AsyncIOMotorClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,  # 5 second timeout
    connectTimeoutMS=5000,
    socketTimeoutMS=5000,
    maxPoolSize=1  # Limit connection pool
)
db = client[DB_NAME]

# Load XGBoost model
model = None
try:
    booster = xgb.Booster()
    # Try multiple paths for the model file
    model_paths = ["noshow_xgb.json", "../noshow_xgb.json", "./noshow_xgb.json", "api/noshow_xgb.json"]
    model_loaded = False
    
    for model_path in model_paths:
        try:
            if os.path.exists(model_path):
                booster.load_model(model_path)
                model_loaded = True
                logger.info(f"✅ XGBoost model loaded from {model_path}")
                break
        except Exception as path_error:
            continue
    
    if model_loaded:
        model = booster
        logger.info("✅ XGBoost model loaded successfully")
    else:
        logger.warning("⚠️ XGBoost model file not found - predictions will fail")
except Exception as e:
    logger.error(f"❌ Failed to load model: {e}")
    model = None

class ReservationRequest(BaseModel):
    customer_name: str
    party_size: int
    deposit_paid: int
    lead_time_days: int
    is_repeated_guest: int
    previous_cancellations: int
    special_requests_count: int
    visit_month: int

def calculate_business_insights(request: ReservationRequest, probability: float, risk_level: str):
    """Calculate business impact and recommendations"""
    
    # Business parameters
    avg_revenue_per_person = 45
    prep_cost_per_person = 8
    staff_cost_per_hour = 15
    table_turnover_hours = 1.5
    
    # Calculate potential impacts
    potential_revenue = request.party_size * avg_revenue_per_person
    potential_loss = potential_revenue * probability
    prep_waste = request.party_size * prep_cost_per_person * probability
    
    # Generate recommendations
    if probability > 0.7:
        overbook_rec = "HIGH RISK - Accept 1-2 additional reservations for this time slot"
        staff_rec = f"Reduce staff allocation by 1 server for this {request.party_size}-person party"
        prep_rec = "Prepare 20% less food to minimize waste"
    elif probability > 0.4:
        overbook_rec = "MEDIUM RISK - Consider accepting 1 additional reservation"
        staff_rec = "Maintain standard staffing but keep backup available"
        prep_rec = "Prepare 10% less food as precaution"
    else:
        overbook_rec = "LOW RISK - Follow standard booking policy"
        staff_rec = "Maintain full staffing for optimal service"
        prep_rec = "Prepare full portions as planned"
    
    # Calculate savings opportunity
    staff_savings = staff_cost_per_hour * table_turnover_hours * 0.3 if probability > 0.6 else 0
    total_savings = prep_waste + staff_savings
    
    return {
        "revenue_impact": {
            "potential_revenue": round(potential_revenue, 2),
            "potential_loss": round(potential_loss, 2),
            "risk_percentage": round(probability * 100, 1)
        },
        "cost_optimization": {
            "prep_waste_avoided": round(prep_waste, 2),
            "staff_savings": round(staff_savings, 2),
            "total_savings": round(total_savings, 2)
        },
        "operational_recommendations": {
            "overbooking": overbook_rec,
            "staffing": staff_rec,
            "food_prep": prep_rec
        },
        "financial_summary": {
            "net_impact": round(potential_revenue - potential_loss - total_savings, 2),
            "confidence_level": "High" if probability > 0.6 else "Medium" if probability > 0.3 else "Low"
        }
    }

@app.on_event("startup")
async def startup_event():
    """Test MongoDB connection on startup"""
    try:
        await client.admin.command('ping')
        logger.info("✅ Connected to MongoDB Atlas successfully")
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        raise e

@app.get("/")
async def serve_homepage():
    """Serve the main HTML page"""
    return FileResponse("static/index.html")

@app.get("/debug")
async def debug_info():
    """Debug endpoint to check deployment status"""
    import os
    return {
        "status": "API is running",
        "model_loaded": model is not None,
        "working_directory": os.getcwd(),
        "files_in_directory": os.listdir(".") if os.path.exists(".") else [],
        "model_files_found": [f for f in ["noshow_xgb.json", "../noshow_xgb.json", "./noshow_xgb.json", "api/noshow_xgb.json"] if os.path.exists(f)],
        "static_directory_exists": os.path.exists("static"),
        "python_version": f"{os.sys.version}"
    }

@app.post("/predict")
async def predict_no_show(request: ReservationRequest):
    """Make prediction and save to MongoDB"""
    try:
        if model is None:
            raise HTTPException(status_code=500, detail="Model not available")
        
        # Prepare features for prediction - match training feature names
        # Convert month to cyclical features (same as training)
        month_sin = math.sin(2 * math.pi * request.visit_month / 12)
        month_cos = math.cos(2 * math.pi * request.visit_month / 12)
        
        features = pd.DataFrame([[
            request.lead_time_days,  # lead_time in training
            request.party_size,
            request.deposit_paid,
            request.is_repeated_guest,
            request.previous_cancellations,
            request.special_requests_count,  # total_of_special_requests in training
            month_sin,
            month_cos
        ]], columns=[
            'lead_time', 'party_size', 'deposit_paid',
            'is_repeated_guest', 'previous_cancellations',
            'total_of_special_requests', 'month_sin', 'month_cos'
        ])
        
        # Make prediction
        dmatrix = xgb.DMatrix(features)
        probability = float(model.predict(dmatrix)[0])
        
        # Determine risk level
        if probability > 0.75:
            risk_level = "Critical"
        elif probability > 0.45:
            risk_level = "Moderate"
        else:
            risk_level = "Low"
        
        # Calculate business insights
        business_insights = calculate_business_insights(request, probability, risk_level)
        
        # Prepare document for MongoDB
        prediction_doc = {
            **request.dict(),
            "prediction_prob": round(probability, 3),
            "risk_level": risk_level,
            "timestamp": datetime.utcnow(),
            "business_insights": business_insights
        }
        
        # Save to MongoDB Atlas
        result = await db.predictions.insert_one(prediction_doc)
        
        logger.info(f"Prediction saved with ID: {result.inserted_id}")
        
        return {
            "success": True,
            "probability": round(probability, 3),
            "risk_level": risk_level,
            "business_insights": business_insights,
            "document_id": str(result.inserted_id),
            "message": "Prediction saved successfully"
        }
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/predictions/recent")
async def get_recent_predictions(skip: int = 0, limit: int = 20):
    """Get recent predictions from MongoDB Atlas with pagination"""
    try:
        # Get total count
        total_count = await db.predictions.count_documents({})
        
        # Fetch recent predictions with pagination
        cursor = db.predictions.find().sort("timestamp", -1).skip(skip).limit(limit)
        predictions = []
        
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])  # Convert ObjectId to string
            # Ensure timestamp is properly formatted
            if isinstance(doc.get("timestamp"), str):
                doc["timestamp"] = doc["timestamp"]
            else:
                doc["timestamp"] = doc.get("timestamp", datetime.utcnow()).isoformat()
            predictions.append(doc)
        
        logger.info(f"Retrieved {len(predictions)} predictions (skip: {skip}, limit: {limit})")
        
        return {
            "success": True,
            "total": len(predictions),
            "total_count": total_count,
            "data": predictions,
            "has_more": (skip + limit) < total_count,
            "message": f"Found {len(predictions)} predictions"
        }
        
    except Exception as e:
        logger.error(f"Error fetching predictions: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": [],
            "total": 0,
            "total_count": 0,
            "has_more": False
        }

@app.get("/predictions/all")
async def get_all_predictions(skip: int = 0, limit: int = 50, search: str = ""):
    """Get all predictions with optional search and pagination"""
    try:
        # Build query
        query = {}
        if search:
            query = {
                "$or": [
                    {"customer_name": {"$regex": search, "$options": "i"}},
                    {"risk_level": {"$regex": search, "$options": "i"}}
                ]
            }
        
        # Get total count
        total_count = await db.predictions.count_documents(query)
        
        # Fetch predictions
        cursor = db.predictions.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        predictions = []
        
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("timestamp"), str):
                doc["timestamp"] = doc["timestamp"]
            else:
                doc["timestamp"] = doc.get("timestamp", datetime.utcnow()).isoformat()
            predictions.append(doc)
        
        return {
            "success": True,
            "data": predictions,
            "total_count": total_count,
            "has_more": (skip + limit) < total_count,
            "current_page": (skip // limit) + 1,
            "total_pages": (total_count + limit - 1) // limit
        }
        
    except Exception as e:
        logger.error(f"Error fetching all predictions: {e}")
        return {
            "success": False,
            "error": str(e),
            "data": [],
            "total_count": 0,
            "has_more": False
        }

@app.get("/predictions/{prediction_id}")
async def get_prediction_details(prediction_id: str):
    """Get detailed prediction data by ID"""
    try:
        prediction = await db.predictions.find_one({"_id": ObjectId(prediction_id)})
        
        if not prediction:
            raise HTTPException(status_code=404, detail="Prediction not found")
        
        prediction["_id"] = str(prediction["_id"])
        
        return {
            "success": True,
            "prediction": prediction,
            "business_insights": prediction.get("business_insights", {})
        }
        
    except Exception as e:
        logger.error(f"Error fetching prediction {prediction_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test MongoDB connection
        await client.admin.command('ping')
        
        return {
            "status": "healthy",
            "database": "connected",
            "model": "loaded" if model else "not_loaded",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "model": "loaded" if model else "not_loaded",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

# Vercel serverless function handler
handler = app
