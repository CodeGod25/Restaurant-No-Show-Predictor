// Application state
let currentPredictions = [];
let isLoading = false;
let currentPage = 0; // This tracks pages, not skip count
let hasMorePredictions = true;
let loadedPredictionIds = new Set();
let totalCount = 0; // Track actual total count from API

// Global focus management system
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupGlobalFocusManagement();
    

});

// Simple focus management for disabled elements
function setupGlobalFocusManagement() {
    // Only prevent focus on disabled buttons when they're clicked
    document.addEventListener('click', function(e) {
        if (e.target && e.target.disabled && e.target.tagName === 'BUTTON') {
            e.target.blur();
            document.body.focus();
            document.body.blur();
        }
    });
}

async function initializeApp() {
    console.log('🚀 Initializing NoSQL Predictor App...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    await Promise.all([
        checkHealth(),
        loadPredictionHistory(),
        updateStats()
    ]);
    
    // Start animations
    startAnimations();
    
    console.log('✅ App initialized successfully!');
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', handleNavigation);
    });
    
    // Prediction form
    const predictionForm = document.getElementById('predictionForm');
    if (predictionForm) {
        predictionForm.addEventListener('submit', handlePredictionSubmit);
    }
    
    // Form inputs for real-time validation
    const formInputs = document.querySelectorAll('#predictionForm input, #predictionForm select');
    formInputs.forEach(input => {
        input.addEventListener('input', validateInput);
        input.addEventListener('blur', validateInput);
    });
}

// Navigation handler
function handleNavigation(e) {
    e.preventDefault();
    const targetSection = e.target.getAttribute('data-section');
    
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Scroll to section
    scrollToSection(targetSection);
}

// Smooth scroll to section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        const headerHeight = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

// Health check
async function checkHealth() {
    try {
        const health = await API.healthCheck();
        updateHealthStatus(health);
        return health;
    } catch (error) {
        console.error('Health check failed:', error);
        updateHealthStatus({ status: 'unhealthy', database: 'disconnected' });
    }
}

function updateHealthStatus(health) {
    // Update database status
    const dbStatus = document.getElementById('dbStatus');
    const mongoStatus = document.getElementById('mongoStatus');
    
    if (health.status === 'healthy' && health.database === 'connected') {
        if (dbStatus) dbStatus.textContent = 'ONLINE';
        if (mongoStatus) mongoStatus.className = 'status-indicator';
    } else {
        if (dbStatus) dbStatus.textContent = 'OFFLINE';
        if (mongoStatus) {
            mongoStatus.className = 'status-indicator';
            mongoStatus.style.background = 'var(--brutal-red)';
        }
    }
}

// Test MongoDB connection
async function testConnection() {
    const button = document.querySelector('.test-connection');
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    button.disabled = true;
    
    try {
        const health = await API.healthCheck();
        updateHealthStatus(health);
        
        // Show success feedback
        button.innerHTML = '<i class="fas fa-check"></i> Connected!';
        button.style.background = 'linear-gradient(135deg, var(--success-color), var(--primary-color))';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
            button.style.background = '';
        }, 2000);
        
    } catch (error) {
        button.innerHTML = '<i class="fas fa-times"></i> Failed';
        button.style.background = 'linear-gradient(135deg, var(--error-color), var(--secondary-color))';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
            button.style.background = '';
        }, 2000);
    }
}

// Prediction form handling
async function handlePredictionSubmit(e) {
    e.preventDefault();
    console.log('Prediction form submitted');
    
    if (isLoading) {
        console.log('Already loading, ignoring submission');
        return;
    }
    
    const form = e.target;
    const formData = new FormData(form);
    const predictionData = Object.fromEntries(formData.entries());
    
    console.log('Form data collected:', predictionData);
    
    // Validate required fields
    const requiredFields = ['customer_name', 'party_size', 'deposit_paid', 'lead_time_days', 
                           'is_repeated_guest', 'previous_cancellations', 'special_requests_count', 'visit_month'];
    
    for (const field of requiredFields) {
        if (!predictionData[field] && predictionData[field] !== '0') {
            showError(`Please fill in the ${field.replace('_', ' ')} field`);
            return;
        }
    }
    
    // Convert numeric fields
    const numericFields = ['party_size', 'deposit_paid', 'lead_time_days', 'is_repeated_guest', 
                          'previous_cancellations', 'special_requests_count', 'visit_month'];
    
    numericFields.forEach(field => {
        if (predictionData[field]) {
            predictionData[field] = parseInt(predictionData[field]);
        }
    });
    
    console.log('Processed prediction data:', predictionData);
    await makePrediction(predictionData);
}

async function makePrediction(data) {
    const button = document.querySelector('.execute-btn');
    const resultCard = document.getElementById('resultCard');
    
    console.log('Making prediction with data:', data);
    
    // Show loading state
    if (button) {
        setLoadingState(button, true);
    }
    resultCard.style.display = 'none';
    
    try {
        console.log('Calling API.makePrediction...');
        const result = await API.makePrediction(data);
        console.log('Prediction result received:', result);
        
        // Display results
        displayPredictionResult(result);
        
        // Show result card immediately
        resultCard.style.display = 'block';
        
        // Refresh history and stats
        setTimeout(async () => {
            await Promise.all([
                loadPredictionHistory(),
                updateStats()
            ]);
        }, 500);
        
        // Animate result card
        setTimeout(() => {
            if (typeof animateResultCard === 'function') {
                animateResultCard(result);
            }
        }, 300);
        
    } catch (error) {
        console.error('Prediction error:', error);
        showError('Prediction failed: ' + error.message);
        resultCard.style.display = 'none';
    } finally {
        if (button) {
            setLoadingState(button, false);
        }
    }
}

function displayPredictionResult(result) {
    const resultCard = document.getElementById('resultCard');
    const riskBadge = document.getElementById('riskBadge');
    
    // Update risk badge with proper risk level classes
    const riskLevel = result.risk_level.toLowerCase();
    riskBadge.textContent = result.risk_level.toUpperCase();
    
    // Apply risk-specific styling
    if (riskLevel === 'low') {
        riskBadge.className = 'panel-status risk-low';
    } else if (riskLevel === 'moderate') {
        riskBadge.className = 'panel-status risk-moderate';
    } else if (riskLevel === 'critical') {
        riskBadge.className = 'panel-status risk-critical';
    }
    
    // Update probability display in result content
    const percentage = Math.round(result.probability * 100);
    
    // Update individual elements
    const probabilityValue = document.getElementById('probabilityValue');
    const riskValue = document.getElementById('riskValue');
    const meterValue = document.getElementById('meterValue');
    
    if (probabilityValue) {
        probabilityValue.textContent = `${percentage}%`;
        probabilityValue.className = `result-value probability-${riskLevel}`;
    }
    
    if (riskValue) {
        riskValue.textContent = result.risk_level.toUpperCase();
        riskValue.className = `result-value ${riskLevel}`;
    }
    
    if (meterValue) {
        meterValue.textContent = `${percentage}%`;
    }
    
    // Update meter fill if exists
    const meterFill = document.getElementById('meterFill');
    if (meterFill) {
        updateMeterFill(percentage, riskLevel);
    }
    
    // Display business insights if function exists
    if (typeof displayBusinessInsights === 'function' && result.business_insights) {
        displayBusinessInsights(result.business_insights);
    }
    
    // Show result card with animation
    resultCard.classList.add('show', 'animate-in');
}

function updateMeterFill(percentage, riskLevel) {
    const meterFill = document.getElementById('meterFill');
    
    // Set the width with animation
    setTimeout(() => {
        meterFill.style.width = `${percentage}%`;
        
        // Update color based on risk level
        meterFill.className = `meter-fill ${riskLevel}`;
    }, 100);
}

function displayBusinessInsights(insights) {
    const container = document.getElementById('businessInsights');
    
    const html = `
        <div class="insight-item">
            <div class="insight-title">💰 Revenue Impact</div>
            <div class="insight-content">
                Potential Revenue: $${insights.revenue_impact.potential_revenue}<br>
                Potential Loss: $${insights.revenue_impact.potential_loss}<br>
                Risk Level: ${insights.revenue_impact.risk_percentage}%
            </div>
        </div>
        <div class="insight-item">
            <div class="insight-title">⚡ Cost Optimization</div>
            <div class="insight-content">
                Food Waste Avoided: $${insights.cost_optimization.prep_waste_avoided}<br>
                Staff Savings: $${insights.cost_optimization.staff_savings}<br>
                Total Savings: $${insights.cost_optimization.total_savings}
            </div>
        </div>
        <div class="insight-item">
            <div class="insight-title">📋 Recommendations</div>
            <div class="insight-content">
                <strong>Overbooking:</strong> ${insights.operational_recommendations.overbooking}<br>
                <strong>Staffing:</strong> ${insights.operational_recommendations.staffing}<br>
                <strong>Food Prep:</strong> ${insights.operational_recommendations.food_prep}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Load prediction history
async function loadPredictionHistory(reset = true) {
    const historyGrid = document.getElementById('historyGrid');
    
    if (isLoading) return;
    
    try {
        isLoading = true;
        
        // Reset if needed
        if (reset) {
            currentPage = 0;
            currentPredictions = [];
            loadedPredictionIds.clear();
            hasMorePredictions = true;
            historyGrid.innerHTML = '';
        }
        
        const skipCount = reset ? 0 : currentPredictions.length;
        console.log('Loading predictions...', { 
            reset, 
            currentPage, 
            skipCount, 
            currentPredictionsLength: currentPredictions.length 
        });
        const response = await API.getRecentPredictions(skipCount, 6);
        console.log('API response:', response);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to fetch predictions');
        }
        
        const newPredictions = response.data || [];
        
        // Update total count from API
        totalCount = response.total_count || 0;
        console.log('Total count from API:', totalCount, 'Has more:', response.has_more);
        
        // Filter out duplicates
        const uniquePredictions = newPredictions.filter(prediction => {
            if (!loadedPredictionIds.has(prediction._id)) {
                loadedPredictionIds.add(prediction._id);
                return true;
            }
            return false;
        });
        
        console.log('Unique predictions to add:', uniquePredictions.length);
        
        currentPredictions.push(...uniquePredictions);
        hasMorePredictions = response.has_more;
        
        console.log('After adding predictions:', {
            currentCount: currentPredictions.length,
            totalCount: totalCount,
            hasMore: hasMorePredictions,
            uniqueAdded: uniquePredictions.length
        });
        
        if (currentPredictions.length === 0 && reset) {
            historyGrid.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-inbox"></i>
                    <span>No predictions yet. Make your first prediction!</span>
                </div>
            `;
            return;
        }
        
        // Render new predictions using consistent formatting
        if (reset) {
            renderPredictions(uniquePredictions, true);
            currentPage = 1; // Set to 1 since we've loaded the first page
            console.log('Reset page to:', currentPage);
        } else {
            renderPredictions(uniquePredictions, false);
            // Only increment page if we actually got new unique predictions
            if (uniquePredictions.length > 0) {
                currentPage++;
                console.log('Updated page to:', currentPage);
            }
        }
        
        // Update button and count
        updateSimpleLoadMoreButton();
        
    } catch (error) {
        console.error('Failed to load history:', error);
        historyGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Failed to load predictions: ${error.message}</span>
                <button onclick="loadPredictionHistory(true)" class="retry-btn">RETRY</button>
            </div>
        `;
    } finally {
        isLoading = false;
        updateSimpleLoadMoreButton();
    }
}

// Update prediction count display
function updatePredictionCount() {
    const countElement = document.getElementById('predictionCount');
    if (countElement) {
        const actualTotal = totalCount > 0 ? totalCount : currentPredictions.length;
        const isCollapsed = currentPredictions.length <= 6 && hasMorePredictions;
        const statusText = isCollapsed ? '(SHOWING FIRST 6)' : hasMorePredictions ? '(LOADING MORE...)' : '(ALL LOADED)';
        countElement.textContent = `SHOWING ${currentPredictions.length} OF ${actualTotal} PREDICTIONS ${statusText}`;
    }
}

// Simplified button update function
function updateSimpleLoadMoreButton() {
    const historyGrid = document.getElementById('historyGrid');
    let loadMoreContainer = document.querySelector('.load-more-container');
    
    if (loadMoreContainer) {
        loadMoreContainer.remove();
    }
    
    if (currentPredictions.length > 0 && currentPredictions.length < totalCount) {
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.className = 'load-more-container';
        
        loadMoreContainer.innerHTML = `
            <button class="load-more-btn" onclick="loadMorePredictions()">
                <span class="btn-icon">▼</span>
                <span class="btn-text">SEE_MORE_PREDICTIONS</span>
                <span class="btn-count">(${currentPredictions.length} OF ${totalCount})</span>
            </button>
        `;
        
        historyGrid.appendChild(loadMoreContainer);
    }
    
    updatePredictionCount();
}

// Legacy function for compatibility - just call the simple version
function updateLoadMoreButton() {
    updateSimpleLoadMoreButton();
}

// Show less predictions (collapse to first 6)
function showLessPredictions() {
    const historyGrid = document.getElementById('historyGrid');
    
    // Keep only the first 6 predictions
    currentPredictions = currentPredictions.slice(0, 6);
    
    // Reset pagination state to show more predictions are available
    currentPage = 1;
    hasMorePredictions = totalCount > 6; // Only set true if there are actually more predictions
    console.log('Reset state - totalCount:', totalCount, 'hasMorePredictions:', hasMorePredictions);
    
    // Update loaded IDs to only include the first 6
    loadedPredictionIds.clear();
    currentPredictions.forEach(prediction => {
        loadedPredictionIds.add(prediction._id);
    });
    
    // Reset loading state to ensure clean state
    isLoading = false;
    
    // Use the same rendering function for consistency
    renderPredictions(currentPredictions, true);
    
    // Update button and counter
    updateSimpleLoadMoreButton();
}

// Render predictions with consistent formatting
function renderPredictions(predictions, reset = false) {
    const historyGrid = document.getElementById('historyGrid');
    
    const historyHTML = predictions.map(prediction => {
        const riskLevel = prediction.risk_level ? prediction.risk_level.toLowerCase() : 'low';
        return `
        <div class="history-card prediction-item risk-${riskLevel}" onclick="showPredictionDetails('${prediction._id}')">
            <div class="history-header">
                <div class="history-name">${prediction.customer_name}</div>
                <div class="header-right">
                    <span class="risk-badge ${riskLevel}">${prediction.risk_level || 'LOW'}</span>
                    <div class="history-time">${formatDate(prediction.timestamp)}</div>
                </div>
            </div>
            <div class="history-details">
                <div class="history-detail">
                    <div class="detail-label">PARTY_SIZE:</div>
                    <div class="detail-value">${prediction.party_size} GUESTS</div>
                </div>
                <div class="history-detail">
                    <div class="detail-label">NO_SHOW_PROB:</div>
                    <div class="detail-value probability-${riskLevel}">${Math.round(prediction.prediction_prob * 100)}%</div>
                </div>
                <div class="history-detail">
                    <div class="detail-label">LEAD_TIME:</div>
                    <div class="detail-value">${prediction.lead_time_days} DAYS</div>
                </div>
                <div class="history-detail">
                    <div class="detail-label">DEPOSIT:</div>
                    <div class="detail-value">${prediction.deposit_paid ? 'PAID' : 'NOT_PAID'}</div>
                </div>
            </div>
        </div>
    `}).join('');
    
    if (reset) {
        historyGrid.innerHTML = historyHTML;
    } else {
        historyGrid.insertAdjacentHTML('beforeend', historyHTML);
    }
}

// Debounce function to prevent rapid clicking
let lastLoadMoreTime = 0;
const LOAD_MORE_DEBOUNCE = 1000; // 1 second debounce

// Simplified load more predictions
async function loadMorePredictions() {
    console.log('Loading more predictions...');
    
    // Simple check - if we have less than total, load more
    if (currentPredictions.length >= totalCount) {
        console.log('All predictions already loaded');
        return;
    }
    
    // Disable button immediately
    const loadMoreBtn = document.querySelector('.load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="btn-icon">⟳</span><span class="btn-text">LOADING...</span>';
        loadMoreBtn.blur();
    }
    
    try {
        const skipCount = currentPredictions.length;
        console.log('Loading from skip:', skipCount);
        
        const response = await API.getRecentPredictions(skipCount, 6);
        
        if (response.success && response.data && response.data.length > 0) {
            const newPredictions = response.data.filter(prediction => {
                if (!loadedPredictionIds.has(prediction._id)) {
                    loadedPredictionIds.add(prediction._id);
                    return true;
                }
                return false;
            });
            
            currentPredictions.push(...newPredictions);
            renderPredictions(newPredictions, false);
            
            console.log('Loaded', newPredictions.length, 'new predictions');
        }
        
    } catch (error) {
        console.error('Error loading more:', error);
    }
    
    // Always re-enable button and update state
    setTimeout(() => {
        updateSimpleLoadMoreButton();
    }, 500);
}

// Update statistics
async function updateStats() {
    try {
        const response = await API.getRecentPredictions();
        const predictions = response.data || [];
        
        // Update total predictions
        const totalElement = document.getElementById('totalPredictions');
        if (totalElement) {
            animateCounter(totalElement, predictions.length);
        }
        
        // Update MongoDB stats
        updateMongoStats(predictions);
        
    } catch (error) {
        console.error('Failed to update stats:', error);
    }
}

function updateMongoStats(predictions) {
    const totalDocs = document.getElementById('totalDocuments');
    const avgRisk = document.getElementById('avgRisk');
    const highRiskCount = document.getElementById('highRiskCount');
    
    if (predictions.length > 0) {
        // Total documents
        if (totalDocs) totalDocs.textContent = predictions.length;
        
        // Average risk
        const avgProbability = predictions.reduce((sum, p) => sum + p.prediction_prob, 0) / predictions.length;
        if (avgRisk) avgRisk.textContent = `${Math.round(avgProbability * 100)}%`;
        
        // High risk count
        const highRisk = predictions.filter(p => p.risk_level === 'Critical').length;
        if (highRiskCount) highRiskCount.textContent = highRisk;
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function animateCounter(element, targetValue) {
    const startValue = parseInt(element.textContent) || 0;
    const increment = Math.ceil((targetValue - startValue) / 30);
    let currentValue = startValue;
    
    const timer = setInterval(() => {
        currentValue += increment;
        if (currentValue >= targetValue) {
            element.textContent = targetValue;
            clearInterval(timer);
        } else {
            element.textContent = currentValue;
        }
    }, 50);
}

function setLoadingState(button, loading) {
    if (!button) {
        console.warn('Button not found for setLoadingState');
        return;
    }
    
    isLoading = loading;
    
    if (loading) {
        button.disabled = true;
        button.innerHTML = '<span class="btn-icon">⟳</span><span class="btn-text">PROCESSING...</span>';
        button.classList.add('loading');
        console.log('Button set to loading state');
    } else {
        button.disabled = false;
        button.innerHTML = '<span class="btn-icon">►</span><span class="btn-text">EXECUTE_PREDICTION()</span>';
        button.classList.remove('loading');
        console.log('Button restored from loading state');
    }
}

function validateInput(e) {
    const input = e.target;
    const value = input.value.trim();
    
    // Remove existing validation classes
    input.classList.remove('success', 'error');
    
    // Basic validation
    if (input.hasAttribute('required') && !value) {
        if (e.type === 'blur') {
            input.classList.add('error');
        }
        return false;
    }
    
    // Numeric validation
    if (input.type === 'number') {
        const num = parseFloat(value);
        const min = parseFloat(input.getAttribute('min'));
        const max = parseFloat(input.getAttribute('max'));
        
        if (isNaN(num) || (min !== null && num < min) || (max !== null && num > max)) {
            if (e.type === 'blur') {
                input.classList.add('error');
            }
            return false;
        }
    }
    
    if (value) {
        input.classList.add('success');
    }
    
    return true;
}

function showError(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    // Add toast styles if not exists
    if (!document.querySelector('style[data-toast]')) {
        const style = document.createElement('style');
        style.setAttribute('data-toast', 'true');
        style.textContent = `
            .toast {
                position: fixed;
                top: 100px;
                right: 20px;
                background: var(--bg-card);
                border: 1px solid var(--error-color);
                color: var(--text-primary);
                padding: 1rem;
                border-radius: 0.5rem;
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                animation: slideInRight 0.3s ease;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showPredictionDetails(id) {
    // For now, just highlight the card
    console.log('Show details for prediction:', id);
    // TODO: Implement modal or detailed view
}

// Animation functions
function startAnimations() {
    // Animate stat cards on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'slideInUp 0.6s ease-out';
            }
        });
    }, observerOptions);
    
    // Observe all cards and sections
    document.querySelectorAll('.stat-card, .db-card, .history-card').forEach(card => {
        observer.observe(card);
    });
}

function animateResultCard(result) {
    // Animate the progress circle
    const circle = document.querySelector('.progress-ring-circle');
    if (circle) {
        updateProgressCircle(Math.round(result.probability * 100));
    }
    
    // Animate insight items
    const insightItems = document.querySelectorAll('.insight-item');
    insightItems.forEach((item, index) => {
        setTimeout(() => {
            item.style.animation = 'slideInUp 0.4s ease-out';
        }, index * 100);
    });
}

// Debug function to reset state
function resetLoadingState() {
    isLoading = false;
    console.log('Loading state manually reset');
    updateLoadMoreButton();
}

// Make functions globally accessible
window.scrollToSection = scrollToSection;
window.testConnection = testConnection;
window.loadPredictionHistory = loadPredictionHistory;
window.showPredictionDetails = showPredictionDetails;
window.loadMorePredictions = loadMorePredictions;
window.showLessPredictions = showLessPredictions;
window.renderPredictions = renderPredictions;
window.resetLoadingState = resetLoadingState;