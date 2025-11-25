// API endpoints
const API_BASE = window.location.origin;

// API communication class
class API {
    static async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Make prediction
    static async makePrediction(predictionData) {
        return this.request('/predict', {
            method: 'POST',
            body: JSON.stringify(predictionData)
        });
    }

    // Get recent predictions
    static async getRecentPredictions(skip = 0, limit = 20) {
        return this.request(`/predictions/recent?skip=${skip}&limit=${limit}`);
    }

    // Get all predictions with pagination
    static async getAllPredictions(skip = 0, limit = 50, search = '') {
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
        return this.request(`/predictions/all?skip=${skip}&limit=${limit}${searchParam}`);
    }

    // Get specific prediction
    static async getPrediction(id) {
        return this.request(`/predictions/${id}`);
    }

    // Health check
    static async healthCheck() {
        return this.request('/health');
    }
}

// Export for use in other files
window.API = API;