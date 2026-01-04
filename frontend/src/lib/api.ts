// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://selfactual-api.azurewebsites.net';

export const config = {
    apiUrl: API_URL,
};

// API Client
export const api = {
    async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${API_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        return response.json();
    },

    async post<T>(endpoint: string, data: unknown): Promise<T> {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        return response.json();
    },
};

// Health Check Types
export interface HealthCheck {
    status: string;
    db: string;
    redis: string;
}

// Fetch health status
export const fetchHealth = () => api.get<HealthCheck>('/health');
